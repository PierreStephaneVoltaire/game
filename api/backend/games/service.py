from __future__ import annotations

import hashlib
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.auth.models import AuthAttempt
from backend.config import get_settings
from backend.content.service import current_content
from backend.errors import ApiError

from .models import CommittedBatch, Game, GameEvent
from .schemas import CreateGame, DeathWrite, GameWrite
from .validation import digest, validate_death_state, validate_write

def _now() -> datetime:
    return datetime.now(UTC)


def _utc_naive(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None) if value.tzinfo else value


def _rate_limit(session: Session, user_id: str, now: datetime) -> None:
    settings = get_settings()
    window_seconds = settings.sync_window_seconds
    window = datetime.fromtimestamp((int(now.timestamp()) // window_seconds) * window_seconds, UTC)
    subject_hash = hashlib.sha256(user_id.encode()).hexdigest()
    attempt = session.get(AuthAttempt, ("game-sync", subject_hash, window))
    if attempt and attempt.attempt_count >= settings.max_sync_attempts:
        raise ApiError(429, "RATE_LIMITED", "Too many sync attempts. Try again shortly.")
    if attempt is None:
        session.add(AuthAttempt(scope="game-sync", subject_hash=subject_hash, window_start=window, attempt_count=1))
    else:
        attempt.attempt_count += 1
    session.commit()


def _require_current_content(session: Session, content_version: str) -> None:
    current = current_content(session)
    if current is None or current.version != content_version:
        latest = current.version if current else None
        raise ApiError(
            409,
            "CONTENT_VERSION_OUTDATED",
            "Runtime content has changed.",
            latestVersion=latest,
        )


def _game_dict(game: Game) -> dict[str, Any]:
    return {
        "gameHash": game.game_hash,
        "lifeStatus": game.life_status,
        "stateVersion": game.state_version,
        "stateSchemaVersion": game.state_schema_version,
        "contentVersion": game.content_version,
        "lastEventSequence": game.last_event_sequence,
        "lastEventId": game.last_event_id,
        "state": game.state_json,
        "createdAt": game.created_at,
        "updatedAt": game.updated_at,
        "diedAt": game.died_at,
    }


def _event_dict(event: GameEvent) -> dict[str, Any]:
    return {
        "sequence": event.sequence,
        "eventId": event.event_id,
        "eventType": event.event_type,
        "eventAt": event.event_at,
        "payload": event.payload_json,
    }


class GameService:
    def create(self, session: Session, user_id: str, content_version: str, data: CreateGame) -> dict[str, Any]:
        now = _now()
        with session.begin():
            _require_current_content(session, content_version)
            count = session.scalar(select(func.count()).select_from(Game).where(Game.owner_user_id == user_id))
            if (count or 0) >= get_settings().max_games_per_user:
                raise ApiError(409, "GAME_LIMIT_REACHED", "Each account can have at most 20 games.")
            existing = session.get(Game, data.game_hash)
            if existing:
                if existing.owner_user_id == user_id:
                    return _game_dict(existing)
                raise ApiError(409, "GAME_HASH_CONFLICT", "That game hash belongs to another account.")
            write = GameWrite(batchId="initial", previousEventId=None, targetState=data.state, events=data.events)
            validate_write(write, 0, None)
            if len(data.events) > get_settings().max_events_per_game:
                raise ApiError(409, "EVENT_LIMIT_REACHED", "This game has too many events.")
            game = Game(
                game_hash=data.game_hash,
                owner_user_id=user_id,
                life_status="alive",
                state_version=0,
                state_schema_version=data.state_schema_version,
                content_version=content_version,
                last_event_sequence=data.events[-1].sequence if data.events else 0,
                last_event_id=data.events[-1].event_id if data.events else None,
                last_event_at=data.events[-1].event_at if data.events else None,
                state_json=data.state,
                created_at=now,
                updated_at=now,
            )
            session.add(game)
            for event in data.events:
                session.add(GameEvent(
                    game_hash=game.game_hash, sequence=event.sequence, event_id=event.event_id,
                    batch_id="initial", event_type=event.event_type, event_at=event.event_at,
                    payload_json=event.payload, created_at=now,
                ))
        return _game_dict(game)

    def get(self, session: Session, user_id: str, game_hash: str) -> dict[str, Any]:
        game = self._owned_game(session, user_id, game_hash)
        return _game_dict(game)

    def write(self, session: Session, user_id: str, content_version: str, game_hash: str, if_match: int, data: GameWrite, *, death: bool = False, cause_event_id: str | None = None) -> dict[str, Any]:
        now = _now()
        _rate_limit(session, user_id, now)
        state_hash, events_hash = digest(data.target_state), digest([event.model_dump(mode="json", by_alias=True) for event in data.events])
        try:
            with session.begin():
                previous = session.get(CommittedBatch, (game_hash, data.batch_id))
                if previous:
                    if previous.state_hash != state_hash or previous.events_hash != events_hash:
                        raise ApiError(409, "EVENT_CONFLICT", "A batch ID cannot be reused with different data.")
                    return previous.acknowledgement_json
                game = session.scalar(select(Game).where(Game.game_hash == game_hash).with_for_update())
                if game is None or game.owner_user_id != user_id:
                    raise ApiError(404, "GAME_NOT_FOUND", "Game not found.")
                _require_current_content(session, content_version)
                if game.life_status == "dead":
                    raise ApiError(409, "EVENT_CONFLICT", "Dead games are read-only.")
                if game.state_version != if_match:
                    raise ApiError(412, "STALE_STATE", "The game state is stale.")
                validate_write(data, game.last_event_sequence, game.last_event_id)
                if data.events and game.last_event_at:
                    if _utc_naive(data.events[0].event_at) < _utc_naive(game.last_event_at):
                        raise ApiError(409, "EVENT_CONFLICT", "Event timestamps must not decrease.")
                total = game.last_event_sequence + len(data.events)
                if total > get_settings().max_events_per_game:
                    raise ApiError(409, "EVENT_LIMIT_REACHED", "This game has too many events.")
                if death:
                    cause = cause_event_id or ""
                    cause_is_known = cause in {event.event_id for event in data.events}
                    if not cause_is_known:
                        cause_is_known = session.scalar(
                            select(GameEvent.event_id).where(
                                GameEvent.game_hash == game_hash,
                                GameEvent.event_id == cause,
                            )
                        ) is not None
                    validate_death_state(
                        data.target_state,
                        cause,
                        {cause} if cause_is_known else set(),
                    )
                elif isinstance(data.target_state.get("ending"), dict) and data.target_state["ending"].get("kind") == "death":
                    raise ApiError(400, "INVALID_REQUEST", "Use the death endpoint for terminal death state.")
                for event in data.events:
                    session.add(GameEvent(
                        game_hash=game_hash, sequence=event.sequence, event_id=event.event_id,
                        batch_id=data.batch_id, event_type=event.event_type, event_at=event.event_at,
                        payload_json=event.payload, created_at=now,
                    ))
                game.state_json = data.target_state
                game.state_version += 1
                game.content_version = content_version
                game.last_event_sequence = total
                game.last_event_id = data.events[-1].event_id if data.events else game.last_event_id
                game.last_event_at = data.events[-1].event_at if data.events else game.last_event_at
                game.updated_at = now
                if death:
                    game.life_status, game.died_at = "dead", now
                acknowledgement = {
                    "gameHash": game.game_hash,
                    "stateVersion": game.state_version,
                    "committedThroughSequence": game.last_event_sequence,
                    "committedThroughEventId": game.last_event_id,
                    "etag": f'"{game.state_version}"',
                    "serverNow": now.isoformat(),
                }
                session.add(CommittedBatch(
                    game_hash=game_hash, batch_id=data.batch_id, state_hash=state_hash, events_hash=events_hash,
                    resulting_state_version=game.state_version, committed_through_sequence=game.last_event_sequence,
                    committed_through_event_id=game.last_event_id, acknowledgement_json=acknowledgement, committed_at=now,
                ))
        except IntegrityError as error:
            raise ApiError(409, "EVENT_CONFLICT", "The event ledger conflicts with an existing event.") from error
        return acknowledgement

    def events(self, session: Session, user_id: str, game_hash: str, after: int, limit: int) -> list[dict[str, Any]]:
        self._owned_game(session, user_id, game_hash)
        events = session.scalars(select(GameEvent).where(GameEvent.game_hash == game_hash, GameEvent.sequence > after).order_by(GameEvent.sequence).limit(limit + 1)).all()
        return [_event_dict(event) for event in events]

    def list_games(self, session: Session, user_id: str, dead: bool, after: tuple[datetime, str] | None, limit: int) -> list[Game]:
        statement = select(Game).where(Game.owner_user_id == user_id, Game.life_status == ("dead" if dead else "alive"))
        if after:
            timestamp = Game.died_at if dead else Game.updated_at
            statement = statement.where((timestamp < after[0]) | ((timestamp == after[0]) & (Game.game_hash < after[1])))
        timestamp = Game.died_at if dead else Game.updated_at
        return list(session.scalars(statement.order_by(timestamp.desc(), Game.game_hash.desc()).limit(limit + 1)))

    def grave(self, session: Session, user_id: str, game_hash: str) -> dict[str, Any]:
        game = self._owned_game(session, user_id, game_hash)
        if game.life_status != "dead":
            raise ApiError(404, "GAME_NOT_FOUND", "Grave not found.")
        ending = game.state_json.get("ending", {})
        event_ids = ending.get("eventIds", []) if isinstance(ending, dict) else []
        causes = list(session.scalars(select(GameEvent).where(GameEvent.game_hash == game_hash, GameEvent.event_id.in_(event_ids)).order_by(GameEvent.sequence))) if event_ids else []
        return {"game": _game_dict(game), "ending": ending, "causalEvents": [_event_dict(event) for event in causes]}

    @staticmethod
    def _owned_game(session: Session, user_id: str, game_hash: str) -> Game:
        game = session.get(Game, game_hash)
        if game is None or game.owner_user_id != user_id:
            raise ApiError(404, "GAME_NOT_FOUND", "Game not found.")
        return game

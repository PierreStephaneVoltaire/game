from __future__ import annotations

from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.auth.models import User
from backend.content.models import ContentPointer, ContentVersion
from backend.database import Base
from backend.errors import ApiError
from backend.games.schemas import CreateGame, DeathWrite, GameWrite
from backend.games.service import GameService


def setup() -> tuple[Session, GameService, str]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = Session(engine, expire_on_commit=False)
    user = User(username="player_1", password_hash="hash")
    version = "a" * 64
    session.add_all([
        user,
        ContentVersion(version=version, schema_version=1, bundle_json="{}", item_count=0, published_at=datetime.now(UTC)),
        ContentPointer(name="current", version=version, updated_at=datetime.now(UTC)),
    ])
    session.commit()
    return session, GameService(), user.id


def event(sequence: int, event_id: str) -> dict[str, object]:
    return {
        "sequence": sequence,
        "eventId": event_id,
        "eventType": "care",
        "eventAt": "2026-09-03T12:00:00Z",
        "payload": {"id": event_id},
    }


def test_batch_is_atomic_and_retry_is_idempotent() -> None:
    session, games, user_id = setup()
    version = "a" * 64
    games.create(session, user_id, version, CreateGame(gameHash="00421873", stateSchemaVersion=1, state={"ending": None}))
    write = GameWrite(batchId="batch-1", previousEventId=None, targetState={"ending": None, "value": 1}, events=[event(1, "event-1")])
    acknowledgement = games.write(session, user_id, version, "00421873", 0, write)
    assert acknowledgement["stateVersion"] == 1
    assert games.write(session, user_id, version, "00421873", 0, write) == acknowledgement
    game = games.get(session, user_id, "00421873")
    assert game["state"]["value"] == 1
    assert len(games.events(session, user_id, "00421873", 0, 25)) == 1


def test_divergent_retry_and_stale_writer_do_not_mutate_game() -> None:
    session, games, user_id = setup()
    version = "a" * 64
    games.create(session, user_id, version, CreateGame(gameHash="00421873", stateSchemaVersion=1, state={"ending": None}))
    games.write(session, user_id, version, "00421873", 0, GameWrite(batchId="batch-1", previousEventId=None, targetState={"ending": None}, events=[event(1, "event-1")]))
    for write in (
        GameWrite(batchId="batch-1", previousEventId=None, targetState={"ending": None, "changed": True}, events=[event(1, "event-1")]),
        GameWrite(batchId="batch-2", previousEventId="event-1", targetState={"ending": None}, events=[event(2, "event-2")]),
    ):
        try:
            games.write(session, user_id, version, "00421873", 0, write)
        except ApiError as error:
            assert error.code in {"EVENT_CONFLICT", "STALE_STATE"}
        else:
            raise AssertionError("invalid write was accepted")
    assert games.get(session, user_id, "00421873")["stateVersion"] == 1


def test_timestamp_cursor_and_death_cause_use_the_game_summary() -> None:
    session, games, user_id = setup()
    version = "a" * 64
    games.create(
        session,
        user_id,
        version,
        CreateGame(
            gameHash="00421873",
            stateSchemaVersion=1,
            state={"ending": None},
            events=[event(1, "event-1")],
        ),
    )
    with pytest.raises(ApiError) as raised:
        games.write(
            session,
            user_id,
            version,
            "00421873",
            0,
            GameWrite(
                batchId="older",
                previousEventId="event-1",
                targetState={"ending": None},
                events=[{**event(2, "event-2"), "eventAt": "2026-09-03T11:59:59Z"}],
            ),
        )
    assert raised.value.code == "EVENT_CONFLICT"
    ending = {"kind": "death", "eventIds": ["event-1"]}
    result = games.write(
        session,
        user_id,
        version,
        "00421873",
        0,
        DeathWrite(
            batchId="death",
            previousEventId="event-1",
            targetState={"ending": ending},
            events=[],
            causeEventId="event-1",
        ),
        death=True,
        cause_event_id="event-1",
    )
    assert result["stateVersion"] == 1

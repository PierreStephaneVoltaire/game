from __future__ import annotations

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.auth.models import User
from backend.content.models import ContentPointer, ContentVersion
from backend.database import Base
from backend.errors import ApiError
from backend.games.models import Game
from backend.games.schemas import CreateGame, DeathWrite, GameWrite, NicknameWrite
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
    games.write(
        session, user_id, version, "00421873", 0,
        GameWrite(batchId="older", previousEventId="event-1", targetState={"ending": None},
                  events=[{**event(2, "event-2"), "eventAt": "2026-09-03T11:59:59Z"}]),
    )
    ending = {"kind": "death", "eventIds": ["event-1"]}
    result = games.write(
        session,
        user_id,
        version,
        "00421873",
        1,
        DeathWrite(
            batchId="death",
            previousEventId="event-2",
            targetState={"ending": ending},
            events=[],
            causeEventId="event-1",
        ),
        death=True,
        cause_event_id="event-1",
    )
    assert result["stateVersion"] == 2


def test_other_account_cannot_read_or_replay_committed_batch() -> None:
    session, games, owner = setup()
    other = User(username="other_player", password_hash="hash")
    session.add(other)
    session.commit()
    key, version = "00421873", "a" * 64
    games.create(session, owner, version, CreateGame(gameHash=key, stateSchemaVersion=1, state={"ending": None}))
    write = GameWrite(batchId="batch-1", targetState={"ending": None}, events=[])
    games.write(session, owner, version, key, 0, write)
    for operation in (
        lambda: games.get(session, other.id, key),
        lambda: games.events(session, other.id, key, 0, 25),
        lambda: games.grave(session, other.id, key),
        lambda: games.write(session, other.id, version, key, 0, write),
    ):
        with pytest.raises(ApiError) as raised:
            operation()
        assert raised.value.status_code == 404
        session.rollback()


def test_game_keys_list_living_and_dead_games_with_nicknames() -> None:
    session, games, user_id = setup()
    version = "a" * 64
    games.create(session, user_id, version, CreateGame(gameHash="00421873", stateSchemaVersion=1, state={"ending": None}))
    games.create(session, user_id, version, CreateGame(gameHash="00421874", stateSchemaVersion=1, state={"ending": None}))
    session.get(Game, "00421874").life_status = "dead"
    session.commit()
    assert games.set_nickname(session, user_id, "00421873", "Morning run") == {"gameHash": "00421873", "nickname": "Morning run"}
    keys = {item["gameHash"]: item for item in games.game_keys(session, user_id)}
    assert keys["00421873"]["nickname"] == "Morning run"
    assert keys["00421873"]["lifeStatus"] == "alive"
    assert keys["00421874"]["nickname"] is None
    assert keys["00421874"]["lifeStatus"] == "dead"


def test_blank_nickname_clears_and_other_accounts_cannot_rename() -> None:
    session, games, user_id = setup()
    version = "a" * 64
    games.create(session, user_id, version, CreateGame(gameHash="00421873", stateSchemaVersion=1, state={"ending": None}))
    games.set_nickname(session, user_id, "00421873", "First")
    games.set_nickname(session, user_id, "00421873", "Second")
    assert games.game_keys(session, user_id)[0]["nickname"] == "Second"
    games.set_nickname(session, user_id, "00421873", "")
    assert games.game_keys(session, user_id)[0]["nickname"] is None
    other = User(username="player_2", password_hash="hash")
    session.add(other)
    session.commit()
    with pytest.raises(ApiError) as error:
        games.set_nickname(session, other.id, "00421873", "Mine")
    assert error.value.code == "GAME_NOT_FOUND"
    assert games.game_keys(session, other.id) == []


def test_nickname_is_trimmed_and_length_limited() -> None:
    assert NicknameWrite(nickname="  Cozy  ").nickname == "Cozy"
    with pytest.raises(ValidationError):
        NicknameWrite(nickname="x" * 41)


def test_creation_and_write_retries_survive_content_updates_and_other_writers() -> None:
    session, games, user_id = setup()
    version, key = "a" * 64, "00421873"
    creation = CreateGame(gameHash=key, creationBatchId="create-a", stateSchemaVersion=1,
                          state={"ending": None}, events=[event(1, "event-1")])
    initial = games.create(session, user_id, version, creation)
    assert initial["stateVersion"] == 0
    newer = "b" * 64
    session.add(ContentVersion(version=newer, schema_version=1, bundle_json="{}", item_count=0, published_at=datetime.now(UTC)))
    session.get(ContentPointer, "current").version = newer
    session.commit()
    assert games.create(session, user_id, version, creation) == initial
    write = GameWrite(batchId="batch-a", previousEventId="event-1", targetState={"ending": None, "value": 2}, events=[event(2, "event-2")])
    committed = games.write(session, user_id, version, key, 0, write)
    assert committed["stateVersion"] == 1
    assert games.write(session, user_id, version, key, 0, write) == committed
    assert games.create(session, user_id, version, creation) == initial
    saved = games.get(session, user_id, key)
    assert saved["creationBatchId"] == "create-a"
    assert saved["latestCommittedBatchId"] == "batch-a"
    assert saved["state"]["value"] == 2
    session.rollback()
    with pytest.raises(ApiError) as conflict:
        games.create(session, user_id, newer, creation.model_copy(update={"creation_batch_id": "other-device"}))
    assert conflict.value.code == "GAME_HASH_CONFLICT"
    with pytest.raises(ApiError):
        games.create(session, user_id, newer, creation.model_copy(update={"state": {"different": True}}))


def test_sequence_order_accepts_earlier_timestamps_without_duplicate_history() -> None:
    session, games, user_id = setup()
    games.create(session, user_id, "a" * 64, CreateGame(gameHash="00421873", stateSchemaVersion=1, state={"ending": None}))
    write = GameWrite(batchId="chronology", targetState={"ending": None}, events=[
        event(1, "first"), {**event(2, "second"), "eventAt": "2026-09-03T11:00:00Z"},
    ])
    result = games.write(session, user_id, "a" * 64, "00421873", 0, write)
    assert games.write(session, user_id, "a" * 64, "00421873", 0, write) == result
    assert [row["eventId"] for row in games.events(session, user_id, "00421873", 0, 25)] == ["first", "second"]


def test_compact_snapshots_restore_history_and_terminal_creation() -> None:
    session, games, user_id = setup()
    key = "00421873"
    ending = {"kind": "death", "eventIds": ["cause"]}
    creation = CreateGame(
        gameHash=key, creationBatchId="created-ended", stateSchemaVersion=1,
        state={"ending": ending, "events": []}, events=[event(1, "cause")],
    )
    games.create(session, user_id, "a" * 64, creation)
    restored = games.get(session, user_id, key)
    assert restored["lifeStatus"] == "dead"
    assert restored["state"]["events"] == [{"id": "cause", "type": "care", "at": 1788436800000}]
    assert games.grave(session, user_id, key)["game"]["state"] == restored["state"]
    assert session.get(Game, key).state_json["events"] == []
    session.rollback()
    assert games.create(session, user_id, "a" * 64, creation)["stateVersion"] == 0


@pytest.mark.parametrize(
    ("events", "message"),
    [
        ([event(1, "event-1"), event(2, "event-1")], "Event IDs must be unique."),
        ([event(1, "event-1"), event(3, "event-3")], "Event sequences must be contiguous."),
    ],
)
def test_malformed_ledgers_are_rejected_as_event_conflicts(events: list[dict[str, object]], message: str) -> None:
    from backend.games.validation import validate_write

    write = GameWrite.model_validate({"batchId": "batch", "previousEventId": None, "targetState": {}, "events": events})
    with pytest.raises(ApiError) as raised:
        validate_write(write, 0, None)
    assert (raised.value.status_code, raised.value.code, str(raised.value)) == (409, "EVENT_CONFLICT", message)

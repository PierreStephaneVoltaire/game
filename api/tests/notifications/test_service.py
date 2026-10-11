from __future__ import annotations

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.auth.models import DiscordIdentity, User
from backend.content.models import ContentVersion
from backend.database import Base
from backend.games.models import Game
from backend.notifications.discord_dm import bot_sender
from backend.notifications.models import ScheduledNotification
from backend.notifications.service import (
    DeliveryFailed,
    dispatch_due,
    get_preference,
    schedule_interaction_alerts,
    set_preference,
)

GAME = "00421873"


def setup() -> tuple[Session, str]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    session = Session(engine, expire_on_commit=False)
    user = User(username="player_1")
    version = "a" * 64
    now = datetime.now(UTC)
    session.add_all([
        user,
        ContentVersion(version=version, schema_version=1, bundle_json="{}", item_count=0, published_at=now),
    ])
    session.flush()
    session.add_all([
        Game(game_hash=GAME, owner_user_id=user.id, state_schema_version=1, content_version=version,
             state_json={}, created_at=now, updated_at=now),
        DiscordIdentity(discord_user_id="1234", user_id=user.id),
    ])
    session.commit()
    return session, user.id


def state(mode: str = "realtime", ending=None, **cooldowns) -> dict:
    return {"mode": mode, "ending": ending, "history": {"interactionCooldowns": cooldowns}}


def in_ms(delta: timedelta) -> int:
    return int((datetime.now(UTC) + delta).timestamp() * 1000)


def pending(session: Session) -> dict[str, ScheduledNotification]:
    return {row.kind: row for row in session.query(ScheduledNotification).all()}


def test_preference_defaults_off_and_persists() -> None:
    session, user_id = setup()
    assert get_preference(session, user_id) is False
    assert set_preference(session, user_id, True) is True
    assert get_preference(session, user_id) is True
    set_preference(session, user_id, False)
    assert get_preference(session, user_id) is False


def test_realtime_cooldowns_schedule_one_alert_per_action() -> None:
    session, user_id = setup()
    play_at = in_ms(timedelta(hours=2))
    schedule_interaction_alerts(session, user_id, GAME, state(play=play_at, socialize=None))
    rows = pending(session)
    assert set(rows) == {"play"}
    assert rows["play"].due_at.replace(tzinfo=UTC) == datetime.fromtimestamp(play_at / 1000, UTC)

    rows["play"].sent_at = datetime.now(UTC)
    session.commit()
    schedule_interaction_alerts(session, user_id, GAME, state(play=play_at))
    assert pending(session)["play"].sent_at is not None

    later = in_ms(timedelta(hours=3))
    schedule_interaction_alerts(session, user_id, GAME, state(play=later))
    assert pending(session)["play"].sent_at is None


@pytest.mark.parametrize("synced", [state("streaming"), state(ending={"kind": "death"})])
def test_streaming_or_ended_games_clear_alerts(synced) -> None:
    session, user_id = setup()
    schedule_interaction_alerts(session, user_id, GAME, state(play=in_ms(timedelta(hours=1))))
    synced["history"]["interactionCooldowns"] = {"play": in_ms(timedelta(hours=1))}
    schedule_interaction_alerts(session, user_id, GAME, synced)
    assert pending(session) == {}


def test_expired_cooldowns_are_not_scheduled() -> None:
    session, user_id = setup()
    schedule_interaction_alerts(session, user_id, GAME, state(socialize=in_ms(timedelta(minutes=-1))))
    assert pending(session) == {}


def due_play(session: Session, user_id: str) -> None:
    session.add(ScheduledNotification(game_hash=GAME, kind="play", user_id=user_id,
                                      due_at=datetime.now(UTC) - timedelta(minutes=1)))
    session.commit()


def test_dispatch_only_sends_when_enabled_and_marks_rows_sent() -> None:
    session, user_id = setup()
    sent: list[tuple[str, str]] = []
    due_play(session, user_id)
    assert dispatch_due(session, lambda *args: sent.append(args), "https://example.test") == 0
    assert sent == [] and pending(session)["play"].sent_at is not None

    session.query(ScheduledNotification).delete()
    due_play(session, user_id)
    set_preference(session, user_id, True)
    assert dispatch_due(session, lambda *args: sent.append(args), "https://example.test") == 1
    assert sent == [("1234", "Play is ready again. https://example.test")]
    assert pending(session)["play"].sent_at is not None


def test_retryable_failures_retry_until_the_attempt_limit() -> None:
    session, user_id = setup()
    set_preference(session, user_id, True)
    due_play(session, user_id)

    def fail(*_):
        raise DeliveryFailed(True)

    dispatch_due(session, fail, "https://example.test")
    dispatch_due(session, fail, "https://example.test")
    assert pending(session)["play"].sent_at is None
    dispatch_due(session, fail, "https://example.test")
    assert pending(session)["play"].sent_at is not None
    assert pending(session)["play"].attempts == 3


def test_bot_sender_opens_a_dm_channel_without_mentions() -> None:
    calls: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        if request.url.path.endswith("/users/@me/channels"):
            return httpx.Response(200, json={"id": "555"})
        return httpx.Response(200, json={})

    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        bot_sender("bot-token", client)("1234", "Play is ready again.")
    assert [request.url.path for request in calls] == ["/api/v10/users/@me/channels", "/api/v10/channels/555/messages"]
    assert all(request.headers["Authorization"] == "Bot bot-token" for request in calls)
    assert b'"parse":[]' in calls[1].content.replace(b" ", b"")


@pytest.mark.parametrize("status,retryable", [(403, False), (429, True), (502, True)])
def test_bot_sender_classifies_discord_failures(status, retryable) -> None:
    with httpx.Client(transport=httpx.MockTransport(lambda _: httpx.Response(status))) as client:
        with pytest.raises(DeliveryFailed) as failure:
            bot_sender("bot-token", client)("1234", "Play is ready again.")
    assert failure.value.retryable is retryable

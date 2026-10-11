from __future__ import annotations

from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.auth.models import DiscordIdentity, utcnow

from .models import NotificationSetting, ScheduledNotification

INTERACTION_KINDS = ("socialize", "play")
MAX_ATTEMPTS = 3
MESSAGES = {
    "socialize": "Socialize is ready again. {url}",
    "play": "Play is ready again. {url}",
}


class DeliveryFailed(Exception):
    def __init__(self, retryable: bool) -> None:
        self.retryable = retryable
        super().__init__("Discord delivery failed")


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def get_preference(session: Session, user_id: str) -> bool:
    setting = session.get(NotificationSetting, user_id)
    return bool(setting and setting.discord_dm)


def set_preference(session: Session, user_id: str, discord_dm: bool) -> bool:
    setting = session.get(NotificationSetting, user_id)
    if setting is None:
        setting = NotificationSetting(user_id=user_id, discord_dm=discord_dm)
        session.add(setting)
    else:
        setting.discord_dm = discord_dm
    session.commit()
    return discord_dm


def schedule_interaction_alerts(session: Session, user_id: str, game_hash: str, state: dict[str, Any]) -> None:
    now = utcnow()
    if state.get("mode") != "realtime" or state.get("ending"):
        session.execute(delete(ScheduledNotification).where(ScheduledNotification.game_hash == game_hash))
        session.commit()
        return
    history = state.get("history")
    cooldowns = history.get("interactionCooldowns") if isinstance(history, dict) else None
    for kind in INTERACTION_KINDS:
        until = cooldowns.get(kind) if isinstance(cooldowns, dict) else None
        if not isinstance(until, (int, float)) or isinstance(until, bool):
            continue
        due_at = datetime.fromtimestamp(until / 1000, UTC)
        if due_at <= now:
            continue
        row = session.get(ScheduledNotification, (game_hash, kind))
        if row is None:
            session.add(ScheduledNotification(game_hash=game_hash, kind=kind, user_id=user_id, due_at=due_at))
        elif _aware(row.due_at) != due_at:
            row.due_at, row.sent_at, row.attempts = due_at, None, 0
    session.commit()


def dispatch_due(
    session: Session,
    send: Callable[[str, str], None],
    app_url: str,
    now: datetime | None = None,
) -> int:
    now = now or utcnow()
    due = session.scalars(
        select(ScheduledNotification)
        .where(ScheduledNotification.sent_at.is_(None), ScheduledNotification.due_at <= now)
        .order_by(ScheduledNotification.due_at)
        .limit(200)
        .with_for_update(skip_locked=True)
    ).all()
    delivered = 0
    for row in due:
        discord_user_id = session.scalar(
            select(DiscordIdentity.discord_user_id).where(DiscordIdentity.user_id == row.user_id)
        )
        if discord_user_id and get_preference(session, row.user_id):
            try:
                send(discord_user_id, MESSAGES[row.kind].format(url=app_url))
                delivered += 1
            except DeliveryFailed as failure:
                row.attempts += 1
                if failure.retryable and row.attempts < MAX_ATTEMPTS:
                    continue
        row.sent_at = now
    session.commit()
    return delivered

from __future__ import annotations

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from backend.config import get_settings

from .models import Session as AuthSession

def now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def create(db: Session, user_id: str) -> tuple[AuthSession, str]:
    secret = secrets.token_urlsafe(32)
    row = AuthSession(
        user_id=user_id,
        secret_hash=digest(secret),
        expires_at=now() + timedelta(days=get_settings().session_ttl_days),
    )
    db.add(row)
    db.flush()
    return row, f"{row.id}.{secret}"


def current(db: Session, token: str | None) -> AuthSession | None:
    if not token or "." not in token:
        return None
    session_id, secret = token.split(".", 1)
    row = db.scalar(select(AuthSession).where(AuthSession.id == session_id, AuthSession.secret_hash == digest(secret)))
    if row is None:
        return None
    if row.expires_at <= now():
        db.delete(row)
        db.commit()
        return None
    row.last_seen_at = now()
    return row


def revoke_user_sessions(db: Session, user_id: str) -> None:
    db.execute(delete(AuthSession).where(AuthSession.user_id == user_id))

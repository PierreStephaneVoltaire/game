"""Transaction wrapper for content publication."""

from __future__ import annotations

from sqlalchemy.orm import Session

from backend.content.schemas import RuntimeContentBundle
from backend.content.service import publish_bundle


def publish(session: Session, bundle: RuntimeContentBundle) -> str:
    """Commit immutable insertion and current-pointer switch as one transaction."""
    with session.begin():
        return publish_bundle(session, bundle)

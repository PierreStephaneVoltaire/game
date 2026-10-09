from __future__ import annotations

from datetime import UTC
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Game, GameEvent


def game_snapshot(session: Session, game: Game) -> dict[str, Any]:
    state = game.state_json
    if state.get("events") != [] or not game.last_event_sequence:
        return state
    events = session.scalars(
        select(GameEvent).where(GameEvent.game_hash == game.game_hash, GameEvent.sequence <= game.last_event_sequence)
        .order_by(GameEvent.sequence)
    )
    return {
        **state,
        "events": [
            {
                **event.payload_json,
                "id": event.event_id,
                "type": event.event_type,
                "at": int((event.event_at if event.event_at.tzinfo else event.event_at.replace(tzinfo=UTC)).timestamp() * 1000),
            }
            for event in events
        ],
    }

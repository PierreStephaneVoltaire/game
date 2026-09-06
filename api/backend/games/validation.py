from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any

from backend.config import get_settings
from backend.errors import ApiError

from .schemas import EventInput, GameWrite

def canonical_json(value: Any) -> str:
    try:
        return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    except (TypeError, ValueError) as error:
        raise ApiError(400, "INVALID_REQUEST", "The request must contain JSON values.") from error


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


def validate_write(write: GameWrite, previous_sequence: int, previous_event_id: str | None) -> None:
    settings = get_settings()
    if len(write.events) > settings.max_events_per_batch:
        raise ApiError(400, "INVALID_REQUEST", "A batch can contain at most 500 events.")
    if len(canonical_json(write.target_state).encode()) > settings.max_state_bytes:
        raise ApiError(400, "INVALID_REQUEST", "Game state is too large.")
    if write.previous_event_id != previous_event_id:
        raise ApiError(412, "STALE_STATE", "The game event cursor is stale.")
    expected = previous_sequence + 1
    event_ids: set[str] = set()
    event_at: datetime | None = None
    for event in write.events:
        if event.sequence != expected:
            raise ApiError(409, "EVENT_CONFLICT", "Event sequences must be contiguous.")
        if event.event_id in event_ids:
            raise ApiError(409, "EVENT_CONFLICT", "Event IDs must be unique.")
        if len(canonical_json(event.payload).encode()) > settings.max_event_bytes:
            raise ApiError(400, "INVALID_REQUEST", "An event is too large.")
        if event_at and event.event_at < event_at:
            raise ApiError(409, "EVENT_CONFLICT", "Event timestamps must not decrease.")
        event_ids.add(event.event_id)
        event_at = event.event_at
        expected += 1


def validate_death_state(state: dict[str, Any], cause_event_id: str, known_event_ids: set[str]) -> None:
    ending = state.get("ending")
    if not isinstance(ending, dict) or ending.get("kind") != "death":
        raise ApiError(400, "INVALID_REQUEST", "A death commit requires a terminal death state.")
    if cause_event_id not in known_event_ids:
        raise ApiError(400, "INVALID_REQUEST", "The death cause must reference a game event.")

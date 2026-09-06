from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class WireModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="forbid")


class EventInput(WireModel):
    sequence: int = Field(ge=1)
    event_id: str = Field(alias="eventId", min_length=1, max_length=128)
    event_type: str = Field(alias="eventType", min_length=1, max_length=128)
    event_at: datetime = Field(alias="eventAt")
    payload: dict[str, Any]


class GameWrite(WireModel):
    batch_id: str = Field(alias="batchId", min_length=1, max_length=128)
    previous_event_id: str | None = Field(alias="previousEventId", default=None, max_length=128)
    target_state: dict[str, Any] = Field(alias="targetState")
    events: list[EventInput] = Field(default_factory=list, max_length=500)


class CreateGame(WireModel):
    game_hash: str = Field(alias="gameHash", pattern=r"^\d{8}$")
    state_schema_version: int = Field(alias="stateSchemaVersion", ge=1)
    state: dict[str, Any]
    events: list[EventInput] = Field(default_factory=list, max_length=500)


class DeathWrite(GameWrite):
    cause_event_id: str = Field(alias="causeEventId", min_length=1, max_length=128)


class GameResponse(WireModel):
    game_hash: str = Field(alias="gameHash")
    life_status: str = Field(alias="lifeStatus")
    state_version: int = Field(alias="stateVersion")
    state_schema_version: int = Field(alias="stateSchemaVersion")
    content_version: str = Field(alias="contentVersion")
    last_event_sequence: int = Field(alias="lastEventSequence")
    last_event_id: str | None = Field(alias="lastEventId")
    state: dict[str, Any]
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")
    died_at: datetime | None = Field(alias="diedAt")


class BatchAcknowledgement(WireModel):
    game_hash: str = Field(alias="gameHash")
    state_version: int = Field(alias="stateVersion")
    committed_through_sequence: int = Field(alias="committedThroughSequence")
    committed_through_event_id: str | None = Field(alias="committedThroughEventId")
    etag: str
    server_now: datetime = Field(alias="serverNow")


class Page(WireModel):
    items: list[dict[str, Any]]
    continuation_token: str | None = Field(alias="continuationToken", default=None)

from __future__ import annotations

import math
from typing import Annotated, Any, Literal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

Identifier = Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")]
Version = Annotated[str, StringConstraints(pattern=r"^[A-Za-z0-9_.:-]{1,128}$")]
Timestamp = Annotated[int, Field(ge=0, le=8_640_000_000_000_000)]
FORBIDDEN_KEYS = {"__proto__", "prototype", "constructor", "username", "email", "cookie", "authorization", "password", "token", "access_token", "refresh_token", "userid", "user_id"}


def validate_value(value: Any, depth: int = 0) -> None:
    if depth > 64:
        raise ValueError("Trace nesting exceeds the limit")
    if isinstance(value, float) and not math.isfinite(value):
        raise ValueError("Trace numbers must be finite")
    if isinstance(value, int) and not isinstance(value, bool) and abs(value) > 9_007_199_254_740_991:
        raise ValueError("Trace integer exceeds safe precision")
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str) or key.lower() in FORBIDDEN_KEYS or len(key) > 512:
                raise ValueError("Invalid trace key")
            validate_value(item, depth + 1)
    elif isinstance(value, list):
        for item in value:
            validate_value(item, depth + 1)
    elif value is not None and not isinstance(value, (str, int, float, bool)):
        raise ValueError("Invalid trace value")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    @field_validator("schemaVersion", mode="before", check_fields=False)
    @classmethod
    def strict_version(cls, value):
        if type(value) is not int:
            raise ValueError("Schema version must be an integer")
        return value


class Summary(StrictModel):
    stateVersion: Annotated[int, Field(ge=0, le=9_007_199_254_740_991)]
    balance: Annotated[float, Field(allow_inf_nan=False)]
    endingKind: Version | None
    commandType: Version | None
    accepted: bool | None


class FragmentData(StrictModel):
    path: Annotated[list[str | int], Field(max_length=64)]
    value: Any
    appendText: Literal[True] | None = None

    @model_validator(mode="after")
    def valid_fragment(self):
        for key in self.path:
            if isinstance(key, str) and (key.lower() in FORBIDDEN_KEYS or len(key) > 512):
                raise ValueError("Invalid trace path")
            if isinstance(key, int) and (isinstance(key, bool) or not 0 <= key <= 9_007_199_254_740_991):
                raise ValueError("Invalid trace index")
        if self.path and self.path[0] not in {"input", "outcome", "checkpoint", "changes", "calculations"}:
            raise ValueError("Invalid trace root")
        if self.appendText and not isinstance(self.value, str):
            raise ValueError("Text fragments must contain text")
        validate_value(self.value)
        return self


class Fragment(StrictModel):
    schemaVersion: Literal[1]
    streamId: Identifier
    operationId: Identifier
    parentId: Identifier | None
    sequence: Annotated[int, Field(ge=1, le=9_007_199_254_740_991)]
    gameHash: Annotated[str, StringConstraints(pattern=r"^[0-9]{8}$")]
    runStartedAt: Timestamp
    mode: Literal["realtime", "streaming"]
    timezone: Annotated[str, StringConstraints(min_length=1, max_length=128)]
    simulationAt: Timestamp
    recordedAt: Timestamp
    engineBuild: Annotated[str, StringConstraints(pattern=r"^[0-9a-f]{64}$")]
    contentVersion: Version
    kind: Literal["run_initialized", "checkpoint", "command", "clock_reconciled", "save_confirmed", "save_conflict", "command_replay", "replay_applied", "replay_superseded", "run_ended"]
    summary: Summary
    part: Annotated[int, Field(ge=0, le=9_007_199_254_740_990)]
    parts: Annotated[int, Field(ge=1, le=9_007_199_254_740_991)]
    data: Annotated[list[FragmentData], Field(min_length=1, max_length=1000)]

    @model_validator(mode="after")
    def valid_metadata(self):
        if self.part >= self.parts:
            raise ValueError("Invalid fragment order")
        try:
            ZoneInfo(self.timezone)
        except ZoneInfoNotFoundError as error:
            raise ValueError("Invalid timezone") from error
        return self


class Batch(StrictModel):
    schemaVersion: Literal[1]
    batchId: Identifier
    records: Annotated[list[Fragment], Field(min_length=1, max_length=1000)]

    @model_validator(mode="after")
    def unique_fragments(self):
        identifiers = [(record.streamId, record.operationId, record.part) for record in self.records]
        if len(identifiers) != len(set(identifiers)):
            raise ValueError("Duplicate fragment")
        return self

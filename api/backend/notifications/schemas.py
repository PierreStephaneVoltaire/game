from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from backend.auth.schemas import camel


class NotificationPreference(BaseModel):
    model_config = ConfigDict(extra="forbid", alias_generator=camel, populate_by_name=True)
    discord_dm: bool

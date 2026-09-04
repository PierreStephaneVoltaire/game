"""Public wire schemas for immutable runtime-content bundles."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class RuntimeContentBundle(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: int = Field(gt=0)
    version: str = Field(pattern=r"^[0-9a-f]{64}$")
    shop_items: list[dict[str, Any]]
    activity_rules: dict[str, Any]
    ending_rules: dict[str, Any]
    event_texts: dict[str, Any]
    financial_rules: dict[str, Any]
    life_events: dict[str, Any]
    pet_profile: dict[str, Any]
    simulation_rules: dict[str, Any]


class ContentManifest(BaseModel):
    version: str = Field(pattern=r"^[0-9a-f]{64}$")
    schema_version: int = Field(gt=0)


class ContentBundleResponse(RuntimeContentBundle):
    pass

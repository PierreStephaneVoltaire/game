"""Build a canonical content bundle from the JSON authoring source."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
from subprocess import run
from typing import Any

from backend.content.schemas import RuntimeContentBundle

DOCUMENTS = (
    "activity_rules",
    "ending_rules",
    "event_texts",
    "financial_rules",
    "life_events",
    "pet_profile",
    "simulation_rules",
)


def canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def load_bundle(
    repository_root: Path,
    schema_version: int = 1,
    validate: bool = True,
    max_bytes: int | None = None,
) -> RuntimeContentBundle:
    if validate:
        run(["pnpm", "validate:data"], cwd=repository_root, check=True)
    data_root = repository_root / "src" / "lib" / "data"
    values: dict[str, Any] = {
        name: json.loads((data_root / f"{name.replace('_', '-')}.json").read_text())
        for name in DOCUMENTS
    }
    shop_items = json.loads((data_root / "shop-items.json").read_text())
    if not isinstance(shop_items, list) or not all(
        isinstance(item, dict) and isinstance(item.get("id"), str) for item in shop_items
    ):
        raise ValueError("shop-items.json must contain identified item objects.")
    raw = {"schema_version": schema_version, "shop_items": shop_items, **values}
    version = hashlib.sha256(canonical_json(raw).encode()).hexdigest()
    bundle = RuntimeContentBundle.model_validate({"version": version, **raw})
    limit = max_bytes if max_bytes is not None else int(os.getenv("CONTENT_BUNDLE_MAX_BYTES", "2097152"))
    if limit < 1:
        raise ValueError("CONTENT_BUNDLE_MAX_BYTES must be positive.")
    if len(canonical_json(bundle.model_dump()).encode()) > limit:
        raise ValueError(f"Runtime content bundle exceeds the {limit}-byte limit.")
    return bundle

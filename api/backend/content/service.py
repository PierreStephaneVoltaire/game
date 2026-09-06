"""Content reads, publication, and request-version enforcement."""

from __future__ import annotations

import json
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from backend.errors import ApiError

from .models import ContentPointer, ContentVersion
from .schemas import ContentManifest, RuntimeContentBundle

CURRENT_POINTER = "current"
CONTENT_VERSION_HEADER = "X-Content-Version"


def canonical_json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def current_content(session: Session) -> ContentVersion | None:
    pointer = session.get(ContentPointer, CURRENT_POINTER)
    return session.get(ContentVersion, pointer.version) if pointer else None


def content_manifest(session: Session) -> ContentManifest:
    current = current_content(session)
    if current is None:
        raise ApiError(503, "CONTENT_UNAVAILABLE", "Runtime content is not published.")
    return ContentManifest(version=current.version, schema_version=current.schema_version)


def immutable_bundle(session: Session, version: str) -> RuntimeContentBundle:
    row = session.get(ContentVersion, version)
    if row is None:
        raise ApiError(404, "CONTENT_NOT_FOUND", "Runtime content was not found.")
    return RuntimeContentBundle.model_validate_json(row.bundle_json)


def require_current_content_version(supplied: str | None, session: Session) -> str:
    """Reject game-data requests made against an old or missing definition."""
    current = current_content(session)
    if current is None:
        raise ApiError(503, "CONTENT_UNAVAILABLE", "Runtime content is not published.")
    if supplied != current.version:
        raise ApiError(
            409,
            "CONTENT_VERSION_OUTDATED",
            "Runtime content has changed.",
            latestVersion=current.version,
        )
    return current.version


def publish_bundle(session: Session, bundle: RuntimeContentBundle) -> str:
    """Insert an immutable bundle and move the one production pointer atomically."""
    payload = canonical_json(bundle.model_dump())
    existing = session.get(ContentVersion, bundle.version)
    if existing is not None:
        if existing.bundle_json != payload:
            raise ValueError("Content version already exists with different bytes.")
    else:
        session.add(
            ContentVersion(
                version=bundle.version,
                schema_version=bundle.schema_version,
                bundle_json=payload,
                item_count=len(bundle.shop_items),
                published_at=datetime.now(UTC),
            )
        )
        session.flush()
    now = datetime.now(UTC)
    pointer = session.get(ContentPointer, CURRENT_POINTER)
    if pointer is None:
        session.add(ContentPointer(name=CURRENT_POINTER, version=bundle.version, updated_at=now))
    else:
        pointer.version = bundle.version
        pointer.updated_at = now
    return bundle.version

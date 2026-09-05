from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from backend.content.models import ContentPointer, ContentVersion
from backend.content.schemas import RuntimeContentBundle
from backend.content.service import (
    canonical_json,
    current_content,
    publish_bundle,
    require_current_content_version,
)
from backend.database import Base
from backend.errors import ApiError
from tools.global_content_publisher.bundle import load_bundle


def bundle(version: str) -> RuntimeContentBundle:
    return RuntimeContentBundle(
        version=version,
        schema_version=1,
        shop_items=[],
        activity_rules={},
        ending_rules={},
        event_texts={},
        financial_rules={},
        life_events={},
        pet_profile={},
        simulation_rules={
            "statRange": {"min": 0, "max": 10},
            "startingMetrics": {
                "food": 6,
                "health": 24,
                "mood": 6,
                "rest": 7,
                "bond": 4,
                "creativity": 3,
            },
            "startingCurrency": 60,
            "startingInventory": {},
        },
    )


@pytest.fixture()
def session() -> Session:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as value:
        yield value


def test_canonical_json_is_stable() -> None:
    assert canonical_json({"b": 1, "a": [2]}) == canonical_json({"a": [2], "b": 1})


def test_publish_moves_the_only_pointer_and_is_idempotent(session: Session) -> None:
    first = bundle("a" * 64)
    with session.begin():
        assert publish_bundle(session, first) == first.version
    with session.begin():
        assert publish_bundle(session, first) == first.version
    assert session.query(ContentVersion).count() == 1
    assert current_content(session).version == first.version


def test_existing_version_with_different_bytes_is_rejected(session: Session) -> None:
    with session.begin():
        publish_bundle(session, bundle("a" * 64))
    changed = bundle("a" * 64)
    changed.activity_rules["changed"] = True
    with pytest.raises(ValueError), session.begin():
        publish_bundle(session, changed)
    assert session.get(ContentPointer, "current").version == "a" * 64


def test_outdated_header_returns_the_current_version(session: Session) -> None:
    with session.begin():
        publish_bundle(session, bundle("b" * 64))
    with pytest.raises(ApiError) as raised:
        require_current_content_version("a" * 64, session)
    assert raised.value.code == "CONTENT_VERSION_OUTDATED"
    assert raised.value.details["latestVersion"] == "b" * 64


def test_publisher_rejects_an_oversized_bundle() -> None:
    repository_root = Path(__file__).parents[3]
    with pytest.raises(ValueError, match="exceeds"):
        load_bundle(repository_root, validate=False, max_bytes=1)

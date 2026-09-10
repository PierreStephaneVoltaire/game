import asyncio
import json
from pathlib import Path
from unittest.mock import Mock

import azure.functions as func
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from backend.content import routes
from backend.content.models import CompanionQuotePool
from backend.content.quotes import read_quotes, replace_quotes, validate_quotes
from backend.database import Base
from backend.errors import ApiError
from tools.global_content_publisher import quotes as importer


@pytest.fixture()
def session():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


def test_replace_removes_omitted_pools_and_is_repeatable(session):
    replace_quotes(session, {"idle": ["old"], "click": ["old click"]})
    replacement = {"click": ["new", "unchanged punctuation…"], "feed": []}
    replace_quotes(session, replacement)
    replace_quotes(session, replacement)
    assert read_quotes(session) == replacement
    assert session.query(CompanionQuotePool).count() == 2


@pytest.mark.parametrize("value", [[], None, {"click": "text"}, {"click": [1]}, {"click": [" "]}, {"bad key": ["text"]}])
def test_invalid_input_retains_published_quotes(session, value):
    replace_quotes(session, {"idle": ["retained"]})
    with pytest.raises(ValueError):
        replace_quotes(session, value)
    assert read_quotes(session) == {"idle": ["retained"]}


def test_database_failure_rolls_back_the_entire_replacement(session):
    replace_quotes(session, {"idle": ["retained"]})

    def fail(*args):
        raise RuntimeError("test failure")

    event.listen(session, "before_flush", fail, once=True)
    with pytest.raises(RuntimeError, match="test failure"):
        replace_quotes(session, {"click": ["replacement"]})
    assert read_quotes(session) == {"idle": ["retained"]}


def test_override_keys_support_catalogue_ids_starting_with_numbers():
    pools = {"feed:water": [], "item_action:3d-printer:print": ["test"]}
    assert validate_quotes(pools) == pools


@pytest.mark.parametrize("contents", [None, '{"click":', '{"click":[],"click":[]}', '{"click":[null]}'])
def test_import_failure_never_replaces_quotes(tmp_path, monkeypatch, contents):
    path = tmp_path / "quotes.json"
    if contents is not None:
        path.write_text(contents)
    monkeypatch.setattr("sys.argv", ["quotes", str(path)])
    replacement = Mock()
    monkeypatch.setattr(importer, "replace_quotes", replacement)
    if contents == '{"click":[null]}':
        replacement.side_effect = ValueError("invalid")
    monkeypatch.setattr(importer, "get_session_factory", lambda: sessionmaker(create_engine("sqlite://")))
    with pytest.raises(SystemExit) as error:
        importer.main()
    assert error.value.code == 1
    if contents != '{"click":[null]}':
        replacement.assert_not_called()


@pytest.mark.parametrize("authenticated", [False, True])
def test_quote_endpoint_requires_authentication(monkeypatch, session, authenticated):
    replace_quotes(session, {"click": ["test quote"]})
    monkeypatch.setattr(routes, "get_session_factory", lambda: sessionmaker(session.bind))

    def require_user(request, db):
        if not authenticated:
            raise ApiError(401, "UNAUTHORIZED", "Sign in to continue.")

    monkeypatch.setattr(routes, "require_user", require_user)
    response = json.loads(asyncio.run(routes.get_quotes(func.HttpRequest("GET", "https://example.test/api/content/quotes", body=b""))))
    assert response["statusCode"] == (200 if authenticated else 401)
    if authenticated:
        assert json.loads(response["body"]) == {"click": ["test quote"]}


def test_deployment_imports_uploaded_quotes_after_schema_setup_and_before_deploy():
    workflow = (Path(__file__).parents[3] / ".github/workflows/azure-static-web-app.yml").read_text()
    assert workflow.index("python -m tools.setup_api_database") < workflow.index("az storage blob download")
    assert workflow.index("az storage blob download") < workflow.index("python -m tools.global_content_publisher.quotes") < workflow.index("- name: Deploy prebuilt frontend")
    assert "--auth-mode login" in workflow

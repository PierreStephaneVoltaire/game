import asyncio
import json
import inspect
from typing import get_type_hints

import azure.functions as func

from function_app import app, health

functions = app.get_functions()


def test_each_route_is_a_native_function() -> None:
    names = {function.get_function_name() for function in functions}
    assert names == {
        "create_game",
        "discord_callback",
        "discord_complete",
        "discord_link",
        "discord_login",
        "game_events",
        "get_bundle",
        "get_game",
        "get_grave",
        "get_manifest",
        "health",
        "list_games",
        "list_graves",
        "login",
        "logout",
        "me",
        "password",
        "record_death",
        "register",
        "reset",
        "write_game",
    }


def test_native_function_response_envelope() -> None:
    request = func.HttpRequest("GET", "https://example.test/api/health", body=b"")
    response = asyncio.run(health(request))
    assert response.status_code == 200
    assert json.loads(response.get_body()) == {"status": "ok"}
    assert response.headers["x-request-id"]


def test_worker_binding_signatures_match_every_function() -> None:
    for function in functions:
        handler = function.get_user_function()
        bindings = json.loads(function.get_function_json())["bindings"]
        inputs = {binding["name"] for binding in bindings if binding["direction"] == "IN"}
        assert set(inspect.signature(handler).parameters) == inputs
        hints = get_type_hints(handler)
        assert hints["req"] is func.HttpRequest
        assert hints["return"] is func.HttpResponse

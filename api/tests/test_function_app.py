import asyncio
import json

import azure.functions as func

from function_app import app, health


def test_each_route_is_a_native_function() -> None:
    names = {function.get_function_name() for function in app.get_functions()}
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

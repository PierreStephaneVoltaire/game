import asyncio
import json
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlencode, urlsplit

import azure.functions as func
from azure.functions.http import HttpResponseConverter
import httpx
import pytest

from backend.auth import discord, routes
from backend.http import cookie_header, endpoint, json_response


@pytest.mark.parametrize("name,value,max_age", [
    ("session", "session.secret", 3600),
    ("discord_oauth", "signed-state", 600),
    ("session", "", 0),
])
def test_cookie_stays_in_http_headers_through_the_python_worker(name, value, max_age):
    @endpoint
    def handler(request):
        return json_response({"ok": True}, headers={
            "Set-Cookie": cookie_header(name, value, max_age=max_age, secure=True),
        })

    request = func.HttpRequest("GET", "https://example.test/api/login", body=b"")
    wire = HttpResponseConverter.encode(asyncio.run(handler(request)), expected_type=str)
    assert wire.type == "string"
    response = json.loads(wire.value)
    cookie = SimpleCookie(response["headers"]["Set-Cookie"])[name]
    assert cookie.value == value
    assert cookie["max-age"] == str(max_age)
    assert cookie["httponly"] and cookie["secure"]
    assert cookie["samesite"] == "Lax" and cookie["path"] == "/"
    assert response["headers"]["Cache-Control"] == "no-store"


def test_discord_code_exchange_uses_public_callback_and_validates_cookie(monkeypatch):
    callback = "https://preview.example.test/api/auth/discord/callback"
    location, signed_state = discord.begin("client", "secret", callback, "login", "signing")
    state = parse_qs(urlsplit(location).query)["state"][0]
    calls = []

    def provider(request):
        calls.append(request.url.path)
        if request.url.path == "/api/oauth2/token":
            form = parse_qs(request.content.decode())
            assert form["code"] == ["one-time-code"]
            assert form["redirect_uri"] == [callback]
            return httpx.Response(200, json={"access_token": "test-token", "token_type": "Bearer"})
        assert request.headers["authorization"] == "Bearer test-token"
        return httpx.Response(200, json={"id": "123456", "username": "discord_player"})

    client_class = discord.AsyncOAuth2Client
    monkeypatch.setattr(discord, "AsyncOAuth2Client", lambda *args, **kwargs: client_class(
        *args, **kwargs, transport=httpx.MockTransport(provider),
    ))
    internal_url = "http://internal-host/api/auth/discord/callback?" + urlencode({"state": state, "code": "one-time-code"})
    result = asyncio.run(discord.profile("client", "secret", callback, internal_url, signed_state, "signing"))
    assert result == ("123456", {"id": "123456", "username": "discord_player"}, "login")
    assert calls == ["/api/oauth2/token", "/api/users/@me"]
    calls.clear()
    with pytest.raises(ValueError, match="state is invalid"):
        asyncio.run(discord.profile("client", "secret", callback, internal_url, "", "signing"))
    assert calls == []


def test_oauth_failure_logs_request_id_without_cookie_or_authorization_code(caplog):
    request = func.HttpRequest("GET", "https://example.test/api/auth/discord/callback?code=private-code",
                              headers={"x-request-id": "oauth-request-123", "Cookie": "discord_oauth=private-cookie"},
                              body=b"")
    response = json.loads(asyncio.run(routes.discord_callback(request)))
    assert response["statusCode"] == 400
    assert json.loads(response["body"])["error"]["code"] == "OAUTH_FAILED"
    assert "oauth-request-123" in caplog.text and "cause=ValueError" in caplog.text
    assert "private-code" not in caplog.text and "private-cookie" not in caplog.text


def test_unhandled_exception_does_not_log_game_key_or_state(caplog):
    @endpoint
    def handler(request):
        raise RuntimeError("SQL parameters: game_key=00421873 state=private-state")

    request = func.HttpRequest("GET", "https://example.test/api/games/current", body=b"")
    response = json.loads(asyncio.run(handler(request)))
    assert response["statusCode"] == 500
    assert "cause=RuntimeError" in caplog.text
    assert "00421873" not in caplog.text and "private-state" not in caplog.text

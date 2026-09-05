from __future__ import annotations

import secrets
from urllib.parse import parse_qs, urlsplit

from authlib.integrations.httpx_client import AsyncOAuth2Client
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

AUTHORIZE_URL = "https://discord.com/api/oauth2/authorize"
TOKEN_URL = "https://discord.com/api/oauth2/token"
PROFILE_URL = "https://discord.com/api/users/@me"


def _client(
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    state: str | None = None,
) -> AsyncOAuth2Client:
    return AsyncOAuth2Client(
        client_id,
        client_secret,
        redirect_uri=redirect_uri,
        scope="identify email",
        state=state,
    )


def begin(
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    mode: str,
    signing_secret: str,
) -> tuple[str, str]:
    url, state = _client(client_id, client_secret, redirect_uri).create_authorization_url(
        AUTHORIZE_URL
    )
    signed_state = URLSafeTimedSerializer(signing_secret, salt="discord-oauth").dumps(
        {"state": state, "mode": mode}
    )
    return url, signed_state


async def profile(
    client_id: str,
    client_secret: str,
    redirect_uri: str,
    callback_url: str,
    signed_state: str,
    signing_secret: str,
) -> tuple[str, dict[str, object], str]:
    try:
        state = URLSafeTimedSerializer(signing_secret, salt="discord-oauth").loads(
            signed_state,
            max_age=600,
        )
    except (BadSignature, SignatureExpired) as error:
        raise ValueError("Discord OAuth state is invalid") from error
    if not isinstance(state, dict) or state.get("mode") not in {"login", "link"}:
        raise ValueError("Discord OAuth state is invalid")
    supplied_state = parse_qs(urlsplit(callback_url).query).get("state", [""])[0]
    expected_state = str(state.get("state", ""))
    if not expected_state or not secrets.compare_digest(supplied_state, expected_state):
        raise ValueError("Discord OAuth state is invalid")
    async with _client(client_id, client_secret, redirect_uri, expected_state) as client:
        await client.fetch_token(TOKEN_URL, authorization_response=callback_url)
        response = await client.get(PROFILE_URL)
        response.raise_for_status()
    data = response.json()
    discord_id = data.get("id") if isinstance(data, dict) else None
    if not isinstance(discord_id, str) or not discord_id.isdecimal():
        raise ValueError("Discord did not return an identity")
    return discord_id, data, str(state.get("mode", "login"))

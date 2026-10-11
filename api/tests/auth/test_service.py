from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

from itsdangerous import URLSafeTimedSerializer
import pytest
from sqlalchemy import create_engine

from backend.auth.discord import begin
from sqlalchemy.orm import Session

from backend.auth.models import Base, DiscordIdentity, User
from backend.auth.service import AuthProblem, AuthService
from backend.auth.sessions import current


def service() -> tuple[Session, AuthService]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    db = Session(engine)
    return db, AuthService(db)


def test_test_session_requires_the_secret_and_stores_only_a_hashed_session_secret() -> None:
    db, auth = service()
    with pytest.raises(AuthProblem, match="Sign in"):
        auth.test_session("admin", "wrong-secret", "ci-secret", "127.0.0.1")
    with pytest.raises(AuthProblem, match="Sign in"):
        auth.test_session("admin", "ci-secret", "", "127.0.0.1")
    user, cookie = auth.test_session("admin", "ci-secret", "ci-secret", "127.0.0.1")
    assert user.username == "admin"
    assert current(db, cookie) is not None
    assert current(db, "not-a-session") is None
    again, _ = auth.test_session("admin", "ci-secret", "ci-secret", "127.0.0.1")
    assert again.user_id == user.user_id


def test_discord_authorization_uses_authlib_and_signed_state() -> None:
    location, signed_state = begin(
        "client-id",
        "client-secret",
        "https://example.test/api/auth/discord/callback",
        "login",
        "signing-secret",
    )
    query_state = parse_qs(urlsplit(location).query)["state"][0]
    stored = URLSafeTimedSerializer("signing-secret", salt="discord-oauth").loads(
        signed_state,
        max_age=600,
    )
    assert stored == {"state": query_state, "mode": "login"}


def test_discord_signup_uses_provider_username_and_login_keeps_existing_account() -> None:
    db, auth = service()
    user, cookie, onboarding = auth.resolve_discord("1234", {"username": "Discord_Player"})
    assert user.username == "discord_player"
    assert user.providers == ["discord"]
    assert current(db, cookie).user_id == user.user_id
    assert onboarding is None
    returning, cookie, onboarding = auth.resolve_discord("1234", {"username": "renamed_player"})
    assert returning == user
    assert current(db, cookie).user_id == user.user_id
    assert onboarding is None


@pytest.mark.parametrize("name", ["taken_name", "a.b", "ab", "a" * 25, None])
def test_discord_signup_falls_back_without_linking_a_matching_username(name) -> None:
    db, auth = service()
    existing = User(username="taken_name")
    db.add(existing)
    db.commit()
    user, cookie, onboarding = auth.resolve_discord("1234", {"username": name})
    assert user is None and cookie is None and onboarding
    assert db.get(DiscordIdentity, "1234") is None
    created, cookie = auth.complete_onboarding(onboarding, "another_name")
    assert created.user_id != existing.id
    assert current(db, cookie).user_id == created.user_id
    assert db.get(DiscordIdentity, "1234").user_id == created.user_id

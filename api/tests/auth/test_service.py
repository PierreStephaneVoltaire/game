from __future__ import annotations

from urllib.parse import parse_qs, urlsplit

from itsdangerous import URLSafeTimedSerializer
from sqlalchemy import create_engine, select

from backend.auth.discord import begin
from sqlalchemy.orm import Session

from backend.auth.models import Base, PasswordReset, User
from backend.auth.service import AuthProblem, AuthService
from backend.auth.sessions import current


def service() -> tuple[Session, AuthService]:
    engine = create_engine("sqlite+pysqlite:///:memory:")
    Base.metadata.create_all(engine)
    db = Session(engine)
    return db, AuthService(db)


def test_password_account_stores_only_a_hashed_session_secret() -> None:
    db, auth = service()
    user, cookie = auth.register("player_1", "correct horse battery staple", None, "127.0.0.1")
    assert user.username == "player_1"
    assert "correct horse battery staple" not in db.get(User, user.user_id).password_hash
    assert current(db, cookie) is not None
    assert current(db, "not-a-session") is None


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


def test_login_failure_is_generic_for_missing_user_and_wrong_password() -> None:
    db, auth = service()
    auth.register("player_1", "correct horse battery staple", None, "register")
    failures = []
    for username in ("missing", "player_1"):
        try:
            auth.login(username, "wrong password", username)
        except AuthProblem as error:
            failures.append((error.code, error.status, error.message))
    assert failures == [failures[0], failures[0]]


def test_reset_is_single_use_and_revokes_all_sessions() -> None:
    db, auth = service()
    user, old_cookie = auth.register("player_1", "correct horse battery staple", "discord:123", "127.0.0.1")
    token = auth.issue_reset("player_1", "admin")
    auth.consume_reset(token, "another correct horse battery staple")
    assert current(db, old_cookie) is None
    assert db.scalar(select(PasswordReset).where(PasswordReset.user_id == user.user_id)).used_at is not None
    try:
        auth.consume_reset(token, "third correct horse battery staple")
    except AuthProblem as error:
        assert error.code == "RESET_TOKEN_INVALID"
    else:
        raise AssertionError("used reset token was accepted")

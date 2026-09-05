"""Run against an initialized PostgreSQL test database; all writes roll back."""

import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from backend.auth.models import OAuthOnboarding, PasswordReset, Session as AuthSession
from backend.auth.service import AuthProblem, AuthService
from backend.auth.sessions import current
from backend.content.service import current_content
from backend.games.schemas import CreateGame, GameWrite
from backend.games.service import GameService
from tools.global_content_publisher.bundle import load_bundle
from tools.global_content_publisher.publisher import publish


@pytest.mark.skipif(not os.getenv("TEST_POSTGRES_URL"), reason="TEST_POSTGRES_URL is not configured")
def test_postgres_auth_content_and_game_round_trip():
    engine = create_engine(os.environ["TEST_POSTGRES_URL"])
    bundle = load_bundle(Path(__file__).parents[2], validate=False)
    try:
        with engine.connect() as connection, connection.begin() as transaction:
            with Session(connection, expire_on_commit=False, autoflush=False,
                         join_transaction_mode="create_savepoint") as session:
                assert publish(session, bundle) == bundle.version
                assert current_content(session).version == bundle.version
                session.commit()
                auth = AuthService(session)
                user, cookie = auth.register("postgres_player", "correct horse battery staple", None, "test")
                session.expire_all()
                assert current(session, cookie) is not None
                reset = auth.issue_reset(user.username, "test")
                session.expire_all()
                auth.consume_reset(reset, "new correct horse battery staple")
                assert current(session, cookie) is None
                with pytest.raises(AuthProblem, match="invalid or expired"):
                    auth.consume_reset(reset, "unused")
                _, new_cookie = auth.login(user.username, "new correct horse battery staple", "test")
                expired_session = session.scalar(select(AuthSession))
                expired_session.expires_at = datetime.now(UTC) - timedelta(seconds=1)
                session.commit()
                session.expire_all()
                assert current(session, new_cookie) is None
                reset = auth.issue_reset(user.username, "test")
                session.scalar(select(PasswordReset).where(PasswordReset.used_at.is_(None))).expires_at = datetime.now(UTC) - timedelta(seconds=1)
                session.commit()
                session.expire_all()
                with pytest.raises(AuthProblem, match="invalid or expired"):
                    auth.consume_reset(reset, "unused")
                onboarding = auth.create_onboarding("1234", {"username": "discord_player"})
                session.expire_all()
                auth.complete_onboarding(onboarding, "discord_player")
                onboarding = auth.create_onboarding("5678", {})
                session.scalar(select(OAuthOnboarding).where(OAuthOnboarding.consumed_at.is_(None))).expires_at = datetime.now(UTC) - timedelta(seconds=1)
                session.commit()
                session.expire_all()
                with pytest.raises(AuthProblem, match="expired"):
                    auth.complete_onboarding(onboarding, "expired_player")
                session.commit()

                games = GameService()
                games.create(session, user.user_id, bundle.version, CreateGame(
                    gameHash="00421873", stateSchemaVersion=1, state={"ending": None},
                    events=[{"sequence": 1, "eventId": "initial", "eventType": "care",
                             "eventAt": "2026-09-03T12:00:00Z", "payload": {"value": 1}}],
                ))
                write = GameWrite(batchId="batch-1", previousEventId="initial",
                                  targetState={"ending": None, "value": 2}, events=[])
                result = games.write(session, user.user_id, bundle.version, "00421873", 0, write)
                session.expire_all()
                assert games.write(session, user.user_id, bundle.version, "00421873", 0, write) == result
                assert games.get(session, user.user_id, "00421873")["state"]["value"] == 2
                assert games.events(session, user.user_id, "00421873", 0, 25)[0]["payload"] == {"value": 1}
            transaction.rollback()
    finally:
        engine.dispose()

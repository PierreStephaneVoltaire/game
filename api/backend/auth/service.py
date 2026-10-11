from __future__ import annotations

import hashlib
import json
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import AuthAttempt, DiscordIdentity, OAuthOnboarding, Session as AuthSession, User, is_expired, utcnow
from .schemas import SafeUser, normalized_username
from .sessions import create as create_session
from .sessions import digest


class AuthProblem(Exception):
    def __init__(self, code: str, status: int, message: str) -> None:
        self.code, self.status, self.message = code, status, message
        super().__init__(message)


def subject(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def safe_user(self, user: User) -> SafeUser:
        linked = self.db.scalar(select(DiscordIdentity.discord_user_id).where(DiscordIdentity.user_id == user.id))
        return SafeUser(user_id=user.id, username=user.username, providers=["discord"] if linked else [])

    def cleanup_expired(self) -> None:
        now = utcnow()
        self.db.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
        self.db.execute(delete(OAuthOnboarding).where(OAuthOnboarding.expires_at <= now))

    def throttle(self, scope: str, value: str, limit: int, window: timedelta) -> None:
        self.cleanup_expired()
        now = utcnow()
        start = datetime.fromtimestamp(
            int(now.timestamp() // window.total_seconds()) * window.total_seconds(), UTC
        )
        key = subject(value)
        row = self.db.get(AuthAttempt, (scope, key, start), with_for_update=True)
        if row is None:
            row = AuthAttempt(scope=scope, subject_hash=key, window_start=start, attempt_count=0)
            self.db.add(row)
            try:
                self.db.flush()
            except IntegrityError:
                self.db.rollback()
                row = self.db.get(AuthAttempt, (scope, key, start), with_for_update=True)
        if row is None:
            raise AuthProblem("RATE_LIMITED", 429, "Too many attempts. Try again later.")
        row.attempt_count += 1
        if row.attempt_count > limit:
            raise AuthProblem("RATE_LIMITED", 429, "Too many attempts. Try again later.")

    def test_session(self, username: str, secret: str, expected_secret: str, source: str) -> tuple[SafeUser, str]:
        self.throttle("test-session-source", source, 10, timedelta(minutes=15))
        if not expected_secret or not secrets.compare_digest(secret, expected_secret):
            self.db.commit()
            raise AuthProblem("UNAUTHORIZED", 401, "Sign in to continue.")
        user = self.db.scalar(select(User).where(User.username == username))
        if user is None:
            user = User(username=username)
            self.db.add(user)
            self.db.flush()
        _, token = create_session(self.db, user.id)
        self.db.commit()
        return self.safe_user(user), token

    def create_onboarding(self, discord_user_id: str, profile: dict[str, object]) -> str:
        now = utcnow()
        token = secrets.token_urlsafe(32)
        name = str(profile.get("username", ""))[:100] or None
        safe_profile = json.dumps({"id": discord_user_id, "username": name}, separators=(",", ":"))
        self.db.add(OAuthOnboarding(token_hash=digest(token), discord_user_id=discord_user_id, discord_username=name, profile_json=safe_profile, expires_at=now + timedelta(minutes=10)))
        self.db.commit()
        return token

    def complete_onboarding(self, token: str, username: str) -> tuple[SafeUser, str]:
        onboarding = self.db.get(OAuthOnboarding, digest(token), with_for_update=True)
        if onboarding is None or onboarding.consumed_at is not None or is_expired(onboarding.expires_at):
            raise AuthProblem("OAUTH_FAILED", 400, "This Discord sign-in has expired.")
        user = User(username=username)
        self.db.add(user)
        try:
            self.db.flush()
        except IntegrityError as error:
            self.db.rollback()
            raise AuthProblem("USERNAME_TAKEN", 409, "That username is already in use.") from error
        self.db.add(DiscordIdentity(discord_user_id=onboarding.discord_user_id, user_id=user.id))
        onboarding.consumed_at = utcnow()
        try:
            self.db.flush()
        except IntegrityError as error:
            self.db.rollback()
            raise AuthProblem("OAUTH_IDENTITY_LINKED", 409, "That Discord account is already linked.") from error
        _, cookie = create_session(self.db, user.id)
        self.db.commit()
        return self.safe_user(user), cookie

    def resolve_discord(self, discord_user_id: str, profile: dict[str, object]) -> tuple[SafeUser | None, str | None, str | None]:
        identity = self.db.get(DiscordIdentity, discord_user_id)
        if identity:
            user = self.db.get(User, identity.user_id)
            if user:
                _, cookie = create_session(self.db, user.id)
                self.db.commit()
                return self.safe_user(user), cookie, None
        onboarding = self.create_onboarding(discord_user_id, profile)
        name = profile.get("username")
        try:
            username = normalized_username(name if isinstance(name, str) else "")
        except ValueError:
            return None, None, onboarding
        try:
            user, cookie = self.complete_onboarding(onboarding, username)
        except AuthProblem as problem:
            if problem.code != "USERNAME_TAKEN":
                raise
            return None, None, onboarding
        return user, cookie, None

    def link_discord(self, user: User, discord_user_id: str) -> None:
        identity = self.db.get(DiscordIdentity, discord_user_id)
        if identity and identity.user_id != user.id:
            raise AuthProblem("OAUTH_IDENTITY_LINKED", 409, "That Discord account is already linked.")
        if identity is None:
            self.db.add(DiscordIdentity(discord_user_id=discord_user_id, user_id=user.id))
            try:
                self.db.commit()
            except IntegrityError as error:
                self.db.rollback()
                raise AuthProblem("OAUTH_IDENTITY_LINKED", 409, "That Discord account is already linked.") from error

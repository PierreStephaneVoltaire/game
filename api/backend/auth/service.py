from __future__ import annotations

import hashlib
import json
import secrets
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .models import AuthAttempt, DiscordIdentity, OAuthOnboarding, PasswordReset, Session as AuthSession, User
from .passwords import Passwords
from .schemas import SafeUser
from .sessions import create as create_session
from .sessions import digest, revoke_user_sessions


class AuthProblem(Exception):
    def __init__(self, code: str, status: int, message: str) -> None:
        self.code, self.status, self.message = code, status, message
        super().__init__(message)


def utcnow() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def subject(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


class AuthService:
    def __init__(self, db: Session, passwords: Passwords | None = None) -> None:
        self.db = db
        self.passwords = passwords or Passwords()

    def safe_user(self, user: User) -> SafeUser:
        linked = self.db.scalar(select(DiscordIdentity.discord_user_id).where(DiscordIdentity.user_id == user.id))
        return SafeUser(user_id=user.id, username=user.username, providers=["discord"] if linked else [], has_password=bool(user.password_hash))

    def cleanup_expired(self) -> None:
        now = utcnow()
        self.db.execute(delete(AuthSession).where(AuthSession.expires_at <= now))
        self.db.execute(delete(OAuthOnboarding).where(OAuthOnboarding.expires_at <= now))
        self.db.execute(delete(PasswordReset).where(PasswordReset.expires_at <= now))

    def throttle(self, scope: str, value: str, limit: int, window: timedelta) -> None:
        self.cleanup_expired()
        now = utcnow()
        start = datetime.fromtimestamp(
            int(now.timestamp() // window.total_seconds()) * window.total_seconds(), UTC
        ).replace(tzinfo=None)
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

    def register(self, username: str, password: str, contact_handle: str | None, source: str) -> tuple[SafeUser, str]:
        self.throttle("register-source", source, 5, timedelta(hours=1))
        user = User(username=username, password_hash=self.passwords.hash(password), contact_handle=contact_handle or None)
        self.db.add(user)
        try:
            self.db.flush()
        except IntegrityError as error:
            self.db.rollback()
            raise AuthProblem("USERNAME_TAKEN", 409, "That username is already in use.") from error
        _, token = create_session(self.db, user.id)
        self.db.commit()
        return self.safe_user(user), token

    def login(self, username: str, password: str, source: str) -> tuple[SafeUser, str]:
        self.throttle("login-source", source, 10, timedelta(minutes=15))
        self.throttle("login-username", username, 10, timedelta(minutes=15))
        user = self.db.scalar(select(User).where(User.username == username))
        matches = self.passwords.verify(
            password,
            user.password_hash if user else None,
        )
        if user is None or not matches:
            self.db.commit()
            raise AuthProblem("INVALID_CREDENTIALS", 401, "Invalid username or password.")
        _, token = create_session(self.db, user.id)
        self.db.commit()
        return self.safe_user(user), token

    def change_password(self, user: User, current_password: str | None, new_password: str) -> None:
        if user.password_hash and not self.passwords.verify(current_password or "", user.password_hash):
            raise AuthProblem("INVALID_CREDENTIALS", 401, "Invalid username or password.")
        user.password_hash = self.passwords.hash(new_password)
        self.db.commit()

    def issue_reset(self, username: str, issued_by: str) -> str:
        user = self.db.scalar(select(User).where(User.username == username))
        if user is None:
            raise AuthProblem("INVALID_REQUEST", 400, "Unknown username.")
        now = utcnow()
        self.db.execute(delete(PasswordReset).where(PasswordReset.user_id == user.id, PasswordReset.used_at.is_(None)))
        token = secrets.token_urlsafe(32)
        self.db.add(PasswordReset(token_hash=digest(token), user_id=user.id, issued_by=issued_by, expires_at=now + timedelta(hours=1)))
        self.db.commit()
        return token

    def consume_reset(self, token: str, new_password: str) -> None:
        reset = self.db.get(PasswordReset, digest(token), with_for_update=True)
        if reset is None or reset.used_at is not None or reset.expires_at <= utcnow():
            raise AuthProblem("RESET_TOKEN_INVALID", 400, "This reset link is invalid or expired.")
        user = self.db.get(User, reset.user_id)
        if user is None:
            raise AuthProblem("RESET_TOKEN_INVALID", 400, "This reset link is invalid or expired.")
        user.password_hash = self.passwords.hash(new_password)
        reset.used_at = utcnow()
        revoke_user_sessions(self.db, user.id)
        self.db.commit()

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
        if onboarding is None or onboarding.consumed_at is not None or onboarding.expires_at <= utcnow():
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
        return None, None, self.create_onboarding(discord_user_id, profile)

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

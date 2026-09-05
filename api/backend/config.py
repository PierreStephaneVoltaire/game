from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import os


def _positive_int(name: str, default: int) -> int:
    value = int(os.getenv(name, str(default)))
    if value < 1:
        raise ValueError(f"{name} must be positive")
    return value


@dataclass(frozen=True)
class Settings:
    database_url: str
    environment: str
    app_base_url: str
    session_cookie_name: str
    session_ttl_days: int
    signing_secret: str
    discord_client_id: str
    discord_client_secret: str
    discord_callback_url: str
    max_games_per_user: int
    max_events_per_game: int
    max_events_per_batch: int
    max_state_bytes: int
    max_event_bytes: int
    max_sync_attempts: int
    sync_window_seconds: int

    @property
    def secure_cookies(self) -> bool:
        return self.environment not in {"development", "test"}


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    environment = os.getenv("ENVIRONMENT", "development").lower()
    app_base_url = os.getenv("APP_BASE_URL", "http://localhost:5173").rstrip("/")
    return Settings(
        database_url=os.environ["DATABASE_URL"],
        environment=environment,
        app_base_url=app_base_url,
        session_cookie_name=os.getenv("SESSION_COOKIE_NAME", "session"),
        session_ttl_days=_positive_int("SESSION_TTL_DAYS", 30),
        signing_secret=os.getenv("SIGNING_SECRET", "local-development-only"),
        discord_client_id=os.getenv("DISCORD_CLIENT_ID", ""),
        discord_client_secret=os.getenv("DISCORD_CLIENT_SECRET", ""),
        discord_callback_url=os.getenv(
            "DISCORD_CALLBACK_URL", f"{app_base_url}/api/auth/discord/callback"
        ),
        max_games_per_user=_positive_int("MAX_GAMES_PER_USER", 20),
        max_events_per_game=_positive_int("MAX_EVENTS_PER_GAME", 50_000),
        max_events_per_batch=_positive_int("MAX_EVENTS_PER_BATCH", 500),
        max_state_bytes=_positive_int("MAX_STATE_BYTES", 262_144),
        max_event_bytes=_positive_int("MAX_EVENT_BYTES", 16_384),
        max_sync_attempts=_positive_int("MAX_SYNC_ATTEMPTS", 60),
        sync_window_seconds=_positive_int("SYNC_WINDOW_SECONDS", 300),
    )

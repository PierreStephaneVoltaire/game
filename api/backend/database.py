from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache
import os

from azure.identity import DefaultAzureCredential
from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    engine = create_engine(get_settings().database_url, pool_pre_ping=True)
    if engine.dialect.name == "postgresql" and (engine.url.host or "").endswith(
        ".postgres.database.azure.com"
    ):
        credential = DefaultAzureCredential()

        @event.listens_for(engine, "do_connect")
        def provide_token(dialect, connection_record, args, params):
            if username := os.getenv("DATABASE_USERNAME"):
                params["user"] = username
            params["password"] = credential.get_token(
                "https://ossrdbms-aad.database.windows.net/.default"
            ).token

    return engine


@lru_cache(maxsize=1)
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), autoflush=False, expire_on_commit=False)


def get_session() -> Generator[Session, None, None]:
    with get_session_factory()() as session:
        yield session


def create_schema() -> None:
    from .auth import models as auth_models  # noqa: F401
    from .content import models as content_models  # noqa: F401
    from .games import models as game_models  # noqa: F401

    Base.metadata.create_all(get_engine())


def reset_database_caches() -> None:
    get_session_factory.cache_clear()
    get_engine.cache_clear()

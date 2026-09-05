from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class Game(Base):
    __tablename__ = "games"
    __table_args__ = (
        CheckConstraint("state_version >= 0", name="ck_games_state_version"),
        CheckConstraint("last_event_sequence >= 0", name="ck_games_last_event_sequence"),
        CheckConstraint("life_status IN ('alive', 'dead')", name="ck_games_life_status"),
        Index("ix_games_owner_updated_hash", "owner_user_id", "updated_at", "game_hash"),
        Index("ix_games_owner_life_died_hash", "owner_user_id", "life_status", "died_at", "game_hash"),
    )

    game_hash: Mapped[str] = mapped_column(String(8), primary_key=True)
    owner_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    life_status: Mapped[str] = mapped_column(String(5), nullable=False, default="alive")
    state_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    state_schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    content_version: Mapped[str] = mapped_column(ForeignKey("content_versions.version"), nullable=False)
    last_event_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_event_id: Mapped[str | None] = mapped_column(String(128))
    last_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    state_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    died_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GameEvent(Base):
    __tablename__ = "game_events"
    __table_args__ = (
        UniqueConstraint("game_hash", "event_id", name="uq_game_events_game_event_id"),
        Index("ix_game_events_game_sequence", "game_hash", "sequence"),
    )

    game_hash: Mapped[str] = mapped_column(ForeignKey("games.game_hash", ondelete="CASCADE"), primary_key=True)
    sequence: Mapped[int] = mapped_column(Integer, primary_key=True)
    event_id: Mapped[str] = mapped_column(String(128), nullable=False)
    batch_id: Mapped[str] = mapped_column(String(128), nullable=False)
    event_type: Mapped[str] = mapped_column(String(128), nullable=False)
    event_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    payload_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class CommittedBatch(Base):
    __tablename__ = "committed_batches"

    game_hash: Mapped[str] = mapped_column(ForeignKey("games.game_hash", ondelete="CASCADE"), primary_key=True)
    batch_id: Mapped[str] = mapped_column(String(128), primary_key=True)
    state_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    events_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    resulting_state_version: Mapped[int] = mapped_column(Integer, nullable=False)
    committed_through_sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    committed_through_event_id: Mapped[str | None] = mapped_column(String(128))
    acknowledgement_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    committed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

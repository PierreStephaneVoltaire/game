"""SQL rows for immutable runtime-content bundles."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database import Base


class ContentVersion(Base):
    __tablename__ = "content_versions"
    __table_args__ = (
        CheckConstraint("schema_version > 0", name="ck_content_versions_schema_version"),
        CheckConstraint("item_count >= 0", name="ck_content_versions_item_count"),
    )

    version: Mapped[str] = mapped_column(String(64), primary_key=True)
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False)
    bundle_json: Mapped[str] = mapped_column(Text, nullable=False)
    item_count: Mapped[int] = mapped_column(Integer, nullable=False)
    published_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ContentPointer(Base):
    __tablename__ = "content_pointer"

    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    version: Mapped[str] = mapped_column(
        String(64), ForeignKey("content_versions.version"), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

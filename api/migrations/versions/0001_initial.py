"""Create the SQL-backed authentication, game, and content schema.

Revision ID: 0001_initial
Revises:
Create Date: 2026-09-03
"""

from collections.abc import Sequence

from alembic import op
import sqlalchemy as sa

revision: str = "0001_initial"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("username", sa.String(length=24), nullable=False),
        sa.Column("password_hash", sa.String(length=512), nullable=True),
        sa.Column("contact_handle", sa.String(length=200), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("username"),
    )
    op.create_table(
        "content_versions",
        sa.Column("version", sa.String(length=64), nullable=False),
        sa.Column("schema_version", sa.Integer(), nullable=False),
        sa.Column("bundle_json", sa.Text(), nullable=False),
        sa.Column("item_count", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("item_count >= 0", name="ck_content_versions_item_count"),
        sa.CheckConstraint("schema_version > 0", name="ck_content_versions_schema_version"),
        sa.PrimaryKeyConstraint("version"),
    )
    op.create_table(
        "auth_attempts",
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("subject_hash", sa.String(length=64), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempt_count", sa.Integer(), nullable=False),
        sa.CheckConstraint("attempt_count >= 0", name="ck_auth_attempts_count"),
        sa.PrimaryKeyConstraint("scope", "subject_hash", "window_start"),
    )
    op.create_table(
        "content_pointer",
        sa.Column("name", sa.String(length=32), nullable=False),
        sa.Column("version", sa.String(length=64), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["version"], ["content_versions.version"]),
        sa.PrimaryKeyConstraint("name"),
    )
    op.create_table(
        "discord_identities",
        sa.Column("discord_user_id", sa.String(length=32), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("discord_user_id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_table(
        "oauth_onboarding",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("discord_user_id", sa.String(length=32), nullable=False),
        sa.Column("discord_username", sa.String(length=100), nullable=True),
        sa.Column("profile_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_oauth_onboarding_discord_user_id"),
        "oauth_onboarding",
        ["discord_user_id"],
        unique=False,
    )
    op.create_table(
        "password_resets",
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("issued_by", sa.String(length=200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("token_hash"),
    )
    op.create_index(
        op.f("ix_password_resets_user_id"),
        "password_resets",
        ["user_id"],
        unique=False,
    )
    op.create_table(
        "sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("secret_hash", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("secret_hash"),
    )
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"], unique=False)
    op.create_table(
        "games",
        sa.Column("game_hash", sa.String(length=8), nullable=False),
        sa.Column("owner_user_id", sa.String(length=36), nullable=False),
        sa.Column("life_status", sa.String(length=5), nullable=False),
        sa.Column("state_version", sa.Integer(), nullable=False),
        sa.Column("state_schema_version", sa.Integer(), nullable=False),
        sa.Column("content_version", sa.String(length=64), nullable=False),
        sa.Column("last_event_sequence", sa.Integer(), nullable=False),
        sa.Column("last_event_id", sa.String(length=128), nullable=True),
        sa.Column("last_event_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("state_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("died_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("last_event_sequence >= 0", name="ck_games_last_event_sequence"),
        sa.CheckConstraint("life_status IN ('alive', 'dead')", name="ck_games_life_status"),
        sa.CheckConstraint("state_version >= 0", name="ck_games_state_version"),
        sa.ForeignKeyConstraint(["content_version"], ["content_versions.version"]),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("game_hash"),
    )
    op.create_index(
        "ix_games_owner_life_died_hash",
        "games",
        ["owner_user_id", "life_status", "died_at", "game_hash"],
        unique=False,
    )
    op.create_index(
        "ix_games_owner_updated_hash",
        "games",
        ["owner_user_id", "updated_at", "game_hash"],
        unique=False,
    )
    op.create_table(
        "committed_batches",
        sa.Column("game_hash", sa.String(length=8), nullable=False),
        sa.Column("batch_id", sa.String(length=128), nullable=False),
        sa.Column("state_hash", sa.String(length=64), nullable=False),
        sa.Column("events_hash", sa.String(length=64), nullable=False),
        sa.Column("resulting_state_version", sa.Integer(), nullable=False),
        sa.Column("committed_through_sequence", sa.Integer(), nullable=False),
        sa.Column("committed_through_event_id", sa.String(length=128), nullable=True),
        sa.Column("acknowledgement_json", sa.JSON(), nullable=False),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["game_hash"], ["games.game_hash"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("game_hash", "batch_id"),
    )
    op.create_table(
        "game_events",
        sa.Column("game_hash", sa.String(length=8), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_id", sa.String(length=128), nullable=False),
        sa.Column("batch_id", sa.String(length=128), nullable=False),
        sa.Column("event_type", sa.String(length=128), nullable=False),
        sa.Column("event_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["game_hash"], ["games.game_hash"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("game_hash", "sequence"),
        sa.UniqueConstraint("game_hash", "event_id", name="uq_game_events_game_event_id"),
    )
    op.create_index(
        "ix_game_events_game_sequence",
        "game_events",
        ["game_hash", "sequence"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_game_events_game_sequence", table_name="game_events")
    op.drop_table("game_events")
    op.drop_table("committed_batches")
    op.drop_index("ix_games_owner_updated_hash", table_name="games")
    op.drop_index("ix_games_owner_life_died_hash", table_name="games")
    op.drop_table("games")
    op.drop_index(op.f("ix_sessions_user_id"), table_name="sessions")
    op.drop_table("sessions")
    op.drop_index(op.f("ix_password_resets_user_id"), table_name="password_resets")
    op.drop_table("password_resets")
    op.drop_index(op.f("ix_oauth_onboarding_discord_user_id"), table_name="oauth_onboarding")
    op.drop_table("oauth_onboarding")
    op.drop_table("discord_identities")
    op.drop_table("content_pointer")
    op.drop_table("auth_attempts")
    op.drop_table("content_versions")
    op.drop_table("users")

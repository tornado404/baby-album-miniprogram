"""init — 初始迁移：创建全部 7 张表

Revision ID: 2be51f0079a5
Revises:
Create Date: 2026-06-15 20:25:46.361564

表创建顺序（按外键依赖）：
1. users          — 无外键依赖
2. babies         → users
3. media          → users, babies
4. share_invitations → users, babies
5. share_relations → users(×2), babies
6. sync_logs      → users
7. achievements   → users
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = "2be51f0079a5"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建所有初始表"""
    # ── users ─────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("open_id", sa.String(64), nullable=False, unique=True),
        sa.Column("union_id", sa.String(64), nullable=True),
        sa.Column("nick_name", sa.String(50), nullable=False, server_default=""),
        sa.Column("avatar_url", sa.String(500), nullable=True),
        sa.Column("record_days", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_photos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_videos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_3d_models", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_users_open_id", "users", ["open_id"], unique=True)

    # ── babies ────────────────────────────────────────────
    op.create_table(
        "babies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("name", sa.String(50), nullable=False),
        sa.Column("gender", sa.String(10), nullable=True),
        sa.Column("birth_date", sa.String(10), nullable=True),
        sa.Column("due_date", sa.String(10), nullable=True),
        sa.Column("weight", sa.Numeric(5, 2), nullable=True),
        sa.Column("height", sa.Numeric(5, 1), nullable=True),
        sa.Column("avatar", sa.String(500), nullable=True),
        sa.Column("order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_babies_user_id", "babies", ["user_id"])

    # ── media ─────────────────────────────────────────────
    op.create_table(
        "media",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "baby_id",
            sa.String(36),
            sa.ForeignKey("babies.id"),
            nullable=False,
            index=True,
        ),
        sa.Column(
            "type",
            sa.Enum("image", "video", "threedmodel", name="mediatype"),
            nullable=False,
        ),
        sa.Column("title", sa.String(200), nullable=False, server_default=""),
        sa.Column("cos_key", sa.String(500), nullable=False),
        sa.Column("cos_url", sa.String(1000), nullable=True),
        sa.Column("thumbnail_key", sa.String(500), nullable=True),
        sa.Column("thumbnail_url", sa.String(1000), nullable=True),
        sa.Column("width", sa.Integer(), nullable=True),
        sa.Column("height", sa.Integer(), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=True),
        sa.Column("mime_type", sa.String(50), nullable=True),
        sa.Column("capture_date", sa.String(10), nullable=False),
        sa.Column("baby_age_yrs", sa.Integer(), nullable=True),
        sa.Column("baby_age_mos", sa.Integer(), nullable=True),
        sa.Column("baby_age_days", sa.Integer(), nullable=True),
        sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("location_lat", sa.Float(), nullable=True),
        sa.Column("location_lng", sa.Float(), nullable=True),
        sa.Column("location_name", sa.String(200), nullable=True),
        sa.Column("moment", sa.String(500), nullable=True),
        sa.Column("milestone", sa.String(30), nullable=True),
        sa.Column("is_archived", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("archived_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_media_user_id", "media", ["user_id"])
    op.create_index("ix_media_baby_id", "media", ["baby_id"])
    op.create_index("idx_media_baby_capture", "media", ["baby_id", "capture_date"])

    # ── share_invitations ─────────────────────────────────
    op.create_table(
        "share_invitations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "from_user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "baby_id",
            sa.String(36),
            sa.ForeignKey("babies.id"),
            nullable=False,
        ),
        sa.Column("token", sa.String(64), nullable=False, unique=True),
        sa.Column("permission", sa.String(10), nullable=False),
        sa.Column("status", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_share_invitations_token", "share_invitations", ["token"], unique=True
    )
    op.create_index(
        "idx_share_invite_token", "share_invitations", ["token"], unique=False
    )

    # ── share_relations ───────────────────────────────────
    op.create_table(
        "share_relations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "owner_user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "viewer_user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
        ),
        sa.Column(
            "baby_id",
            sa.String(36),
            sa.ForeignKey("babies.id"),
            nullable=False,
        ),
        sa.Column("permission", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("baby_id", "viewer_user_id", name="uq_share_relation"),
    )

    # ── sync_logs ─────────────────────────────────────────
    op.create_table(
        "sync_logs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("entity_type", sa.String(20), nullable=False),
        sa.Column("entity_id", sa.String(36), nullable=False),
        sa.Column("action", sa.String(10), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_sync_logs_user_id", "sync_logs", ["user_id"])
    op.create_index("idx_sync_user_time", "sync_logs", ["user_id", "created_at"])

    # ── achievements ──────────────────────────────────────
    op.create_table(
        "achievements",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "user_id",
            sa.String(36),
            sa.ForeignKey("users.id"),
            nullable=False,
            index=True,
        ),
        sa.Column("badge_key", sa.String(32), nullable=False),
        sa.Column("awarded_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "badge_key", name="uq_user_badge"),
    )
    op.create_index("ix_achievements_user_id", "achievements", ["user_id"])


def downgrade() -> None:
    """按外键依赖逆序删除所有表"""
    op.drop_table("achievements")
    op.drop_table("sync_logs")
    op.drop_table("share_relations")
    op.drop_table("share_invitations")
    op.drop_table("media")
    op.drop_table("babies")
    op.drop_table("users")

    # 删除 PostgreSQL ENUM 类型
    op.execute("DROP TYPE IF EXISTS mediatype")

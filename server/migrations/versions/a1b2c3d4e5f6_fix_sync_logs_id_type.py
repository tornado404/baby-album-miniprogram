"""fix sync_logs id type — 将 id 从 bigint 改为 VARCHAR(36) 以匹配 ORM 模型

Revision ID: a1b2c3d4e5f6
Revises: 2be51f0079a5
Create Date: 2026-06-16

问题：初始迁移 2be51f0079a5 将 sync_logs.id 创建为 BigInteger + autoincrement，
但 ORM 模型 (app/models/sync_log.py) 定义 id 为 String(36) + UUID 默认值。
导致写入 SyncLog 时 PostgreSQL 报 DatatypeMismatchError。

修复：删除 sync_logs 表并按 ORM 模型重建，id 列改为 VARCHAR(36) PRIMARY KEY。
sync_logs 当前为空表，无需数据迁移。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "2be51f0079a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """删除旧 sync_logs 表并按 ORM 模型重建"""

    # 1. 删除依赖 sync_logs 的索引和表
    op.drop_index("idx_sync_user_time", table_name="sync_logs")
    op.drop_index("ix_sync_logs_user_id", table_name="sync_logs")
    op.drop_table("sync_logs")

    # 2. 按 ORM 模型重建 sync_logs 表
    op.create_table(
        "sync_logs",
        sa.Column("id", sa.String(36), primary_key=True),
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


def downgrade() -> None:
    """回滚：将 sync_logs 表恢复为 BigInteger id"""

    op.drop_index("idx_sync_user_time", table_name="sync_logs")
    op.drop_index("ix_sync_logs_user_id", table_name="sync_logs")
    op.drop_table("sync_logs")

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

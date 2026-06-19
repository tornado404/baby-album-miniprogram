"""add partial unique index on (user_id, name) WHERE is_deleted = FALSE

Revision ID: 298d76835d01
Revises: a1b2c3d4e5f6
Create Date: 2026-06-19

同一用户下不允许有同名宝宝（仅约束 is_deleted=False 的活跃记录）
使用部分唯一索引而非完整约束，以支持软删除后复用名称。
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "298d76835d01"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. 清除已存在的同名重复数据：对同一 user_id 下同名的非删除宝宝，
    #    保留 id 最小的一条，其余软删除
    op.execute("""
        UPDATE babies b
        SET is_deleted = TRUE
        WHERE is_deleted = FALSE
          AND (b.user_id, b.name) IN (
              SELECT user_id, name
              FROM babies
              WHERE is_deleted = FALSE
              GROUP BY user_id, name
              HAVING COUNT(*) > 1
          )
          AND b.id NOT IN (
              SELECT MIN(id)
              FROM babies
              WHERE is_deleted = FALSE
              GROUP BY user_id, name
              HAVING COUNT(*) > 1
          )
    """)

    # 2. 添加部分唯一索引（仅约束活跃记录，软删除的不受影响）
    op.create_index(
        "uq_babies_user_name", "babies", ["user_id", "name"],
        unique=True,
        postgresql_where=sa.text("is_deleted = FALSE"),
    )


def downgrade() -> None:
    op.drop_index("uq_babies_user_name", table_name="babies")
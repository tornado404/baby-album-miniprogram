"""add unique constraint on (user_id, name) for babies table

Revision ID: 298d76835d01
Revises: a1b2c3d4e5f6
Create Date: 2026-06-19

同一用户下不允许有同名宝宝（is_deleted=False 的记录）
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
    #    保留 order 最小（created_at 最早）的一条，其余软删除
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

    # 2. 添加复合唯一约束
    op.create_unique_constraint(
        "uq_babies_user_name", "babies", ["user_id", "name"]
    )


def downgrade() -> None:
    op.drop_constraint("uq_babies_user_name", "babies", type_="unique")
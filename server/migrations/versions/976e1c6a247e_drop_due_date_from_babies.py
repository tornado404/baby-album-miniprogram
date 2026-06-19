"""drop due_date from babies

Revision ID: 976e1c6a247e
Revises: a1b2c3d4e5f6
Create Date: 2026-06-19 21:45:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "976e1c6a247e"
down_revision: Union[str, None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("babies", "due_date")


def downgrade() -> None:
    op.add_column("babies", sa.Column("due_date", sa.String(10), nullable=True))
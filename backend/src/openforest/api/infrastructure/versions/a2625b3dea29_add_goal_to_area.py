"""add goal to area

Revision ID: a2625b3dea29
Revises: 8dfd6071cdad
Create Date: 2026-08-07 14:53:10.021070

"""
from typing import Sequence, Union

import sqlalchemy as sa
import sqlmodel
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a2625b3dea29'
down_revision: Union[str, Sequence[str], None] = '8dfd6071cdad'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "area", sa.Column("goal", sqlmodel.sql.sqltypes.AutoString(), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("area", "goal")

"""add multitenant fields

Revision ID: 9022acfbf1f8
Revises: e6748f45857d
Create Date: 2026-08-06 13:42:01.707434

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9022acfbf1f8'
down_revision: Union[str, Sequence[str], None] = 'e6748f45857d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'user',
        sa.Column('is_superuser', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column(
        'organization',
        sa.Column('created_by', sa.Uuid(), nullable=True),
    )
    op.add_column(
        'project',
        sa.Column('created_by', sa.Uuid(), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('project', 'created_by')
    op.drop_column('organization', 'created_by')
    op.drop_column('user', 'is_superuser')

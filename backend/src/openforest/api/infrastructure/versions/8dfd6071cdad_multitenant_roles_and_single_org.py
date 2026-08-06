"""multitenant roles and single org

Revision ID: 8dfd6071cdad
Revises: 9022acfbf1f8
Create Date: 2026-08-06 14:35:49.497171

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '8dfd6071cdad'
down_revision: Union[str, Sequence[str], None] = '9022acfbf1f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("UPDATE user_organization SET role = 'manager' WHERE role = 'admin'")

    op.execute(
        """
        DELETE FROM user_organization a
        USING user_organization b
        WHERE a.user_id = b.user_id
          AND a.organization_id <> b.organization_id
          AND a.role > b.role
        """
    )

    op.execute(
        "CREATE TYPE userorganizationrole_new AS ENUM "
        "('manager', 'researcher', 'volunteer', 'viewer')"
    )
    op.execute(
        "ALTER TABLE user_organization ALTER COLUMN role TYPE userorganizationrole_new "
        "USING role::text::userorganizationrole_new"
    )
    op.execute("DROP TYPE userorganizationrole")
    op.execute("ALTER TYPE userorganizationrole_new RENAME TO userorganizationrole")

    op.create_unique_constraint(
        "uq_user_organization_user_id", "user_organization", ["user_id"]
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(
        "uq_user_organization_user_id", "user_organization", type_="unique"
    )

    op.execute(
        "CREATE TYPE userorganizationrole_old AS ENUM "
        "('admin', 'manager', 'researcher', 'volunteer', 'viewer')"
    )
    op.execute(
        "ALTER TABLE user_organization ALTER COLUMN role TYPE userorganizationrole_old "
        "USING role::text::userorganizationrole_old"
    )
    op.execute("DROP TYPE userorganizationrole")
    op.execute("ALTER TYPE userorganizationrole_old RENAME TO userorganizationrole")

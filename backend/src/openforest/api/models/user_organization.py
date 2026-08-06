import enum
from uuid import UUID

from sqlmodel import Field, SQLModel, UniqueConstraint


class UserOrganizationRole(str, enum.Enum):
    manager = "manager"
    researcher = "researcher"
    volunteer = "volunteer"
    viewer = "viewer"


class UserOrganization(SQLModel, table=True):
    __tablename__ = "user_organization"

    __table_args__ = (UniqueConstraint("user_id", name="uq_user_organization_user_id"),)

    user_id: UUID = Field(
        nullable=False, primary_key=True, foreign_key="user.id", ondelete="CASCADE"
    )
    organization_id: UUID = Field(
        nullable=False, primary_key=True, foreign_key="organization.id", ondelete="CASCADE"
    )
    role: UserOrganizationRole = Field(nullable=False, default=UserOrganizationRole.viewer)

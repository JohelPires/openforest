from sqlmodel import Field, SQLModel
from uuid import UUID
import enum


class UserOrganizationRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    researcher = "researcher"
    volunteer = "volunteer"
    viewer = "viewer"


class UserOrganization(SQLModel, table=True):
    __tablename__ = "user_organization"

    user_id: UUID = Field(nullable=False, primary_key=True, foreign_key="user.id", ondelete="CASCADE")
    organization_id: UUID = Field(nullable=False, primary_key=True, foreign_key="organization.id", ondelete="CASCADE")
    role: UserOrganizationRole = Field(nullable=False, default=UserOrganizationRole.viewer) 
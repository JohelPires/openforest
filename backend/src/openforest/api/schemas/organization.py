from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel

from openforest.api.models.user_organization import UserOrganizationRole


class OrganizationCreate(SQLModel):
    name: str
    slug: str | None = None
    description: str | None = None


class OrganizationRead(OrganizationCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime


class OrganizationUpdate(SQLModel):
    name: str | None = None
    slug: str | None = None
    description: str | None = None


class MemberAdd(SQLModel):
    user_id: UUID
    role: UserOrganizationRole = UserOrganizationRole.viewer


class MemberUpdate(SQLModel):
    role: UserOrganizationRole


class MemberRead(SQLModel):
    user_id: UUID
    organization_id: UUID
    role: UserOrganizationRole
    name: str | None = None
    email: str | None = None

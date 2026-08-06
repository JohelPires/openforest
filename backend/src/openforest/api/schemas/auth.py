from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel

from openforest.api.models.user_organization import UserOrganizationRole


class UserCreate(SQLModel):
    name: str
    email: str
    password: str


class UserRead(SQLModel):
    id: UUID
    name: str
    email: str
    created_at: datetime
    updated_at: datetime


class Token(SQLModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(SQLModel):
    email: str
    password: str


class RefreshRequest(SQLModel):
    refresh_token: str


class MeOrganization(SQLModel):
    id: UUID
    name: str
    role: UserOrganizationRole


class MeRead(SQLModel):
    id: UUID
    name: str
    email: str
    created_at: datetime
    updated_at: datetime
    organization: MeOrganization | None = None

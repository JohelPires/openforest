from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


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

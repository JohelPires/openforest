from datetime import date, datetime
from uuid import UUID

from sqlmodel import SQLModel


class ProjectCreate(SQLModel):
    organization_id: UUID | None = None
    name: str
    description: str | None = None
    goal: str | None = None
    start_date: date | None = None
    responsible: str | None = None


class ProjectRead(ProjectCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime


class ProjectUpdate(SQLModel):
    name: str | None = None
    description: str | None = None
    goal: str | None = None
    start_date: date | None = None
    responsible: str | None = None

from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel

from openforest.api.models.area import RestorationStatus


class AreaCreate(SQLModel):
    name: str
    goal: str | None = None
    size_hectares: float | None = None
    biome: str | None = None
    coordinates: dict[str, object] | None = None
    restoration_status: RestorationStatus = RestorationStatus.planned


class AreaRead(AreaCreate):
    id: UUID
    project_id: UUID
    created_at: datetime
    updated_at: datetime


class AreaUpdate(SQLModel):
    name: str | None = None
    goal: str | None = None
    size_hectares: float | None = None
    biome: str | None = None
    coordinates: dict[str, object] | None = None
    restoration_status: RestorationStatus | None = None

from datetime import date, datetime
from uuid import UUID

from sqlmodel import SQLModel


class MonitoringCreate(SQLModel):
    visit_date: date
    notes: str | None = None
    seedling_count: int | None = None
    avg_height: float | None = None
    species_data: dict[str, object] | None = None


class MonitoringRead(MonitoringCreate):
    id: UUID
    area_id: UUID
    created_at: datetime
    updated_at: datetime


class MonitoringUpdate(SQLModel):
    visit_date: date | None = None
    notes: str | None = None
    seedling_count: int | None = None
    avg_height: float | None = None
    species_data: dict[str, object] | None = None

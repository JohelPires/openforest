from datetime import date
from uuid import UUID

from sqlmodel import JSON, Field, Index, Text

from openforest.api.models.base import Base


class Monitoring(Base, table=True):
    __tablename__ = "monitoring"

    __table_args__ = (
        Index("ix_monitoring_area_visit", "area_id", "visit_date"),
    )

    area_id: UUID = Field(nullable=False, foreign_key="area.id", ondelete="CASCADE")
    visit_date: date = Field(nullable=False)
    notes: str | None = Field(default=None, sa_type=Text)
    seedling_count: int | None = Field(default=None)
    avg_height: float | None = Field(default=None)
    species_data: dict[str, object] | None = Field(default=None, sa_type=JSON)

import enum
from uuid import UUID

from geoalchemy2 import Geometry
from sqlmodel import Column, Field, Index

from openforest.api.models.base import Base


class RestorationStatus(str, enum.Enum):
    planned = "planned"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class Area(Base, table=True):
    __tablename__ = "area"

    __table_args__ = (Index("ix_area_geometry", "geometry", postgresql_using="gist"),)

    project_id: UUID = Field(
        nullable=False, foreign_key="project.id", ondelete="CASCADE", index=True
    )
    name: str = Field(nullable=False)
    goal: str | None = Field(default=None)
    size_hectares: float | None = Field(default=None)
    biome: str | None = Field(default=None)
    geometry: object | None = Field(
        default=None, sa_column=Column(Geometry(srid=4326, spatial_index=False))
    )
    restoration_status: RestorationStatus = Field(default=RestorationStatus.planned)

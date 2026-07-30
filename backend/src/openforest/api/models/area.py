import enum
from uuid import UUID

from sqlmodel import JSON, Field

from openforest.api.models.base import Base


class RestorationStatus(str, enum.Enum):
    planned = "planned"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class Area(Base, table=True):
    __tablename__ = "area"

    project_id: UUID = Field(
        nullable=False, foreign_key="project.id", ondelete="CASCADE", index=True
    )
    name: str = Field(nullable=False)
    size_hectares: float | None = Field(default=None)
    biome: str | None = Field(default=None)
    coordinates: dict[str, object] | None = Field(default=None, sa_type=JSON)
    restoration_status: RestorationStatus = Field(default=RestorationStatus.planned)

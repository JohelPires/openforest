from datetime import date
from uuid import UUID

from sqlmodel import Field, Text

from openforest.api.models.base import Base


class Project(Base, table=True):
    __tablename__ = "project"

    organization_id: UUID = Field(
        nullable=False, foreign_key="organization.id", ondelete="CASCADE", index=True
    )
    name: str = Field(nullable=False)
    description: str | None = Field(default=None, sa_type=Text)
    goal: str | None = Field(default=None)
    start_date: date | None = Field(default=None)
    responsible: str | None = Field(default=None)
    created_by: UUID | None = Field(default=None, foreign_key="user.id")

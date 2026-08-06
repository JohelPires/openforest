from uuid import UUID

from sqlmodel import Field

from openforest.api.models.base import Base


class Organization(Base, table=True):
    __tablename__ = "organization"

    name: str = Field(nullable=False)
    slug: str = Field(nullable=False, unique=True, index=True)
    description: str | None = Field(default=None)
    created_by: UUID | None = Field(default=None, foreign_key="user.id")

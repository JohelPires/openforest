from sqlmodel import Field

from openforest.api.models.base import Base


class Organization(Base, table=True):
    __tablename__ = "organization"

    name: str = Field(nullable=False)
    slug: str = Field(nullable=False, unique=True, index=True)
    description: str | None = Field(default=None)

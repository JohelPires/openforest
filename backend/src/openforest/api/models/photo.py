from uuid import UUID

from sqlmodel import Field

from openforest.api.models.base import Base


class Photo(Base, table=True):
    __tablename__ = "photo"

    monitoring_id: UUID = Field(
        nullable=False, foreign_key="monitoring.id", ondelete="CASCADE", index=True
    )
    file_path: str = Field(nullable=False)
    original_filename: str | None = Field(default=None)
    mime_type: str | None = Field(default=None)
    file_size: int | None = Field(default=None)
    width: int | None = Field(default=None)
    height: int | None = Field(default=None)

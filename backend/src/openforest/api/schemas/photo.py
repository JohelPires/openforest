from datetime import datetime
from uuid import UUID

from pydantic import computed_field
from sqlmodel import SQLModel

from openforest.api.config import settings
from openforest.api.infrastructure.storage import get_presigned_url


class PhotoCreate(SQLModel):
    original_filename: str | None = None
    mime_type: str | None = None
    file_size: int | None = None
    width: int | None = None
    height: int | None = None


class PhotoRead(PhotoCreate):
    id: UUID
    monitoring_id: UUID
    file_path: str
    created_at: datetime
    updated_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        if settings.storage_backend == "s3":
            return get_presigned_url(self.file_path)
        return f"/api/v1/photos/{self.id}/download"

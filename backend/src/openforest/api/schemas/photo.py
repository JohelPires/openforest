from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


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

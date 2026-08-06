from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.area import Area
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.photo import Photo
from openforest.api.models.project import Project
from openforest.api.schemas.photo import PhotoCreate


def create_photo(session: Session, monitoring_id: UUID, data: PhotoCreate, file_path: str) -> Photo:
    monitoring = session.get(Monitoring, monitoring_id)
    if not monitoring:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Monitoramento com ID '{monitoring_id}' não encontrado",
                    "type": "not_found",
                }
            ],
        )
    photo = Photo(**data.model_dump(), monitoring_id=monitoring_id, file_path=file_path)
    session.add(photo)
    session.commit()
    session.refresh(photo)
    return photo


def get_photo(
    session: Session, photo_id: UUID, organization_id: UUID | None = None
) -> Photo | None:
    stmt = (
        select(Photo)
        .join(Monitoring)
        .join(Area)
        .join(Project)
        .where(Photo.id == photo_id)
    )
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return session.exec(stmt).first()


def list_photos(session: Session, monitoring_id: UUID) -> list[Photo]:
    return list(session.exec(select(Photo).where(Photo.monitoring_id == monitoring_id)).all())


def delete_photo(session: Session, photo_id: UUID) -> Photo | None:
    photo = session.get(Photo, photo_id)
    if not photo:
        return None
    session.delete(photo)
    session.commit()
    return photo

from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import Response

from openforest.api.config import settings
from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.permissions import check_area_write_permission
from openforest.api.infrastructure.database import SessionDep
from openforest.api.infrastructure.storage import delete_file, read_file, save_upload
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.photo import Photo
from openforest.api.schemas.photo import PhotoCreate, PhotoRead
from openforest.api.services.photo_service import create_photo, delete_photo, get_photo

router = APIRouter(tags=["fotos"])


@router.post("/monitorings/{monitoring_id}/photos", response_model=PhotoRead)
def upload_photo_route(
    session: SessionDep, current_user: CurrentUserDep, monitoring_id: UUID, file: UploadFile
) -> Photo:
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
    check_area_write_permission(session, current_user, monitoring.area_id)

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=422,
            detail=[{"msg": "O arquivo deve ser uma imagem", "type": "validation_error"}],
        )

    file_bytes = file.file.read()

    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Arquivo excede o limite de {settings.max_upload_size_mb}MB",
                    "type": "validation_error",
                }
            ],
        )

    data = PhotoCreate(
        original_filename=file.filename,
        mime_type=file.content_type,
        file_size=len(file_bytes),
    )

    file_path = save_upload(file_bytes, file.filename or "", file.content_type, monitoring_id)
    try:
        photo = create_photo(session, monitoring_id, data, file_path)
    except Exception:
        delete_file(file_path)
        raise
    return photo


@router.get("/photos/{photo_id}", response_model=PhotoRead)
def get_photo_route(
    session: SessionDep, current_user: CurrentUserDep, photo_id: UUID
) -> Photo | None:
    photo = get_photo(session, photo_id)
    if not photo:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Foto não encontrada", "type": "not_found"}],
        )
    return photo


@router.get("/photos/{photo_id}/download")
def download_photo_route(
    session: SessionDep, current_user: CurrentUserDep, photo_id: UUID
) -> Response:
    photo = get_photo(session, photo_id)
    if not photo:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Foto não encontrada", "type": "not_found"}],
        )
    content = read_file(photo.file_path)
    filename = (
        (photo.original_filename or "foto").replace('"', "").replace("\r", "").replace("\n", "")
    )
    return Response(
        content=content,
        media_type=photo.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.delete("/photos/{photo_id}")
def delete_photo_route(
    session: SessionDep, current_user: CurrentUserDep, photo_id: UUID
) -> dict[str, str]:
    photo = get_photo(session, photo_id)
    if not photo:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Foto não encontrada", "type": "not_found"}],
        )
    monitoring = session.get(Monitoring, photo.monitoring_id)
    if monitoring:
        check_area_write_permission(session, current_user, monitoring.area_id)
    deleted = delete_photo(session, photo_id)
    if deleted:
        delete_file(deleted.file_path)
    return {"msg": "Foto deletada com sucesso"}

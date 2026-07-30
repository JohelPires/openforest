from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.area import Area
from openforest.api.schemas.area import AreaCreate, AreaRead, AreaUpdate
from openforest.api.services.area_service import (
    create_area,
    delete_area,
    get_area,
    list_areas,
    update_area,
)

router = APIRouter(tags=["áreas"])


@router.get("/projects/{project_id}/areas", response_model=list[AreaRead])
def list_areas_route(session: SessionDep, project_id: UUID) -> list[Area]:
    return list_areas(session, project_id)


@router.post("/projects/{project_id}/areas", response_model=AreaRead)
def create_area_route(
    session: SessionDep, project_id: UUID, data: AreaCreate
) -> Area:
    return create_area(session, project_id, data)


@router.get("/areas/{area_id}", response_model=AreaRead)
def get_area_route(session: SessionDep, area_id: UUID) -> Area | None:
    area = get_area(session, area_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    return area


@router.patch("/areas/{area_id}", response_model=AreaRead)
def update_area_route(
    session: SessionDep, area_id: UUID, data: AreaUpdate
) -> Area | None:
    area = update_area(session, area_id, data)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    return area


@router.delete("/areas/{area_id}")
def delete_area_route(session: SessionDep, area_id: UUID) -> dict[str, str]:
    deleted = delete_area(session, area_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    return {"msg": "Área deletada com sucesso"}

from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import CurrentOrgDep, CurrentUserDep, require_org_role
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.area import Area
from openforest.api.models.user_organization import UserOrganizationRole
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
def list_areas_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
) -> list[Area]:
    organization_id = current_org.organization_id if current_org else None
    return list_areas(session, project_id, organization_id)


@router.post("/projects/{project_id}/areas", response_model=AreaRead)
def create_area_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
    data: AreaCreate,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> Area:
    organization_id = current_org.organization_id if current_org else None
    if organization_id is None:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    return create_area(session, project_id, data, organization_id)


@router.get("/areas/{area_id}", response_model=AreaRead)
def get_area_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
) -> Area | None:
    organization_id = current_org.organization_id if current_org else None
    area = get_area(session, area_id, organization_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    return area


@router.patch("/areas/{area_id}", response_model=AreaRead)
def update_area_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
    data: AreaUpdate,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> Area | None:
    organization_id = current_org.organization_id if current_org else None
    area = get_area(session, area_id, organization_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    return update_area(session, area_id, data)


@router.delete("/areas/{area_id}")
def delete_area_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> dict[str, str]:
    organization_id = current_org.organization_id if current_org else None
    area = get_area(session, area_id, organization_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    delete_area(session, area_id)
    return {"msg": "Área deletada com sucesso"}

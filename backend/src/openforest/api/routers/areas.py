from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlmodel import Session

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.area import Area
from openforest.api.models.project import Project
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
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
    session: SessionDep, current_user: CurrentUserDep, project_id: UUID
) -> list[Area]:
    return list_areas(session, project_id)


@router.post("/projects/{project_id}/areas", response_model=AreaRead)
def create_area_route(
    session: SessionDep, current_user: CurrentUserDep, project_id: UUID, data: AreaCreate
) -> Area:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Projeto com ID '{project_id}' não encontrado",
                    "type": "not_found",
                }
            ],
        )
    _check_role_in_org(
        session,
        current_user,
        project.organization_id,
        UserOrganizationRole.admin,
        UserOrganizationRole.manager,
    )
    return create_area(session, project_id, data)


@router.get("/areas/{area_id}", response_model=AreaRead)
def get_area_route(session: SessionDep, current_user: CurrentUserDep, area_id: UUID) -> Area | None:
    area = get_area(session, area_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    return area


@router.patch("/areas/{area_id}", response_model=AreaRead)
def update_area_route(
    session: SessionDep, current_user: CurrentUserDep, area_id: UUID, data: AreaUpdate
) -> Area | None:
    area = get_area(session, area_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    project = session.get(Project, area.project_id)
    if project:
        _check_role_in_org(
            session,
            current_user,
            project.organization_id,
            UserOrganizationRole.admin,
            UserOrganizationRole.manager,
        )
    area = update_area(session, area_id, data)
    return area


@router.delete("/areas/{area_id}")
def delete_area_route(
    session: SessionDep, current_user: CurrentUserDep, area_id: UUID
) -> dict[str, str]:
    area = get_area(session, area_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    project = session.get(Project, area.project_id)
    if project:
        _check_role_in_org(
            session,
            current_user,
            project.organization_id,
            UserOrganizationRole.admin,
            UserOrganizationRole.manager,
        )
    delete_area(session, area_id)
    return {"msg": "Área deletada com sucesso"}


def _check_role_in_org(
    session: Session,
    user: User,
    organization_id: UUID,
    *roles: UserOrganizationRole,
) -> None:
    membership = session.get(UserOrganization, (user.id, organization_id))
    if membership is None or membership.role not in roles:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import Session

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.pagination import PaginationDep
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.organization import Organization
from openforest.api.models.project import Project
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
from openforest.api.schemas.pagination import Paginated
from openforest.api.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from openforest.api.services.project_service import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projetos"])


@router.post("/", response_model=ProjectRead)
def create_project_route(
    session: SessionDep, current_user: CurrentUserDep, data: ProjectCreate
) -> Project:
    organization = session.get(Organization, data.organization_id)
    if not organization:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Organização com ID '{data.organization_id}' não encontrada",
                    "type": "not_found",
                }
            ],
        )
    _check_role_in_org(
        session,
        current_user,
        organization.id,
        UserOrganizationRole.admin,
        UserOrganizationRole.manager,
    )
    project = create_project(session, data)
    return project


@router.get("/", response_model=Paginated[ProjectRead])
def list_projects_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    pagination: PaginationDep,
    organization_id: Annotated[UUID | None, Query()] = None,
) -> Paginated[Project]:
    if organization_id:
        organization = session.get(Organization, organization_id)
        if not organization:
            raise HTTPException(
                status_code=422,
                detail=[
                    {
                        "msg": f"Organização com ID '{organization_id}' não encontrada",
                        "type": "not_found",
                    }
                ],
            )
    items, total = list_projects(session, pagination.offset, pagination.limit, organization_id)
    return Paginated(items=items, total=total, offset=pagination.offset, limit=pagination.limit)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project_route(
    session: SessionDep, current_user: CurrentUserDep, project_id: UUID
) -> Project | None:
    project = get_project(session, project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project_route(
    session: SessionDep, current_user: CurrentUserDep, project_id: UUID, data: ProjectUpdate
) -> Project | None:
    project = get_project(session, project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    _check_role_in_org(
        session,
        current_user,
        project.organization_id,
        UserOrganizationRole.admin,
        UserOrganizationRole.manager,
    )
    project = update_project(session, project_id, data)
    return project


@router.delete("/{project_id}")
def delete_project_route(
    session: SessionDep, current_user: CurrentUserDep, project_id: UUID
) -> dict[str, str]:
    project = get_project(session, project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    _check_role_in_org(
        session,
        current_user,
        project.organization_id,
        UserOrganizationRole.admin,
        UserOrganizationRole.manager,
    )
    delete_project(session, project_id)
    return {"msg": "Projeto deletado com sucesso"}


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

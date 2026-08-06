from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import (
    CurrentOrgDep,
    CurrentUserDep,
    require_org_role,
)
from openforest.api.dependencies.pagination import PaginationDep
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.project import Project
from openforest.api.models.user_organization import UserOrganizationRole
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
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    data: ProjectCreate,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> Project:
    organization_id = current_org.organization_id if current_org else data.organization_id
    if organization_id is None:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": "organization_id é obrigatório para o admin global",
                    "type": "validation_error",
                }
            ],
        )
    return create_project(session, organization_id, data, created_by=current_user.id)


@router.get("/", response_model=Paginated[ProjectRead])
def list_projects_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    pagination: PaginationDep,
) -> Paginated[Project]:
    organization_id = current_org.organization_id if current_org else None
    items, total = list_projects(session, pagination.offset, pagination.limit, organization_id)
    return Paginated(items=items, total=total, offset=pagination.offset, limit=pagination.limit)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
) -> Project | None:
    organization_id = current_org.organization_id if current_org else None
    project = get_project(session, project_id, organization_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
    data: ProjectUpdate,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> Project | None:
    organization_id = current_org.organization_id if current_org else None
    project = get_project(session, project_id, organization_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    return update_project(session, project_id, data)


@router.delete("/{project_id}")
def delete_project_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> dict[str, str]:
    organization_id = current_org.organization_id if current_org else None
    project = get_project(session, project_id, organization_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    delete_project(session, project_id)
    return {"msg": "Projeto deletado com sucesso"}

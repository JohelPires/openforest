from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import CurrentUserDep, require_role
from openforest.api.dependencies.pagination import PaginationDep
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.organization import Organization
from openforest.api.models.user_organization import UserOrganizationRole
from openforest.api.schemas.organization import (
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
)
from openforest.api.schemas.pagination import Paginated
from openforest.api.services.organization_service import (
    create_organization,
    delete_organization,
    get_organization,
    list_organizations,
    update_organization,
)

router = APIRouter(prefix="/organizations", tags=["organizações"])


@router.post("/", response_model=OrganizationRead)
def create_organization_route(
    session: SessionDep, current_user: CurrentUserDep, data: OrganizationCreate
) -> Organization:
    return create_organization(session, data)


@router.get("/", response_model=Paginated[OrganizationRead])
def list_organizations_route(
    session: SessionDep, current_user: CurrentUserDep, pagination: PaginationDep
) -> Paginated[Organization]:
    items, total = list_organizations(session, pagination.offset, pagination.limit)
    return Paginated(items=items, total=total, offset=pagination.offset, limit=pagination.limit)


@router.get("/{organization_id}", response_model=OrganizationRead)
def get_organization_route(
    session: SessionDep, current_user: CurrentUserDep, organization_id: UUID
) -> Organization | None:
    organization = get_organization(session, organization_id)
    if not organization:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    return organization


@router.patch("/{organization_id}", response_model=OrganizationRead)
def update_organization_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    data: OrganizationUpdate,
    _: None = require_role(UserOrganizationRole.admin, UserOrganizationRole.manager),
) -> Organization | None:
    organization = update_organization(session, organization_id, data)
    if not organization:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    return organization


@router.delete("/{organization_id}")
def delete_organization_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    _: None = require_role(UserOrganizationRole.admin),
) -> dict[str, str]:
    deleted = delete_organization(session, organization_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    return {"msg": "Organização deletada com sucesso"}

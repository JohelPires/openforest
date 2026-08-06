from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlmodel import select

from openforest.api.dependencies.auth import (
    CurrentOrgDep,
    CurrentUserDep,
    require_org_access,
)
from openforest.api.dependencies.pagination import PaginationDep
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.organization import Organization
from openforest.api.models.user_organization import (
    UserOrganization,
    UserOrganizationRole,
)
from openforest.api.schemas.organization import (
    MemberAdd,
    MemberRead,
    MemberUpdate,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
)
from openforest.api.schemas.pagination import Paginated
from openforest.api.services.organization_membership_service import (
    add_member,
    list_members,
    remove_member,
    update_member_role,
)
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
    return create_organization(session, data, current_user)


@router.get("/", response_model=Paginated[OrganizationRead])
def list_organizations_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    pagination: PaginationDep,
) -> Paginated[Organization]:
    if current_org is not None:
        organization = session.get(Organization, current_org.organization_id)
        items = [organization] if organization else []
        return Paginated(
            items=items, total=len(items), offset=pagination.offset, limit=pagination.limit
        )
    items, total = list_organizations(session, pagination.offset, pagination.limit)
    return Paginated(items=items, total=total, offset=pagination.offset, limit=pagination.limit)


@router.get("/{organization_id}", response_model=OrganizationRead)
def get_organization_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
) -> Organization | None:
    organization = get_organization(session, organization_id)
    if not organization:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    if not current_user.is_superuser:
        membership = session.exec(
            select(UserOrganization).where(
                UserOrganization.user_id == current_user.id,
                UserOrganization.organization_id == organization_id,
            )
        ).first()
        if not membership:
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
    _: None = require_org_access(UserOrganizationRole.manager),
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
    _: None = require_org_access(UserOrganizationRole.manager),
) -> dict[str, str]:
    deleted = delete_organization(session, organization_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    return {"msg": "Organização deletada com sucesso"}


@router.get("/{organization_id}/members", response_model=list[MemberRead])
def list_members_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    _: None = require_org_access(UserOrganizationRole.manager),
) -> list[MemberRead]:
    return list_members(session, organization_id)


@router.post("/{organization_id}/members", response_model=MemberRead)
def add_member_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    data: MemberAdd,
    _: None = require_org_access(UserOrganizationRole.manager),
) -> MemberRead:
    return add_member(session, organization_id, data)


@router.patch("/{organization_id}/members/{user_id}", response_model=MemberRead)
def update_member_role_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    user_id: UUID,
    data: MemberUpdate,
    _: None = require_org_access(UserOrganizationRole.manager),
) -> MemberRead:
    return update_member_role(session, organization_id, user_id, data)


@router.delete("/{organization_id}/members/{user_id}")
def remove_member_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    user_id: UUID,
    _: None = require_org_access(UserOrganizationRole.manager),
) -> dict[str, str]:
    remove_member(session, organization_id, user_id)
    return {"msg": "Membro removido com sucesso"}

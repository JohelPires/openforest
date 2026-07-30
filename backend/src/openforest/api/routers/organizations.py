from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.infrastructure.database import SessionDep
from openforest.api.schemas.organization import (
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
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
def create_organization_route(session: SessionDep, data: OrganizationCreate) -> OrganizationRead:
    return create_organization(session, data)


@router.get("/", response_model=list[OrganizationRead])
def list_organizations_route(session: SessionDep) -> list[OrganizationRead]:
    return list_organizations(session)


@router.get("/{organization_id}", response_model=OrganizationRead)
def get_organization_route(session: SessionDep, organization_id: UUID) -> OrganizationRead:
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
    organization_id: UUID,
    data: OrganizationUpdate,
) -> OrganizationRead:
    organization = update_organization(session, organization_id, data)
    if not organization:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    return organization


@router.delete("/{organization_id}")
def delete_organization_route(session: SessionDep, organization_id: UUID) -> dict[str, str]:
    deleted = delete_organization(session, organization_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    return {"msg": "Organização deletada com sucesso"}

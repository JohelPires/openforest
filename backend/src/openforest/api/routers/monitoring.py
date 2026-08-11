from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import CurrentOrgDep, CurrentUserDep
from openforest.api.dependencies.pagination import PaginationDep
from openforest.api.dependencies.permissions import check_area_role
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.user_organization import UserOrganizationRole
from openforest.api.schemas.monitoring import (
    MonitoringCreate,
    MonitoringRead,
    MonitoringUpdate,
)
from openforest.api.schemas.pagination import Paginated
from openforest.api.services.monitoring_service import (
    create_monitoring,
    delete_monitoring,
    get_monitoring,
    list_monitorings,
    update_monitoring,
)

router = APIRouter(tags=["monitoramentos"])


@router.get("/areas/{area_id}/monitorings", response_model=Paginated[MonitoringRead])
def list_monitorings_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
    pagination: PaginationDep,
) -> Paginated[Monitoring]:
    organization_id = current_org.organization_id if current_org else None
    items, total = list_monitorings(
        session, area_id, pagination.offset, pagination.limit, organization_id
    )
    return Paginated(items=items, total=total, offset=pagination.offset, limit=pagination.limit)


@router.post("/areas/{area_id}/monitorings", response_model=MonitoringRead)
def create_monitoring_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
    data: MonitoringCreate,
) -> Monitoring:
    check_area_role(
        session,
        current_user,
        current_org,
        area_id,
        UserOrganizationRole.manager,
        UserOrganizationRole.researcher,
        UserOrganizationRole.volunteer,
    )
    organization_id = current_org.organization_id if current_org else None
    if organization_id is None:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    return create_monitoring(session, area_id, data, organization_id)


@router.get("/monitorings/{monitoring_id}", response_model=MonitoringRead)
def get_monitoring_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    monitoring_id: UUID,
) -> Monitoring | None:
    organization_id = current_org.organization_id if current_org else None
    monitoring = get_monitoring(session, monitoring_id, organization_id)
    if not monitoring:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Monitoramento não encontrado", "type": "not_found"}],
        )
    return monitoring


@router.patch("/monitorings/{monitoring_id}", response_model=MonitoringRead)
def update_monitoring_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    monitoring_id: UUID,
    data: MonitoringUpdate,
) -> Monitoring | None:
    organization_id = current_org.organization_id if current_org else None
    monitoring = get_monitoring(session, monitoring_id, organization_id)
    if not monitoring:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Monitoramento não encontrado", "type": "not_found"}],
        )
    check_area_role(
        session,
        current_user,
        current_org,
        monitoring.area_id,
        UserOrganizationRole.manager,
        UserOrganizationRole.researcher,
    )
    return update_monitoring(session, monitoring_id, data)


@router.delete("/monitorings/{monitoring_id}")
def delete_monitoring_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    monitoring_id: UUID,
) -> dict[str, str]:
    organization_id = current_org.organization_id if current_org else None
    monitoring = get_monitoring(session, monitoring_id, organization_id)
    if not monitoring:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Monitoramento não encontrado", "type": "not_found"}],
        )
    check_area_role(
        session,
        current_user,
        current_org,
        monitoring.area_id,
        UserOrganizationRole.manager,
        UserOrganizationRole.researcher,
    )
    delete_monitoring(session, monitoring_id)
    return {"msg": "Monitoramento deletado com sucesso"}

from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.permissions import check_area_write_permission
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.monitoring import Monitoring
from openforest.api.schemas.monitoring import (
    MonitoringCreate,
    MonitoringRead,
    MonitoringUpdate,
)
from openforest.api.services.monitoring_service import (
    create_monitoring,
    delete_monitoring,
    get_monitoring,
    list_monitorings,
    update_monitoring,
)

router = APIRouter(tags=["monitoramentos"])


@router.get("/areas/{area_id}/monitorings", response_model=list[MonitoringRead])
def list_monitorings_route(
    session: SessionDep, current_user: CurrentUserDep, area_id: UUID
) -> list[Monitoring]:
    return list_monitorings(session, area_id)


@router.post("/areas/{area_id}/monitorings", response_model=MonitoringRead)
def create_monitoring_route(
    session: SessionDep, current_user: CurrentUserDep, area_id: UUID, data: MonitoringCreate
) -> Monitoring:
    check_area_write_permission(session, current_user, area_id)
    return create_monitoring(session, area_id, data)


@router.get("/monitorings/{monitoring_id}", response_model=MonitoringRead)
def get_monitoring_route(
    session: SessionDep, current_user: CurrentUserDep, monitoring_id: UUID
) -> Monitoring | None:
    monitoring = get_monitoring(session, monitoring_id)
    if not monitoring:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Monitoramento não encontrado", "type": "not_found"}],
        )
    return monitoring


@router.patch("/monitorings/{monitoring_id}", response_model=MonitoringRead)
def update_monitoring_route(
    session: SessionDep, current_user: CurrentUserDep, monitoring_id: UUID, data: MonitoringUpdate
) -> Monitoring | None:
    monitoring = get_monitoring(session, monitoring_id)
    if not monitoring:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Monitoramento não encontrado", "type": "not_found"}],
        )
    check_area_write_permission(session, current_user, monitoring.area_id)
    monitoring = update_monitoring(session, monitoring_id, data)
    return monitoring


@router.delete("/monitorings/{monitoring_id}")
def delete_monitoring_route(
    session: SessionDep, current_user: CurrentUserDep, monitoring_id: UUID
) -> dict[str, str]:
    monitoring = get_monitoring(session, monitoring_id)
    if not monitoring:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Monitoramento não encontrado", "type": "not_found"}],
        )
    check_area_write_permission(session, current_user, monitoring.area_id)
    delete_monitoring(session, monitoring_id)
    return {"msg": "Monitoramento deletado com sucesso"}

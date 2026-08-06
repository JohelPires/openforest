from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.area import Area
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.project import Project
from openforest.api.schemas.monitoring import MonitoringCreate, MonitoringUpdate


def create_monitoring(
    session: Session, area_id: UUID, data: MonitoringCreate, organization_id: UUID
) -> Monitoring:
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Área com ID '{area_id}' não encontrada",
                    "type": "not_found",
                }
            ],
        )
    project = session.get(Project, area.project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    monitoring = Monitoring(**data.model_dump(), area_id=area_id)
    session.add(monitoring)
    session.commit()
    session.refresh(monitoring)
    return monitoring


def get_monitoring(
    session: Session, monitoring_id: UUID, organization_id: UUID | None = None
) -> Monitoring | None:
    stmt = select(Monitoring).join(Area).join(Project).where(Monitoring.id == monitoring_id)
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return session.exec(stmt).first()


def list_monitorings(
    session: Session, area_id: UUID, organization_id: UUID | None = None
) -> list[Monitoring]:
    stmt = select(Monitoring).join(Area).join(Project).where(Monitoring.area_id == area_id)
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return list(session.exec(stmt).all())


def update_monitoring(
    session: Session, monitoring_id: UUID, data: MonitoringUpdate
) -> Monitoring | None:
    monitoring = session.get(Monitoring, monitoring_id)
    if not monitoring:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(monitoring, field, value)
    session.commit()
    session.refresh(monitoring)
    return monitoring


def delete_monitoring(session: Session, monitoring_id: UUID) -> bool:
    monitoring = session.get(Monitoring, monitoring_id)
    if not monitoring:
        return False
    session.delete(monitoring)
    session.commit()
    return True

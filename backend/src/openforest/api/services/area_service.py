from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlmodel import Session, select

from openforest.api.models.area import Area
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.project import Project
from openforest.api.schemas.area import AreaCreate, AreaRead, AreaUpdate

RECENT_MONITORINGS_LIMIT = 10


def create_area(
    session: Session, project_id: UUID, data: AreaCreate, organization_id: UUID
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
    if project.organization_id != organization_id:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    area = Area(**data.model_dump(), project_id=project_id)
    session.add(area)
    session.commit()
    session.refresh(area)
    return area


def get_area(
    session: Session, area_id: UUID, organization_id: UUID | None = None
) -> Area | None:
    stmt = select(Area).join(Project).where(Area.id == area_id)
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return session.exec(stmt).first()


def list_areas(
    session: Session, project_id: UUID, organization_id: UUID | None = None
) -> list[AreaRead]:
    stmt = select(Area).join(Project).where(Area.project_id == project_id)
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    areas = list(session.exec(stmt).all())
    if not areas:
        return []
    recent_by_area = _recent_monitorings_by_area(session, project_id, organization_id)
    return [
        AreaRead(**area.model_dump(), recent_monitorings=recent_by_area.get(area.id, []))
        for area in areas
    ]


def _recent_monitorings_by_area(
    session: Session, project_id: UUID, organization_id: UUID | None
) -> dict[UUID, list[Monitoring]]:
    stmt = (
        select(Monitoring)
        .join(Area)
        .join(Project)
        .where(Area.project_id == project_id)
        .order_by(text("monitoring.visit_date desc"), text("monitoring.created_at desc"))
    )
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)

    recent_by_area: dict[UUID, list[Monitoring]] = {}
    for monitoring in session.exec(stmt).all():
        recent = recent_by_area.setdefault(monitoring.area_id, [])
        if len(recent) < RECENT_MONITORINGS_LIMIT:
            recent.append(monitoring)
    return recent_by_area


def update_area(session: Session, area_id: UUID, data: AreaUpdate) -> Area | None:
    area = session.get(Area, area_id)
    if not area:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(area, field, value)
    session.commit()
    session.refresh(area)
    return area


def delete_area(session: Session, area_id: UUID) -> bool:
    area = session.get(Area, area_id)
    if not area:
        return False
    session.delete(area)
    session.commit()
    return True

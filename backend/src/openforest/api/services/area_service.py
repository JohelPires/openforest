from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import text
from sqlmodel import Session, func, select

from openforest.api.infrastructure.geometry import to_geojson, to_geometry
from openforest.api.models.area import Area
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.project import Project
from openforest.api.schemas.area import AreaCreate, AreaRead, AreaUpdate
from openforest.api.schemas.monitoring import MonitoringRead

RECENT_MONITORINGS_LIMIT = 10


def _area_to_read(area: Area) -> AreaRead:
    return AreaRead(**area.model_dump(exclude={"geometry"}), coordinates=to_geojson(area.geometry))


def create_area(
    session: Session, project_id: UUID, data: AreaCreate, organization_id: UUID
) -> AreaRead:
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
    payload = data.model_dump()
    geometry = to_geometry(payload.pop("coordinates", None))
    area = Area(**payload, geometry=geometry, project_id=project_id)
    session.add(area)
    session.commit()
    session.refresh(area)
    return _area_to_read(area)


def get_area(session: Session, area_id: UUID, organization_id: UUID | None = None) -> Area | None:
    stmt = select(Area).join(Project).where(Area.id == area_id)
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return session.exec(stmt).first()


def list_areas(
    session: Session,
    project_id: UUID,
    offset: int,
    limit: int,
    organization_id: UUID | None = None,
) -> tuple[list[AreaRead], int]:
    count_stmt = (
        select(func.count()).select_from(Area).join(Project).where(Area.project_id == project_id)
    )
    stmt = (
        select(Area)
        .join(Project)
        .where(Area.project_id == project_id)
        .order_by(text("area.created_at desc"), text("area.id desc"))
    )
    if organization_id is not None:
        count_stmt = count_stmt.where(Project.organization_id == organization_id)
        stmt = stmt.where(Project.organization_id == organization_id)
    total = session.exec(count_stmt).one()
    areas = list(session.exec(stmt.offset(offset).limit(limit)).all())
    if not areas:
        return [], total
    recent_by_area = _recent_monitorings_by_area(
        session, [area.id for area in areas], organization_id
    )
    reads = [_area_to_read(area) for area in areas]
    for read in reads:
        read.recent_monitorings = recent_by_area.get(read.id, [])
    return reads, total


def _recent_monitorings_by_area(
    session: Session, area_ids: list[UUID], organization_id: UUID | None
) -> dict[UUID, list[MonitoringRead]]:
    stmt = (
        select(Monitoring)
        .join(Area)
        .join(Project)
        .where(Monitoring.area_id.in_(area_ids))  # type: ignore[attr-defined]
        .order_by(text("monitoring.visit_date desc"), text("monitoring.created_at desc"))
    )
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)

    recent_by_area: dict[UUID, list[MonitoringRead]] = {}
    for monitoring in session.exec(stmt).all():
        recent = recent_by_area.setdefault(monitoring.area_id, [])
        if len(recent) < RECENT_MONITORINGS_LIMIT:
            recent.append(MonitoringRead(**monitoring.model_dump()))
    return recent_by_area


def update_area(session: Session, area_id: UUID, data: AreaUpdate) -> AreaRead | None:
    area = session.get(Area, area_id)
    if not area:
        return None
    payload = data.model_dump(exclude_unset=True)
    if "coordinates" in payload:
        area.geometry = to_geometry(payload.pop("coordinates"))
    for field, value in payload.items():
        setattr(area, field, value)
    session.commit()
    session.refresh(area)
    return _area_to_read(area)


def delete_area(session: Session, area_id: UUID) -> bool:
    area = session.get(Area, area_id)
    if not area:
        return False
    session.delete(area)
    session.commit()
    return True

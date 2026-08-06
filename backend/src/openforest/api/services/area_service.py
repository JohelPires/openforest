from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.area import Area
from openforest.api.models.project import Project
from openforest.api.schemas.area import AreaCreate, AreaUpdate


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
) -> list[Area]:
    stmt = select(Area).join(Project).where(Area.project_id == project_id)
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return list(session.exec(stmt).all())


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

from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.area import Area
from openforest.api.models.project import Project
from openforest.api.schemas.area import AreaCreate, AreaUpdate


def create_area(session: Session, project_id: UUID, data: AreaCreate) -> Area:
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
    area = Area(**data.model_dump(), project_id=project_id)
    session.add(area)
    session.commit()
    session.refresh(area)
    return area


def get_area(session: Session, area_id: UUID) -> Area | None:
    return session.get(Area, area_id)


def list_areas(session: Session, project_id: UUID) -> list[Area]:
    return list(session.exec(select(Area).where(Area.project_id == project_id)).all())


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

from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.organization import Organization
from openforest.api.models.project import Project
from openforest.api.schemas.project import ProjectCreate, ProjectUpdate


def create_project(session: Session, data: ProjectCreate) -> Project:
    organization = session.get(Organization, data.organization_id)
    if not organization:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Organização com ID '{data.organization_id}' não encontrada",
                    "type": "not_found",
                }
            ],
        )
    project = Project(**data.model_dump())
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def get_project(session: Session, project_id: UUID) -> Project | None:
    return session.get(Project, project_id)


def list_projects(session: Session) -> list[Project]:
    return list(session.exec(select(Project)).all())


def update_project(session: Session, project_id: UUID, data: ProjectUpdate) -> Project | None:
    project = session.get(Project, project_id)
    if not project:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    session.commit()
    session.refresh(project)
    return project


def delete_project(session: Session, project_id: UUID) -> bool:
    project = session.get(Project, project_id)
    if not project:
        return False
    session.delete(project)
    session.commit()
    return True

from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.project import Project
from openforest.api.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from openforest.api.services.project_service import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projetos"])


@router.post("/", response_model=ProjectRead)
def create_project_route(session: SessionDep, data: ProjectCreate) -> Project:
    project = create_project(session, data)
    return project


@router.get("/", response_model=list[ProjectRead])
def list_projects_route(session: SessionDep) -> list[Project]:
    return list_projects(session)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project_route(session: SessionDep, project_id: UUID) -> Project | None:
    project = get_project(session, project_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project_route(session: SessionDep, project_id: UUID, data: ProjectUpdate) -> Project | None:
    project = update_project(session, project_id, data)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    return project


@router.delete("/{project_id}")
def delete_project_route(session: SessionDep, project_id: UUID) -> dict[str, str]:
    deleted = delete_project(session, project_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    return {"msg": "Projeto deletado com sucesso"}

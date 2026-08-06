from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session

from openforest.api.models.area import Area
from openforest.api.models.project import Project
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole


def resolve_area_organization_id(session: Session, area_id: UUID) -> UUID | None:
    area = session.get(Area, area_id)
    if not area:
        return None
    project = session.get(Project, area.project_id)
    if not project:
        return None
    return project.organization_id


def check_area_role(
    session: Session,
    user: User,
    current_org: UserOrganization | None,
    area_id: UUID,
    *roles: UserOrganizationRole,
) -> None:
    if user.is_superuser:
        return
    if current_org is None:
        raise HTTPException(
            status_code=403,
            detail=[
                {
                    "msg": "Usuário não vinculado a nenhuma organização",
                    "type": "no_organization",
                }
            ],
        )
    org_id = resolve_area_organization_id(session, area_id)
    if org_id is None:
        return
    if org_id != current_org.organization_id:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    if current_org.role not in roles:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )


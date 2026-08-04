from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session

from openforest.api.models.area import Area
from openforest.api.models.project import Project
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole


def check_area_write_permission(session: Session, user: User, area_id: UUID) -> None:
    area = session.get(Area, area_id)
    if not area:
        return
    project = session.get(Project, area.project_id)
    if not project:
        return
    membership = session.get(UserOrganization, (user.id, project.organization_id))
    if membership is None or membership.role not in (
        UserOrganizationRole.admin,
        UserOrganizationRole.manager,
    ):
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )

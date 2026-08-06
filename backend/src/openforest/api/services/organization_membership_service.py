from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
from openforest.api.schemas.organization import MemberAdd, MemberRead, MemberUpdate


def list_members(session: Session, organization_id: UUID) -> list[MemberRead]:
    stmt = (
        select(User, UserOrganization.role)
        .join(UserOrganization)
        .where(UserOrganization.organization_id == organization_id)
        .order_by(User.name)
    )
    return [
        MemberRead(
            user_id=user.id,
            organization_id=organization_id,
            role=role,
            name=user.name,
            email=user.email,
        )
        for user, role in session.exec(stmt).all()
    ]


def add_member(session: Session, organization_id: UUID, data: MemberAdd) -> MemberRead:
    user = session.get(User, data.user_id)
    if not user:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Usuário não encontrado", "type": "not_found"}],
        )
    existing = session.exec(
        select(UserOrganization).where(UserOrganization.user_id == data.user_id)
    ).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=[
                {
                    "msg": "Usuário já pertence a uma organização",
                    "type": "conflict",
                }
            ],
        )
    membership = UserOrganization(
        user_id=data.user_id, organization_id=organization_id, role=data.role
    )
    session.add(membership)
    session.commit()
    return MemberRead(
        user_id=data.user_id,
        organization_id=organization_id,
        role=data.role,
        name=user.name,
        email=user.email,
    )


def update_member_role(
    session: Session, organization_id: UUID, user_id: UUID, data: MemberUpdate
) -> MemberRead:
    membership = session.get(UserOrganization, (user_id, organization_id))
    if not membership:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Membro não encontrado", "type": "not_found"}],
        )
    if (
        membership.role == UserOrganizationRole.manager
        and data.role != UserOrganizationRole.manager
    ):
        other_managers = session.exec(
            select(UserOrganization).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.role == UserOrganizationRole.manager,
                UserOrganization.user_id != user_id,
            )
        ).all()
        if not other_managers:
            raise HTTPException(
                status_code=422,
                detail=[
                    {
                        "msg": "Não é possível remover o último manager",
                        "type": "last_manager",
                    }
                ],
            )
    membership.role = data.role
    session.commit()
    session.refresh(membership)
    user = session.get(User, user_id)
    return MemberRead(
        user_id=user_id,
        organization_id=organization_id,
        role=data.role,
        name=user.name if user else None,
        email=user.email if user else None,
    )


def remove_member(session: Session, organization_id: UUID, user_id: UUID) -> None:
    membership = session.get(UserOrganization, (user_id, organization_id))
    if not membership:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Membro não encontrado", "type": "not_found"}],
        )
    if membership.role == UserOrganizationRole.manager:
        other_managers = session.exec(
            select(UserOrganization).where(
                UserOrganization.organization_id == organization_id,
                UserOrganization.role == UserOrganizationRole.manager,
                UserOrganization.user_id != user_id,
            )
        ).all()
        if not other_managers:
            raise HTTPException(
                status_code=422,
                detail=[
                    {
                        "msg": "Não é possível remover o último manager",
                        "type": "last_manager",
                    }
                ],
            )
    session.delete(membership)
    session.commit()

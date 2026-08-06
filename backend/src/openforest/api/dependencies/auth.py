from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlmodel import Session, select

from openforest.api.infrastructure.database import get_session
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
from openforest.api.services.auth_service import decode_token

_bearer = HTTPBearer(auto_error=False)


def get_current_user(
    session: Annotated[Session, Depends(get_session)],
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if credentials is None:
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Token de acesso não fornecido", "type": "missing_token"}],
        )
    try:
        payload = decode_token(credentials.credentials)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Token expirado", "type": "token_expired"}],
        )
    except InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Token inválido", "type": "invalid_token"}],
        )

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Tipo de token inválido", "type": "invalid_token_type"}],
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Token inválido", "type": "invalid_token"}],
        )

    user = session.get(User, UUID(user_id))
    if user is None:
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Usuário não encontrado", "type": "user_not_found"}],
        )

    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]


def get_current_org(
    session: Annotated[Session, Depends(get_session)],
    current_user: CurrentUserDep,
) -> UserOrganization | None:
    if current_user.is_superuser:
        return None
    membership = session.exec(
        select(UserOrganization).where(UserOrganization.user_id == current_user.id)
    ).first()
    if membership is None:
        raise HTTPException(
            status_code=403,
            detail=[
                {
                    "msg": "Usuário não vinculado a nenhuma organização",
                    "type": "no_organization",
                }
            ],
        )
    return membership


CurrentOrgDep = Annotated[UserOrganization | None, Depends(get_current_org)]


def require_org_role(*roles: UserOrganizationRole) -> Any:
    def checker(
        session: Annotated[Session, Depends(get_session)],
        current_user: CurrentUserDep,
        current_org: CurrentOrgDep,
    ) -> None:
        if current_user.is_superuser:
            return
        if current_org is None or current_org.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
            )

    return Depends(checker)


def require_org_access(*roles: UserOrganizationRole) -> Any:
    def checker(
        session: Annotated[Session, Depends(get_session)],
        current_user: CurrentUserDep,
        current_org: CurrentOrgDep,
        organization_id: UUID,
    ) -> None:
        if current_user.is_superuser:
            return
        if current_org is None or current_org.organization_id != organization_id:
            raise HTTPException(
                status_code=404,
                detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
            )
        if current_org.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
            )

    return Depends(checker)


def require_superuser(current_user: CurrentUserDep) -> None:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )

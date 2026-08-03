from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlmodel import Session

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


def require_role(*roles: UserOrganizationRole) -> Any:
    def checker(
        session: Annotated[Session, Depends(get_session)],
        current_user: CurrentUserDep,
        organization_id: UUID,
    ) -> None:
        membership = session.get(
            UserOrganization,
            (current_user.id, organization_id),
        )
        if membership is None or membership.role not in roles:
            raise HTTPException(
                status_code=403,
                detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
            )

    return Depends(checker)

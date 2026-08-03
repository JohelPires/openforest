from uuid import UUID

from fastapi import APIRouter, HTTPException
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlmodel import select

from openforest.api.infrastructure.database import SessionDep
from openforest.api.infrastructure.redis import blacklist_token, is_token_blacklisted
from openforest.api.models.user import User
from openforest.api.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    Token,
    UserCreate,
)
from openforest.api.services.auth_service import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["autenticação"])


def _generate_tokens(user_id: str) -> Token:
    return Token(
        access_token=create_access_token(user_id),
        refresh_token=create_refresh_token(user_id),
    )


@router.post("/register", response_model=Token)
def register(session: SessionDep, data: UserCreate) -> Token:
    existing = session.exec(select(User).where(User.email == data.email)).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=[{"msg": "Email já cadastrado", "type": "duplicate_email"}],
        )
    user = User(
        name=data.name,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return _generate_tokens(str(user.id))


@router.post("/login", response_model=Token)
def login(session: SessionDep, data: LoginRequest) -> Token:
    user = session.exec(select(User).where(User.email == data.email)).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Email ou senha inválidos", "type": "invalid_credentials"}],
        )
    return _generate_tokens(str(user.id))


@router.post("/refresh", response_model=Token)
def refresh(session: SessionDep, data: RefreshRequest) -> Token:
    try:
        payload = decode_token(data.refresh_token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Token de refresh expirado", "type": "token_expired"}],
        )
    except InvalidTokenError:
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Token de refresh inválido", "type": "invalid_token"}],
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Tipo de token inválido", "type": "invalid_token_type"}],
        )

    jti = payload.get("jti")
    if jti and is_token_blacklisted(jti):
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Token de refresh já foi invalidado", "type": "token_blacklisted"}],
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

    return _generate_tokens(user_id)


@router.post("/logout")
def logout(data: RefreshRequest) -> dict[str, str]:
    try:
        payload = decode_token(data.refresh_token)
    except (ExpiredSignatureError, InvalidTokenError):
        raise HTTPException(
            status_code=401,
            detail=[{"msg": "Token de refresh inválido", "type": "invalid_token"}],
        )

    jti = payload.get("jti")
    exp = payload.get("exp")
    if jti and exp:
        expires_in = max(exp - int(__import__("time").time()), 0)
        blacklist_token(jti, expires_in)

    return {"msg": "Logout realizado com sucesso"}

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.bcrypt import BcryptHasher

from openforest.api.config import settings

_pwd_context: PasswordHash = PasswordHash([BcryptHasher()])


def hash_password(password: str) -> str:
    return str(_pwd_context.hash(password))


def verify_password(plain: str, hashed: str) -> bool:
    return bool(_pwd_context.verify(plain, hashed))


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
        "iat": now,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def create_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    jti = str(uuid4())
    payload = {
        "sub": user_id,
        "exp": now + timedelta(days=settings.refresh_token_expire_days),
        "type": "refresh",
        "jti": jti,
        "iat": now,
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])

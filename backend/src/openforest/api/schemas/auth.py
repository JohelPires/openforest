from datetime import datetime
from uuid import UUID

from sqlmodel import SQLModel


class UserCreate(SQLModel):
    name: str
    email: str
    password: str


class UserRead(SQLModel):
    id: UUID
    name: str
    email: str
    created_at: datetime
    updated_at: datetime


class Token(SQLModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(SQLModel):
    email: str
    password: str


class RefreshRequest(SQLModel):
    refresh_token: str

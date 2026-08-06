from sqlmodel import Field

from openforest.api.models.base import Base


class User(Base, table=True):
    __tablename__ = "user"

    name: str = Field(nullable=False)
    email: str = Field(nullable=False, unique=True, index=True)
    password_hash: str = Field(nullable=False)
    is_superuser: bool = Field(default=False)

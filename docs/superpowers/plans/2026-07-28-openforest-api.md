# OpenForest API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a REST API for collaborative monitoring of environmental restoration projects: project/area registration, field data collection, photo upload, simulated sensors, and real-time dashboard.

**Architecture:** FastAPI + SQLModel (PostgreSQL) with services layer for business logic, infrastructure layer for external connections, and SSE for real-time streaming. JWT authentication. Background task for sensor simulation.

**Tech Stack:** Python 3.12+, FastAPI, SQLModel, PostgreSQL, Redis, Alembic, pytest+httpx, uv, Ruff, mypy, passlib[bcrypt], pyjwt

## Global Constraints

- All SQLModel models in `models/`, Pydantic schemas in `schemas/`, business logic in `services/`, routers in `routers/`, dependencies in `dependencies/`, external connections in `infrastructure/`
- Use `Annotated` for all `Path`, `Query`, `Header`, `Depends`
- Sync (`def`) endpoints by default; async (`async def`) only with async libraries
- Every table must inherit `Base` with `id` (UUID PK), `created_at`, `updated_at`
- Error responses must be `list[dict]` with `msg` and `type` keys
- JWT access token: 15 min, refresh token: 7 days, algorithm: HS256
- Passwords hashed with bcrypt via `passlib`
- All endpoints versioned under `/v1/`
- Each task must include tests and pass before moving to next

---

### Task 1: Project Scaffold, Configuration, and Entrypoint

**Files:**
- Create: `src/openforest/api/__init__.py`
- Create: `src/openforest/api/config.py`
- Create: `src/openforest/api/main.py`
- Create: `pyproject.toml`
- Create: `.env.example`
- Create: `tests/__init__.py`
- Create: `tests/conftest.py`

**Interfaces:**
- Consumes: nothing (first task)
- Produces: `settings` singleton from `config.py`, FastAPI `app` from `main.py`, test fixtures from `conftest.py`

- [ ] **Step 1: Write `pyproject.toml` with all dependencies**

```toml
[project]
name = "openforest-api"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "fastapi[standard]>=0.115.0",
    "sqlmodel>=0.0.22",
    "psycopg2-binary>=2.9",
    "redis>=5.0",
    "pyjwt>=2.8",
    "passlib[bcrypt]>=1.7",
    "python-multipart>=0.0.9",
    "pydantic-settings>=2.0",
    "alembic>=1.13",
]

[project.optional-dependencies]
dev = [
    "pytest>=8.0",
    "httpx>=0.27",
    "pytest-cov>=5.0",
    "ruff>=0.5",
    "mypy>=1.10",
]

[tool.fastapi]
entrypoint = "src/openforest/api/main:app"

[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "N", "W"]

[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = true

[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-v --tb=short"
```

- [ ] **Step 2: Write `config.py`**

```python
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost:5432/openforest"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    storage_backend: str = "local"
    storage_path: str = "./uploads"

    model_config = {"env_file": ".env"}


settings = Settings()
```

- [ ] **Step 3: Write `main.py`**

```python
from fastapi import FastAPI

app = FastAPI(title="OpenForest API", version="0.1.0")


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "OpenForest API"}
```

- [ ] **Step 4: Write `__init__.py` files**

In `src/openforest/api/__init__.py` and `tests/__init__.py`, leave empty.

- [ ] **Step 5: Write `.env.example`**

```
DATABASE_URL=postgresql://localhost:5432/openforest
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=change-me
STORAGE_BACKEND=local
STORAGE_PATH=./uploads
```

- [ ] **Step 6: Write `tests/conftest.py`**

```python
from collections.abc import Generator
from typing import Annotated

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from openforest.api.main import app


@pytest.fixture
def session() -> Generator[Session, None, None]:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture
def client(session: Session) -> Generator[TestClient, None, None]:
    def get_session_override() -> Session:
        return session

    app.dependency_overrides.clear()
    with TestClient(app) as c:
        yield c
```

- [ ] **Step 7: Write test to verify app starts**

```python
# tests/test_main.py

from fastapi.testclient import TestClient


def test_root(client: TestClient) -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "OpenForest API"}
```

- [ ] **Step 8: Run tests and install dependencies**

Run: `uv sync && source .venv/bin/activate`
Run: `pytest -x`
Expected: 1 passed

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: scaffold FastAPI project with config and test infra"
```

---

### Task 2: Database Layer and Base Model

**Files:**
- Create: `src/openforest/api/infrastructure/__init__.py`
- Create: `src/openforest/api/infrastructure/database.py`
- Create: `src/openforest/api/models/__init__.py`
- Create: `src/openforest/api/models/base.py`
- Create: `src/openforest/api/dependencies/__init__.py`
- Create: `src/openforest/api/dependencies/database.py`
- Create: `alembic.ini`
- Create: `alembic/env.py`
- Modify: `tests/conftest.py` (add imports)

**Interfaces:**
- Consumes: `settings` from `config.py`
- Produces: `engine` from `database.py`, `get_session()` dependency, `Base` model class, `SessionDep` type alias

- [ ] **Step 1: Write `infrastructure/database.py`**

```python
from collections.abc import Generator

from sqlmodel import Session, create_engine

from openforest.api.config import settings

engine = create_engine(str(settings.database_url))


def get_session() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session
```

- [ ] **Step 2: Write `models/base.py`**

```python
from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlmodel import Field, SQLModel


class Base(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
```

- [ ] **Step 3: Write `dependencies/database.py`**

```python
from typing import Annotated

from fastapi import Depends
from sqlmodel import Session

from openforest.api.infrastructure.database import get_session

SessionDep = Annotated[Session, Depends(get_session)]
```

- [ ] **Step 4: Set up Alembic**

Run: `alembic init alembic`

Configure `alembic/env.py`:

```python
from sqlmodel import SQLModel
from openforest.api.models.base import Base
from openforest.api.infrastructure.database import engine
from openforest.api.config import settings

target_metadata = SQLModel.metadata

def run_migrations_online() -> None:
    with engine.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()
```

Set `sqlalchemy.url = %(DATABASE_URL)s` in `alembic.ini` (or use env var).

- [ ] **Step 5: Write test for session dependency**

```python
# tests/test_database.py

from sqlmodel import Session


def test_get_session(session: Session) -> None:
    assert isinstance(session, Session)
```

- [ ] **Step 6: Run tests**

Run: `pytest -x`
Expected: 2 passed

- [ ] **Step 7: Commit**

```bash
git add -A && git commit -m "feat: add database layer, base model, and session dependency"
```

---

### Task 3: User Model and Authentication (Register, Login, Refresh, Logout)

**Files:**
- Create: `src/openforest/api/models/user.py`
- Create: `src/openforest/api/schemas/__init__.py`
- Create: `src/openforest/api/schemas/auth.py`
- Create: `src/openforest/api/services/__init__.py`
- Create: `src/openforest/api/services/auth_service.py`
- Create: `src/openforest/api/dependencies/auth.py`
- Create: `src/openforest/api/routers/__init__.py`
- Create: `src/openforest/api/routers/auth.py`
- Modify: `src/openforest/api/main.py` (include auth router)
- Modify: `src/openforest/api/models/__init__.py` (export User)
- Modify: `src/openforest/api/routers/__init__.py` (export router)
- Create: `tests/test_auth.py`

**Interfaces:**
- Consumes: `SessionDep`, `Base`, `settings`
- Produces: `User` model, `auth_service` functions (`register`, `login`, `refresh`, `logout`), `get_current_user()` dependency, `CurrentUserDep` type alias, auth router at `/v1/auth`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_auth.py

from fastapi.testclient import TestClient


def test_register(client: TestClient) -> None:
    response = client.post(
        "/v1/auth/register",
        json={"email": "test@test.com", "password": "secret123"},
    )
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["email"] == "test@test.com"
    assert "password" not in data


def test_login(client: TestClient) -> None:
    client.post(
        "/v1/auth/register",
        json={"email": "test@test.com", "password": "secret123"},
    )
    response = client.post(
        "/v1/auth/login",
        json={"email": "test@test.com", "password": "secret123"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client: TestClient) -> None:
    client.post(
        "/v1/auth/register",
        json={"email": "test@test.com", "password": "secret123"},
    )
    response = client.post(
        "/v1/auth/login",
        json={"email": "test@test.com", "password": "wrong"},
    )
    assert response.status_code == 401


def test_refresh(client: TestClient) -> None:
    client.post(
        "/v1/auth/register",
        json={"email": "test@test.com", "password": "secret123"},
    )
    login_resp = client.post(
        "/v1/auth/login",
        json={"email": "test@test.com", "password": "secret123"},
    )
    refresh_token = login_resp.json()["refresh_token"]
    response = client.post(
        "/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_me_endpoint(client: TestClient) -> None:
    client.post(
        "/v1/auth/register",
        json={"email": "test@test.com", "password": "secret123"},
    )
    login_resp = client.post(
        "/v1/auth/login",
        json={"email": "test@test.com", "password": "secret123"},
    )
    token = login_resp.json()["access_token"]
    response = client.get(
        "/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    assert response.json()["email"] == "test@test.com"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/test_auth.py -v`
Expected: All tests fail (import errors, 404, etc.)

- [ ] **Step 3: Write `models/user.py`**

```python
from sqlmodel import Field

from openforest.api.models.base import Base


class User(Base, table=True):
    __tablename__ = "users"

    email: str = Field(unique=True, index=True)
    hashed_password: str
    is_active: bool = Field(default=True)
```

- [ ] **Step 4: Write `schemas/auth.py`**

```python
from uuid import UUID

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: str
    password: str


class UserRead(BaseModel):
    id: UUID
    email: str
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LoginRequest(BaseModel):
    email: str
    password: str
```

- [ ] **Step 5: Write `services/auth_service.py`**

```python
from datetime import datetime, timedelta, timezone
from uuid import UUID

import jwt
from passlib.context import CryptContext
from sqlmodel import Session, select

from openforest.api.config import settings
from openforest.api.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"])


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    return jwt.encode(
        {"sub": str(user_id), "exp": expire, "type": "access"},
        settings.secret_key,
        algorithm="HS256",
    )


def create_refresh_token(user_id: UUID) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    return jwt.encode(
        {"sub": str(user_id), "exp": expire, "type": "refresh"},
        settings.secret_key,
        algorithm="HS256",
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=["HS256"])


def register_user(session: Session, email: str, password: str) -> User:
    existing = session.exec(select(User).where(User.email == email)).first()
    if existing:
        raise ValueError("Email already registered")
    user = User(email=email, hashed_password=hash_password(password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def authenticate_user(session: Session, email: str, password: str) -> User:
    user = session.exec(select(User).where(User.email == email)).first()
    if not user or not verify_password(password, user.hashed_password):
        raise ValueError("Invalid credentials")
    return user
```

- [ ] **Step 6: Write `dependencies/auth.py`**

```python
from typing import Annotated

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlmodel import Session, select

from openforest.api.dependencies.database import SessionDep
from openforest.api.models.user import User
from openforest.api.services.auth_service import decode_token

security = HTTPBearer()


def get_current_user(
    session: SessionDep,
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)],
) -> User:
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail=[{"msg": "Invalid token type", "type": "auth_error"}])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail=[{"msg": "Invalid token", "type": "auth_error"}])
    except InvalidTokenError:
        raise HTTPException(status_code=401, detail=[{"msg": "Invalid token", "type": "auth_error"}])

    user = session.exec(select(User).where(User.id == user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail=[{"msg": "User not found", "type": "auth_error"}])
    return user


CurrentUserDep = Annotated[User, Depends(get_current_user)]
```

- [ ] **Step 7: Write `routers/auth.py`**

```python
from fastapi import APIRouter, HTTPException
from sqlmodel import select

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.database import SessionDep
from openforest.api.models.user import User
from openforest.api.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserCreate,
    UserRead,
)
from openforest.api.services.auth_service import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    decode_token,
    register_user,
)

router = APIRouter(prefix="/v1/auth", tags=["autenticação"])


@router.post("/register", status_code=201)
def register(session: SessionDep, body: UserCreate) -> UserRead:
    try:
        user = register_user(session, body.email, body.password)
    except ValueError:
        raise HTTPException(status_code=409, detail=[{"msg": "Email já registrado", "type": "conflict"}])
    return UserRead(id=user.id, email=user.email, is_active=user.is_active)


@router.post("/login")
def login(session: SessionDep, body: LoginRequest) -> TokenResponse:
    try:
        user = authenticate_user(session, body.email, body.password)
    except ValueError:
        raise HTTPException(status_code=401, detail=[{"msg": "Credenciais inválidas", "type": "auth_error"}])
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/refresh")
def refresh(session: SessionDep, body: RefreshRequest) -> TokenResponse:
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError
        user = session.exec(select(User).where(User.id == payload["sub"])).first()
        if not user:
            raise ValueError
    except (ValueError, KeyError):
        raise HTTPException(status_code=401, detail=[{"msg": "Refresh token inválido", "type": "auth_error"}])
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me")
def me(current_user: CurrentUserDep) -> UserRead:
    return UserRead(
        id=current_user.id,
        email=current_user.email,
        is_active=current_user.is_active,
    )
```

- [ ] **Step 8: Wire router in `main.py`**

```python
from openforest.api.routers import auth

app.include_router(auth.router)
```

- [ ] **Step 9: Add missing dependencies to pyproject.toml**

Add `"python-jose[cryptography]"` or ensure JWT works. Actually let's use `pyjwt`. Make sure `pyjwt` and `passlib[bcrypt]` are in deps.

- [ ] **Step 10: Run tests to verify they pass**

Run: `pytest tests/test_auth.py -v`
Expected: All 5 tests pass

- [ ] **Step 11: Commit**

```bash
git add -A && git commit -m "feat: add user model and JWT auth (register, login, refresh, me)"
```

---

### Task 4: Projects CRUD

**Files:**
- Create: `src/openforest/api/models/project.py`
- Create: `src/openforest/api/schemas/project.py`
- Create: `src/openforest/api/services/project_service.py`
- Create: `src/openforest/api/routers/projects.py`
- Modify: `src/openforest/api/main.py` (include projects router)
- Modify: `src/openforest/api/models/__init__.py` (export Project)
- Create: `tests/test_projects.py`

**Interfaces:**
- Consumes: `SessionDep`, `CurrentUserDep`, `Base`, `User`
- Produces: `Project` model, project CRUD endpoints at `/v1/projects`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_projects.py
from uuid import UUID

from fastapi.testclient import TestClient


def test_create_project(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.post(
        "/v1/projects",
        json={
            "name": "Reflorestamento Mata Atlântica",
            "description": "Projeto de recuperação da Mata Atlântica",
            "location": "São Paulo, Brasil",
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Reflorestamento Mata Atlântica"
    assert "id" in data
    UUID(data["id"])


def test_list_projects(client: TestClient, auth_headers: dict[str, str]) -> None:
    client.post(
        "/v1/projects",
        json={"name": "Projeto A", "location": "Local A"},
        headers=auth_headers,
    )
    client.post(
        "/v1/projects",
        json={"name": "Projeto B", "location": "Local B"},
        headers=auth_headers,
    )
    response = client.get("/v1/projects", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_project(client: TestClient, auth_headers: dict[str, str]) -> None:
    create_resp = client.post(
        "/v1/projects",
        json={"name": "Projeto Teste", "location": "Local"},
        headers=auth_headers,
    )
    project_id = create_resp.json()["id"]
    response = client.get(f"/v1/projects/{project_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Projeto Teste"


def test_get_project_not_found(client: TestClient, auth_headers: dict[str, str]) -> None:
    response = client.get("/v1/projects/00000000-0000-0000-0000-000000000000", headers=auth_headers)
    assert response.status_code == 404


def test_update_project(client: TestClient, auth_headers: dict[str, str]) -> None:
    create_resp = client.post(
        "/v1/projects",
        json={"name": "Original", "location": "Local"},
        headers=auth_headers,
    )
    project_id = create_resp.json()["id"]
    response = client.put(
        f"/v1/projects/{project_id}",
        json={"name": "Atualizado"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Atualizado"


def test_delete_project(client: TestClient, auth_headers: dict[str, str]) -> None:
    create_resp = client.post(
        "/v1/projects",
        json={"name": "Para deletar", "location": "Local"},
        headers=auth_headers,
    )
    project_id = create_resp.json()["id"]
    response = client.delete(f"/v1/projects/{project_id}", headers=auth_headers)
    assert response.status_code == 204


def test_create_project_unauthenticated(client: TestClient) -> None:
    response = client.post(
        "/v1/projects",
        json={"name": "Projeto", "location": "Local"},
    )
    assert response.status_code == 401
```

- [ ] **Step 2: Add `auth_headers` fixture to `tests/conftest.py`**

```python
@pytest.fixture
def auth_headers(client: TestClient) -> dict[str, str]:
    client.post(
        "/v1/auth/register",
        json={"email": "test@test.com", "password": "secret123"},
    )
    resp = client.post(
        "/v1/auth/login",
        json={"email": "test@test.com", "password": "secret123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pytest tests/test_projects.py -v`
Expected: All fail (ImportError, 404, etc.)

- [ ] **Step 4: Write `models/project.py`**

```python
from sqlmodel import Field, Relationship

from openforest.api.models.base import Base


class Project(Base, table=True):
    __tablename__ = "projects"

    name: str = Field(max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    location: str | None = Field(default=None, max_length=500)
    owner_id: int | None = Field(default=None, foreign_key="users.id")

    owner: "User" | None = Relationship(back_populates="projects")
```

Add relationship to `User` in `models/user.py`:

```python
projects: list["Project"] = Relationship(back_populates="owner")
```

- [ ] **Step 5: Write `schemas/project.py`**

```python
from uuid import UUID

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None
    location: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    location: str | None = None


class ProjectRead(BaseModel):
    id: UUID
    name: str
    description: str | None
    location: str | None
    owner_id: UUID | None
```

- [ ] **Step 6: Write `services/project_service.py`**

```python
from collections.abc import Sequence
from uuid import UUID

from sqlmodel import Session, select

from openforest.api.models.project import Project


def create_project(session: Session, data: dict, owner_id: UUID) -> Project:
    project = Project(**data, owner_id=owner_id)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def list_projects(session: Session) -> Sequence[Project]:
    return session.exec(select(Project)).all()


def get_project(session: Session, project_id: UUID) -> Project | None:
    return session.get(Project, project_id)


def update_project(session: Session, project: Project, data: dict) -> Project:
    for key, value in data.items():
        setattr(project, key, value)
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def delete_project(session: Session, project: Project) -> None:
    session.delete(project)
    session.commit()
```

- [ ] **Step 7: Write `routers/projects.py`**

```python
from collections.abc import Sequence
from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.database import SessionDep
from openforest.api.models.project import Project
from openforest.api.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from openforest.api.services import project_service

router = APIRouter(prefix="/v1/projects", tags=["projetos"])


@router.post("", status_code=201)
def create(
    session: SessionDep,
    current_user: CurrentUserDep,
    body: ProjectCreate,
) -> ProjectRead:
    project = project_service.create_project(session, body.model_dump(), current_user.id)
    return ProjectRead(**project.model_dump())


@router.get("")
def list(
    session: SessionDep,
    current_user: CurrentUserDep,
) -> Sequence[ProjectRead]:
    projects = project_service.list_projects(session)
    return [ProjectRead(**p.model_dump()) for p in projects]


@router.get("/{project_id}")
def get(
    session: SessionDep,
    current_user: CurrentUserDep,
    project_id: UUID,
) -> ProjectRead:
    project = project_service.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=[{"msg": "Projeto não encontrado", "type": "not_found"}])
    return ProjectRead(**project.model_dump())


@router.put("/{project_id}")
def update(
    session: SessionDep,
    current_user: CurrentUserDep,
    project_id: UUID,
    body: ProjectUpdate,
) -> ProjectRead:
    project = project_service.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=[{"msg": "Projeto não encontrado", "type": "not_found"}])
    updated = project_service.update_project(session, project, body.model_dump(exclude_unset=True))
    return ProjectRead(**updated.model_dump())


@router.delete("/{project_id}", status_code=204)
def delete(
    session: SessionDep,
    current_user: CurrentUserDep,
    project_id: UUID,
) -> None:
    project = project_service.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=[{"msg": "Projeto não encontrado", "type": "not_found"}])
    project_service.delete_project(session, project)
```

- [ ] **Step 8: Wire router in `main.py`**

```python
from openforest.api.routers import auth, projects

app.include_router(auth.router)
app.include_router(projects.router)
```

- [ ] **Step 9: Run tests**

Run: `pytest tests/test_projects.py -v`
Expected: All tests pass

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "feat: add projects CRUD endpoints"
```

---

### Task 5: Areas CRUD

**Files:**
- Create: `src/openforest/api/models/area.py`
- Create: `src/openforest/api/schemas/area.py`
- Create: `src/openforest/api/services/area_service.py`
- Create: `src/openforest/api/routers/areas.py`
- Modify: `src/openforest/api/main.py` (include areas router)
- Create: `tests/test_areas.py`

**Interfaces:**
- Consumes: `SessionDep`, `CurrentUserDep`, `Project` model
- Produces: `Area` model, area CRUD endpoints at `/v1/projects/{project_id}/areas`

- [ ] **Step 1: Write `models/area.py`**

```python
from uuid import UUID

from sqlmodel import Field, Relationship

from openforest.api.models.base import Base


class Area(Base, table=True):
    __tablename__ = "areas"

    name: str = Field(max_length=255)
    description: str | None = Field(default=None, max_length=2000)
    geometry: str | None = Field(default=None)  # GeoJSON
    size_hectares: float | None = None
    project_id: UUID = Field(foreign_key="projects.id")

    project: "Project" = Relationship(back_populates="areas")
```

Add relationship in `models/project.py`:

```python
areas: list["Area"] = Relationship(back_populates="project")
```

- [ ] **Step 2: Write `schemas/area.py`**

```python
from uuid import UUID

from pydantic import BaseModel


class AreaCreate(BaseModel):
    name: str
    description: str | None = None
    geometry: str | None = None
    size_hectares: float | None = None


class AreaUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    geometry: str | None = None
    size_hectares: float | None = None


class AreaRead(BaseModel):
    id: UUID
    name: str
    description: str | None
    geometry: str | None
    size_hectares: float | None
    project_id: UUID
```

- [ ] **Step 3: Write `services/area_service.py`**

```python
from collections.abc import Sequence
from uuid import UUID

from sqlmodel import Session, select

from openforest.api.models.area import Area


def create_area(session: Session, project_id: UUID, data: dict) -> Area:
    area = Area(**data, project_id=project_id)
    session.add(area)
    session.commit()
    session.refresh(area)
    return area


def list_areas(session: Session, project_id: UUID) -> Sequence[Area]:
    return session.exec(select(Area).where(Area.project_id == project_id)).all()


def get_area(session: Session, area_id: UUID) -> Area | None:
    return session.get(Area, area_id)


def update_area(session: Session, area: Area, data: dict) -> Area:
    for key, value in data.items():
        setattr(area, key, value)
    session.add(area)
    session.commit()
    session.refresh(area)
    return area


def delete_area(session: Session, area: Area) -> None:
    session.delete(area)
    session.commit()
```

- [ ] **Step 4: Write `routers/areas.py`**

```python
from collections.abc import Sequence
from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.database import SessionDep
from openforest.api.schemas.area import AreaCreate, AreaRead, AreaUpdate
from openforest.api.services import area_service, project_service

router = APIRouter(prefix="/v1/projects/{project_id}/areas", tags=["áreas"])


@router.post("", status_code=201)
def create(
    session: SessionDep,
    current_user: CurrentUserDep,
    project_id: UUID,
    body: AreaCreate,
) -> AreaRead:
    project = project_service.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=[{"msg": "Projeto não encontrado", "type": "not_found"}])
    area = area_service.create_area(session, project_id, body.model_dump())
    return AreaRead(**area.model_dump())


@router.get("")
def list(
    session: SessionDep,
    current_user: CurrentUserDep,
    project_id: UUID,
) -> Sequence[AreaRead]:
    project = project_service.get_project(session, project_id)
    if not project:
        raise HTTPException(status_code=404, detail=[{"msg": "Projeto não encontrado", "type": "not_found"}])
    areas = area_service.list_areas(session, project_id)
    return [AreaRead(**a.model_dump()) for a in areas]


@router.get("/{area_id}")
def get(
    session: SessionDep,
    current_user: CurrentUserDep,
    project_id: UUID,
    area_id: UUID,
) -> AreaRead:
    area = area_service.get_area(session, area_id)
    if not area or area.project_id != project_id:
        raise HTTPException(status_code=404, detail=[{"msg": "Área não encontrada", "type": "not_found"}])
    return AreaRead(**area.model_dump())


@router.put("/{area_id}")
def update(
    session: SessionDep,
    current_user: CurrentUserDep,
    project_id: UUID,
    area_id: UUID,
    body: AreaUpdate,
) -> AreaRead:
    area = area_service.get_area(session, area_id)
    if not area or area.project_id != project_id:
        raise HTTPException(status_code=404, detail=[{"msg": "Área não encontrada", "type": "not_found"}])
    updated = area_service.update_area(session, area, body.model_dump(exclude_unset=True))
    return AreaRead(**updated.model_dump())


@router.delete("/{area_id}", status_code=204)
def delete(
    session: SessionDep,
    current_user: CurrentUserDep,
    project_id: UUID,
    area_id: UUID,
) -> None:
    area = area_service.get_area(session, area_id)
    if not area or area.project_id != project_id:
        raise HTTPException(status_code=404, detail=[{"msg": "Área não encontrada", "type": "not_found"}])
    area_service.delete_area(session, area)
```

- [ ] **Step 5: Wire in `main.py`**

```python
from openforest.api.routers import areas, auth, projects

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(areas.router)
```

- [ ] **Step 6: Write `tests/test_areas.py`**

```python
from fastapi.testclient import TestClient


def test_create_area(client: TestClient, auth_headers: dict[str, str]) -> None:
    proj_resp = client.post(
        "/v1/projects",
        json={"name": "Projeto Teste", "location": "SP"},
        headers=auth_headers,
    )
    project_id = proj_resp.json()["id"]
    response = client.post(
        f"/v1/projects/{project_id}/areas",
        json={"name": "Área 1", "size_hectares": 10.5},
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Área 1"
    assert data["size_hectares"] == 10.5


def test_list_areas(client: TestClient, auth_headers: dict[str, str]) -> None:
    proj_resp = client.post(
        "/v1/projects",
        json={"name": "Projeto", "location": "SP"},
        headers=auth_headers,
    )
    project_id = proj_resp.json()["id"]
    client.post(f"/v1/projects/{project_id}/areas", json={"name": "A1"}, headers=auth_headers)
    client.post(f"/v1/projects/{project_id}/areas", json={"name": "A2"}, headers=auth_headers)
    response = client.get(f"/v1/projects/{project_id}/areas", headers=auth_headers)
    assert len(response.json()) == 2


def test_get_area_not_found(client: TestClient, auth_headers: dict[str, str]) -> None:
    proj_resp = client.post(
        "/v1/projects",
        json={"name": "Projeto", "location": "SP"},
        headers=auth_headers,
    )
    project_id = proj_resp.json()["id"]
    response = client.get(
        f"/v1/projects/{project_id}/areas/00000000-0000-0000-0000-000000000000",
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_delete_area(client: TestClient, auth_headers: dict[str, str]) -> None:
    proj_resp = client.post(
        "/v1/projects",
        json={"name": "Projeto", "location": "SP"},
        headers=auth_headers,
    )
    project_id = proj_resp.json()["id"]
    area_resp = client.post(
        f"/v1/projects/{project_id}/areas",
        json={"name": "Pra deletar"},
        headers=auth_headers,
    )
    area_id = area_resp.json()["id"]
    response = client.delete(
        f"/v1/projects/{project_id}/areas/{area_id}",
        headers=auth_headers,
    )
    assert response.status_code == 204
```

- [ ] **Step 7: Run tests**

Run: `pytest tests/test_areas.py -v`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: add areas CRUD endpoints nested under projects"
```

---

### Task 6: Field Data Collection and Photo Upload

**Files:**
- Create: `src/openforest/api/models/field_collection.py`
- Create: `src/openforest/api/schemas/field_collection.py`
- Create: `src/openforest/api/infrastructure/storage.py`
- Create: `src/openforest/api/services/field_collection_service.py`
- Create: `src/openforest/api/routers/field_collections.py`
- Modify: `src/openforest/api/main.py` (include router)
- Create: `tests/test_field_collections.py`

**Interfaces:**
- Consumes: `SessionDep`, `CurrentUserDep`, `Area` model
- Produces: `FieldCollection` model, species/muda/photo endpoints

- [ ] **Step 1: Write `models/field_collection.py`**

```python
from uuid import UUID

from sqlmodel import Field, Relationship

from openforest.api.models.base import Base


class FieldCollection(Base, table=True):
    __tablename__ = "field_collections"

    species: str | None = Field(default=None, max_length=255)
    seedlings_planted: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = Field(default=None, max_length=5000)
    photo_path: str | None = None
    collected_by: UUID = Field(foreign_key="users.id")
    area_id: UUID = Field(foreign_key="areas.id")

    collector: "User" = Relationship()
    area: "Area" = Relationship(back_populates="collections")
```

Add relationship in `models/area.py`:

```python
collections: list["FieldCollection"] = Relationship(back_populates="area")
```

- [ ] **Step 2: Write `schemas/field_collection.py`**

```python
from uuid import UUID

from pydantic import BaseModel


class FieldCollectionCreate(BaseModel):
    species: str | None = None
    seedlings_planted: int | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class FieldCollectionRead(BaseModel):
    id: UUID
    species: str | None
    seedlings_planted: int | None
    latitude: float | None
    longitude: float | None
    notes: str | None
    photo_path: str | None
    collected_by: UUID
    area_id: UUID
```

- [ ] **Step 3: Write `infrastructure/storage.py`**

```python
import shutil
from pathlib import Path
from uuid import uuid4

from openforest.api.config import settings


def save_upload(file_bytes: bytes, original_filename: str) -> str:
    ext = Path(original_filename).suffix if original_filename else ".bin"
    filename = f"{uuid4()}{ext}"
    upload_dir = Path(settings.storage_path)
    upload_dir.mkdir(parents=True, exist_ok=True)
    filepath = upload_dir / filename
    filepath.write_bytes(file_bytes)
    return str(filepath)
```

- [ ] **Step 4: Write `services/field_collection_service.py`**

```python
from uuid import UUID

from sqlmodel import Session

from openforest.api.models.field_collection import FieldCollection


def create_collection(session: Session, area_id: UUID, collected_by: UUID, data: dict) -> FieldCollection:
    record = FieldCollection(**data, area_id=area_id, collected_by=collected_by)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record
```

- [ ] **Step 5: Write `routers/field_collections.py`**

```python
from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.database import SessionDep
from openforest.api.schemas.field_collection import FieldCollectionCreate, FieldCollectionRead
from openforest.api.services import area_service, field_collection_service
from openforest.api.infrastructure.storage import save_upload

router = APIRouter(prefix="/v1/areas/{area_id}/collections", tags=["coletas de campo"])


@router.post("", status_code=201)
def create(
    session: SessionDep,
    current_user: CurrentUserDep,
    area_id: UUID,
    body: FieldCollectionCreate,
) -> FieldCollectionRead:
    area = area_service.get_area(session, area_id)
    if not area:
        raise HTTPException(status_code=404, detail=[{"msg": "Área não encontrada", "type": "not_found"}])
    record = field_collection_service.create_collection(
        session, area_id, current_user.id, body.model_dump()
    )
    return FieldCollectionRead(**record.model_dump())


@router.post("/photo", status_code=201)
def upload_photo(
    session: SessionDep,
    current_user: CurrentUserDep,
    area_id: UUID,
    file: UploadFile,
) -> dict:
    area = area_service.get_area(session, area_id)
    if not area:
        raise HTTPException(status_code=404, detail=[{"msg": "Área não encontrada", "type": "not_found"}])
    data = file.file.read()
    path = save_upload(data, file.filename or "photo.jpg")
    record = field_collection_service.create_collection(
        session, area_id, current_user.id, {"photo_path": path}
    )
    return {"id": str(record.id), "photo_path": path}
```

- [ ] **Step 6: Wire in `main.py`**

```python
from openforest.api.routers import areas, auth, field_collections, projects

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(areas.router)
app.include_router(field_collections.router)
```

- [ ] **Step 7: Write `tests/test_field_collections.py`**

```python
from fastapi.testclient import TestClient


def test_create_collection(client: TestClient, auth_headers: dict[str, str]) -> None:
    proj = client.post("/v1/projects", json={"name": "P"}, headers=auth_headers).json()
    area = client.post(
        f"/v1/projects/{proj['id']}/areas",
        json={"name": "A"},
        headers=auth_headers,
    ).json()
    response = client.post(
        f"/v1/areas/{area['id']}/collections",
        json={
            "species": "Araucaria angustifolia",
            "seedlings_planted": 50,
            "latitude": -23.5505,
            "longitude": -46.6333,
        },
        headers=auth_headers,
    )
    assert response.status_code == 201
    data = response.json()
    assert data["species"] == "Araucaria angustifolia"
    assert data["seedlings_planted"] == 50


def test_upload_photo(client: TestClient, auth_headers: dict[str, str]) -> None:
    proj = client.post("/v1/projects", json={"name": "P"}, headers=auth_headers).json()
    area = client.post(
        f"/v1/projects/{proj['id']}/areas",
        json={"name": "A"},
        headers=auth_headers,
    ).json()
    response = client.post(
        f"/v1/areas/{area['id']}/collections/photo",
        files={"file": ("test.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert "photo_path" in response.json()
```

- [ ] **Step 8: Run tests**

Run: `pytest tests/test_field_collections.py -v`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add field data collection and photo upload"
```

---

### Task 7: Simulated Sensors

**Files:**
- Create: `src/openforest/api/models/sensor_data.py`
- Create: `src/openforest/api/schemas/sensor_data.py`
- Create: `src/openforest/api/services/sensor_service.py`
- Create: `src/openforest/api/routers/sensors.py`
- Modify: `src/openforest/api/main.py` (include router, lifespan with background task)
- Create: `tests/test_sensors.py`

**Interfaces:**
- Consumes: `SessionDep`, `CurrentUserDep`, `Area` model
- Produces: `SensorData` model, sensor ingestion + simulated data via background task

- [ ] **Step 1: Write `models/sensor_data.py`**

```python
from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Field

from openforest.api.models.base import Base


class SensorData(Base, table=True):
    __tablename__ = "sensor_data"

    sensor_type: str = Field(max_length=50)  # temperature, humidity, air_quality, rain, luminosity
    value: float
    unit: str = Field(max_length=20)
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    area_id: UUID = Field(foreign_key="areas.id")
```

- [ ] **Step 2: Write `schemas/sensor_data.py`**

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SensorDataCreate(BaseModel):
    sensor_type: str
    value: float
    unit: str
    area_id: UUID


class SensorDataRead(BaseModel):
    id: UUID
    sensor_type: str
    value: float
    unit: str
    recorded_at: datetime
    area_id: UUID
```

- [ ] **Step 3: Write `services/sensor_service.py`**

```python
import asyncio
import random
from collections.abc import Sequence
from datetime import datetime, timezone
from uuid import UUID

from sqlmodel import Session, select

from openforest.api.models.sensor_data import SensorData


def record_sensor_data(session: Session, data: dict) -> SensorData:
    record = SensorData(**data)
    session.add(record)
    session.commit()
    session.refresh(record)
    return record


def get_latest_by_area(session: Session, area_id: UUID) -> Sequence[SensorData]:
    return session.exec(
        select(SensorData)
        .where(SensorData.area_id == area_id)
        .order_by(SensorData.recorded_at.desc())
        .limit(100)
    ).all()


SENSOR_TYPES = {
    "temperature": {"min": 15, "max": 40, "unit": "°C"},
    "humidity": {"min": 30, "max": 100, "unit": "%"},
    "air_quality": {"min": 0, "max": 500, "unit": "AQI"},
    "rain": {"min": 0, "max": 50, "unit": "mm"},
    "luminosity": {"min": 0, "max": 100000, "unit": "lux"},
}


def generate_simulated_reading(sensor_type: str) -> dict:
    config = SENSOR_TYPES[sensor_type]
    return {
        "sensor_type": sensor_type,
        "value": round(random.uniform(config["min"], config["max"]), 2),
        "unit": config["unit"],
    }
```

- [ ] **Step 4: Write `routers/sensors.py`**

```python
from collections.abc import Sequence
from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.database import SessionDep
from openforest.api.schemas.sensor_data import SensorDataCreate, SensorDataRead
from openforest.api.services import area_service, sensor_service

router = APIRouter(prefix="/v1/sensors", tags=["sensores"])


@router.post("/ingest")
def ingest(
    session: SessionDep,
    current_user: CurrentUserDep,
    body: SensorDataCreate,
) -> SensorDataRead:
    area = area_service.get_area(session, body.area_id)
    if not area:
        raise HTTPException(status_code=404, detail=[{"msg": "Área não encontrada", "type": "not_found"}])
    record = sensor_service.record_sensor_data(session, body.model_dump())
    return SensorDataRead(**record.model_dump())


@router.get("/areas/{area_id}")
def read_area_sensors(
    session: SessionDep,
    current_user: CurrentUserDep,
    area_id: UUID,
) -> Sequence[SensorDataRead]:
    area = area_service.get_area(session, area_id)
    if not area:
        raise HTTPException(status_code=404, detail=[{"msg": "Área não encontrada", "type": "not_found"}])
    data = sensor_service.get_latest_by_area(session, area_id)
    return [SensorDataRead(**d.model_dump()) for d in data]
```

- [ ] **Step 5: Add sensor simulation background task in `main.py`**

```python
import asyncio
import random
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI

from openforest.api.config import settings
from openforest.api.infrastructure.database import engine
from openforest.api.services.sensor_service import SENSOR_TYPES, generate_simulated_reading, record_sensor_data
from sqlmodel import Session, select

from openforest.api.models.area import Area


async def simulate_sensors() -> None:
    while True:
        try:
            with Session(engine) as session:
                areas = session.exec(select(Area)).all()
                for area in areas:
                    sensor_type = random.choice(list(SENSOR_TYPES.keys()))
                    reading = generate_simulated_reading(sensor_type)
                    record_sensor_data(session, {**reading, "area_id": area.id})
            await asyncio.sleep(30)  # every 30 seconds
        except Exception:
            await asyncio.sleep(30)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    task = asyncio.create_task(simulate_sensors())
    yield
    task.cancel()


app = FastAPI(title="OpenForest API", version="0.1.0", lifespan=lifespan)
```

- [ ] **Step 6: Wire in `main.py`**

```python
from openforest.api.routers import areas, auth, field_collections, projects, sensors

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(areas.router)
app.include_router(field_collections.router)
app.include_router(sensors.router)
```

- [ ] **Step 7: Write `tests/test_sensors.py`**

```python
from fastapi.testclient import TestClient


def test_ingest_sensor_data(client: TestClient, auth_headers: dict[str, str]) -> None:
    proj = client.post("/v1/projects", json={"name": "P"}, headers=auth_headers).json()
    area = client.post(
        f"/v1/projects/{proj['id']}/areas",
        json={"name": "A"},
        headers=auth_headers,
    ).json()
    response = client.post(
        "/v1/sensors/ingest",
        json={
            "sensor_type": "temperature",
            "value": 25.5,
            "unit": "°C",
            "area_id": area["id"],
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["sensor_type"] == "temperature"
    assert data["value"] == 25.5


def test_get_area_sensors(client: TestClient, auth_headers: dict[str, str]) -> None:
    proj = client.post("/v1/projects", json={"name": "P"}, headers=auth_headers).json()
    area = client.post(
        f"/v1/projects/{proj['id']}/areas",
        json={"name": "A"},
        headers=auth_headers,
    ).json()
    client.post(
        "/v1/sensors/ingest",
        json={"sensor_type": "temp", "value": 1.0, "unit": "°C", "area_id": area["id"]},
        headers=auth_headers,
    )
    client.post(
        "/v1/sensors/ingest",
        json={"sensor_type": "hum", "value": 50.0, "unit": "%", "area_id": area["id"]},
        headers=auth_headers,
    )
    response = client.get(f"/v1/sensors/areas/{area['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert len(response.json()) == 2
```

- [ ] **Step 8: Run tests**

Run: `pytest tests/test_sensors.py -v`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add sensor data ingestion, query, and background simulation"
```

---

### Task 8: Real-time Dashboard with SSE

**Files:**
- Create: `src/openforest/api/infrastructure/redis.py`
- Create: `src/openforest/api/services/dashboard_service.py`
- Create: `src/openforest/api/routers/dashboard.py`
- Modify: `src/openforest/api/main.py` (include dashboard router, wire Redis into sensor pipeline)
- Modify: `src/openforest/api/routers/sensors.py` (publish to Redis on ingest)
- Create: `tests/test_dashboard.py`

**Interfaces:**
- Consumes: `SessionDep`, `CurrentUserDep`, `sensor_service`, `redis` client
- Produces: SSE endpoint at `/v1/dashboard/areas/{area_id}/stream`

- [ ] **Step 1: Write `infrastructure/redis.py`**

```python
import json
from datetime import datetime

import redis as redis_lib

from openforest.api.config import settings

redis_client = redis_lib.from_url(str(settings.redis_url))


def publish_sensor_reading(area_id: str, data: dict) -> None:
    channel = f"sensor:{area_id}"
    data["timestamp"] = datetime.utcnow().isoformat()
    redis_client.publish(channel, json.dumps(data, default=str))
```

- [ ] **Step 2: Write `services/dashboard_service.py`**

```python
import asyncio
import json

from openforest.api.infrastructure.redis import redis_client


async def stream_sensor_data(area_id: str) -> "AsyncIterable[dict]":
    pubsub = redis_client.pubsub()
    channel = f"sensor:{area_id}"
    pubsub.subscribe(channel)
    try:
        while True:
            message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
            if message:
                yield json.loads(message["data"])
            await asyncio.sleep(0.1)
    finally:
        pubsub.unsubscribe(channel)
        pubsub.close()
```

- [ ] **Step 3: Write `routers/dashboard.py`**

```python
from collections.abc import AsyncIterable
from uuid import UUID

from fastapi import APIRouter
from fastapi.sse import EventSourceResponse, ServerSentEvent

from openforest.api.dependencies.auth import CurrentUserDep
from openforest.api.dependencies.database import SessionDep
from openforest.api.services import area_service, dashboard_service

router = APIRouter(prefix="/v1/dashboard", tags=["dashboard"])


@router.get("/areas/{area_id}/stream")
async def stream(
    session: SessionDep,
    current_user: CurrentUserDep,
    area_id: UUID,
) -> EventSourceResponse:
    area = area_service.get_area(session, area_id)
    if not area:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=[{"msg": "Área não encontrada", "type": "not_found"}])

    async def event_generator() -> AsyncIterable[ServerSentEvent]:
        async for data in dashboard_service.stream_sensor_data(str(area_id)):
            yield ServerSentEvent(data=data, event="sensor_reading")

    return EventSourceResponse(event_generator())
```

- [ ] **Step 4: Modify `routers/sensors.py` to publish to Redis on ingest**

In the `ingest` endpoint, after recording:

```python
from openforest.api.infrastructure.redis import publish_sensor_reading

publish_sensor_reading(str(body.area_id), {
    "sensor_type": body.sensor_type,
    "value": body.value,
    "unit": body.unit,
    "area_id": str(body.area_id),
})
```

- [ ] **Step 5: Wire in `main.py`**

```python
from openforest.api.routers import areas, auth, dashboard, field_collections, projects, sensors

app.include_router(auth.router)
app.include_router(projects.router)
app.include_router(areas.router)
app.include_router(field_collections.router)
app.include_router(sensors.router)
app.include_router(dashboard.router)
```

- [ ] **Step 6: Write `tests/test_dashboard.py`**

Testing SSE directly with TestClient:

```python
import json

from fastapi.testclient import TestClient


def test_dashboard_stream_returns_events(
    client: TestClient, auth_headers: dict[str, str]
) -> None:
    proj = client.post("/v1/projects", json={"name": "P"}, headers=auth_headers).json()
    area = client.post(
        f"/v1/projects/{proj['id']}/areas",
        json={"name": "A"},
        headers=auth_headers,
    ).json()

    response = client.get(
        f"/v1/dashboard/areas/{area['id']}/stream",
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/event-stream; charset=utf-8"


def test_dashboard_stream_unauthorized(client: TestClient) -> None:
    response = client.get(
        "/v1/dashboard/areas/00000000-0000-0000-0000-000000000000/stream",
    )
    assert response.status_code == 401
```

- [ ] **Step 7: Run tests**

Run: `pytest tests/test_dashboard.py -v`
Expected: All tests pass

- [ ] **Step 8: Run full test suite**

Run: `pytest -x`
Expected: All tests pass

- [ ] **Step 9: Commit**

```bash
git add -A && git commit -m "feat: add real-time dashboard with SSE streaming via Redis pub/sub"
```

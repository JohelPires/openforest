# Sprint 2 — Autenticação e Usuários Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement JWT authentication (register, login, refresh, logout), protect all existing endpoints, and add role-based authorization.

**Architecture:** Auth service handles password hashing (bcrypt) and JWT creation/validation. Redis stores blacklisted refresh tokens. A `dependencies/auth.py` module provides `CurrentUserDep` for endpoint protection. Role-based authorization checks `UserOrganizationRole` via a `RoleChecker` factory.

**Tech Stack:** FastAPI, passlib[bcrypt], PyJWT, Redis, SQLModel, pytest

## Global Constraints

- `passlib[bcrypt]>=1.7.4`, `pyjwt>=2.8.0`, `python-multipart` added to pyproject.toml dependencies
- All existing models, schemas, services, routers follow current conventions (Annotated, sync def by default, SQLModel)
- All existing endpoints (projects, areas, organizations, monitoring) protected with `current_user: CurrentUserDep`
- `/health` endpoint remains public
- User model unchanged (name, email, password_hash — no is_active)
- Tests use PostgreSQL real (same pattern as existing tests)

---

## File Structure

### Files to Create
- `backend/src/openforest/api/schemas/auth.py` — UserCreate, UserRead, Token, LoginRequest, RefreshRequest
- `backend/src/openforest/api/services/auth_service.py` — hash_password, verify_password, create_access_token, create_refresh_token, decode_token
- `backend/src/openforest/api/routers/auth.py` — register, login, refresh, logout endpoints
- `backend/src/openforest/api/dependencies/__init__.py` — package init
- `backend/src/openforest/api/dependencies/auth.py` — get_current_user, CurrentUserDep
- `backend/src/openforest/api/infrastructure/redis.py` — get_redis, blacklist_token, is_token_blacklisted
- `backend/tests/test_auth.py` — auth test suite

### Files to Modify
- `backend/pyproject.toml` — add dependencies
- `backend/src/openforest/api/config.py` — add `algorithm: str = "HS256"`
- `backend/src/openforest/api/main.py` — add auth router include
- `backend/src/openforest/api/routers/projects.py` — add current_user dependency
- `backend/src/openforest/api/routers/areas.py` — add current_user dependency
- `backend/src/openforest/api/routers/organizations.py` — add current_user dependency
- `backend/src/openforest/api/routers/monitoring.py` — add current_user dependency
- `backend/tests/conftest.py` — add session fixture for auth tests
- `backend/tests/test_projects.py` — add auth headers
- `backend/tests/test_areas.py` — add auth headers
- `backend/tests/test_organizations.py` — add auth headers
- `backend/tests/test_monitoring.py` — add auth headers

---

### Task 1: Dependencies and Config

**Files:**
- Modify: `backend/pyproject.toml`
- Modify: `backend/src/openforest/api/config.py`

**Interfaces:**
- Consumes: nothing
- Produces: `settings.algorithm` (string), three new pip dependencies

- [ ] **Step 1: Add dependencies to pyproject.toml**

Edit `backend/pyproject.toml` — add to `dependencies`:

```
"passlib[bcrypt]>=1.7.4",
"pyjwt>=2.8.0",
"python-multipart",
```

- [ ] **Step 2: Add algorithm to Settings**

Edit `backend/src/openforest/api/config.py` — add `algorithm` field after `refresh_token_expire_days`:

```python
algorithm: str = "HS256"
```

- [ ] **Step 3: Install dependencies**

```bash
cd backend && uv sync
```

- [ ] **Step 4: Commit**

```bash
git add backend/pyproject.toml backend/src/openforest/api/config.py backend/uv.lock
git commit -m "feat: add auth dependencies and config"
```

---

### Task 2: Redis Infrastructure

**Files:**
- Create: `backend/src/openforest/api/infrastructure/redis.py`

**Interfaces:**
- Consumes: `settings.redis_url`
- Produces: `get_redis() -> Redis`, `blacklist_token(jti: str, expires_in: int)`, `is_token_blacklisted(jti: str) -> bool`

- [ ] **Step 1: Create `infrastructure/redis.py`**

```python
from redis import Redis

from openforest.api.config import settings

_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url)
    return _redis


def blacklist_token(jti: str, expires_in: int) -> None:
    r = get_redis()
    r.setex(f"token_blacklist:{jti}", expires_in, "blacklisted")


def is_token_blacklisted(jti: str) -> bool:
    r = get_redis()
    return bool(r.exists(f"token_blacklist:{jti}"))
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/openforest/api/infrastructure/redis.py
git commit -m "feat: add redis token blacklist infrastructure"
```

---

### Task 3: Auth Schemas

**Files:**
- Create: `backend/src/openforest/api/schemas/auth.py`

**Interfaces:**
- Consumes: nothing
- Produces: `UserCreate`, `UserRead`, `Token`, `LoginRequest`, `RefreshRequest` Pydantic models

- [ ] **Step 1: Create `schemas/auth.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/openforest/api/schemas/auth.py
git commit -m "feat: add auth schemas"
```

---

### Task 4: Auth Service

**Files:**
- Create: `backend/src/openforest/api/services/auth_service.py`

**Interfaces:**
- Consumes: `settings.secret_key`, `settings.algorithm`, `settings.access_token_expire_minutes`, `settings.refresh_token_expire_days`, `blacklist_token()`, `is_token_blacklisted()`
- Produces: `hash_password(password: str) -> str`, `verify_password(plain: str, hashed: str) -> bool`, `create_access_token(user_id: str) -> str`, `create_refresh_token(user_id: str) -> str`, `decode_token(token: str) -> dict`

- [ ] **Step 1: Create `services/auth_service.py`**

```python
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import jwt
from passlib.context import CryptContext

from openforest.api.config import settings
from openforest.api.infrastructure.redis import blacklist_token, is_token_blacklisted

_pwd_context = CryptContext(schemes=["bcrypt"])


def hash_password(password: str) -> str:
    return _pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


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


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/openforest/api/services/auth_service.py
git commit -m "feat: add auth service with JWT and password hashing"
```

---

### Task 5: Auth Dependencies

**Files:**
- Create: `backend/src/openforest/api/dependencies/__init__.py`
- Create: `backend/src/openforest/api/dependencies/auth.py`

**Interfaces:**
- Consumes: `decode_token`, `get_redis`, `User` model, `SessionDep`, `settings`
- Produces: `get_current_user(session, token) -> User`, `CurrentUserDep = Annotated[User, Depends(get_current_user)]`

- [ ] **Step 1: Create `dependencies/__init__.py`**

Empty file.

- [ ] **Step 2: Create `dependencies/auth.py`**

```python
from collections.abc import Generator
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import ExpiredSignatureError, InvalidTokenError
from sqlmodel import Session

from openforest.api.infrastructure.database import get_session
from openforest.api.models.user import User
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
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/openforest/api/dependencies/
git commit -m "feat: add auth dependencies (get_current_user, CurrentUserDep)"
```

---

### Task 6: Auth Router

**Files:**
- Create: `backend/src/openforest/api/routers/auth.py`

**Interfaces:**
- Consumes: `UserCreate`, `UserRead`, `Token`, `LoginRequest`, `RefreshRequest`, `hash_password`, `verify_password`, `create_access_token`, `create_refresh_token`, `decode_token`, `blacklist_token`, `is_token_blacklisted`, `SessionDep`

- [ ] **Step 1: Create `routers/auth.py`**

```python
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
    UserRead,
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/openforest/api/routers/auth.py
git commit -m "feat: add auth router (register, login, refresh, logout)"
```

---

### Task 7: Register Auth Router in main.py

**Files:**
- Modify: `backend/src/openforest/api/main.py`

**Interfaces:**
- Consumes: `routers/auth.py` router
- Produces: registered `/api/v1/auth/*` endpoints

- [ ] **Step 1: Add auth router import and include**

Edit `backend/src/openforest/api/main.py` — add import and include:

```python
from openforest.api.routers import areas, auth, monitoring, organizations, projects
```

Add after the other includes:
```python
app.include_router(auth.router, prefix="/api/v1")
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/openforest/api/main.py
git commit -m "feat: register auth router in main app"
```

---

### Task 8: Protect Existing Endpoints

**Files:**
- Modify: `backend/src/openforest/api/routers/projects.py`
- Modify: `backend/src/openforest/api/routers/areas.py`
- Modify: `backend/src/openforest/api/routers/organizations.py`
- Modify: `backend/src/openforest/api/routers/monitoring.py`

**Interfaces:**
- Consumes: `CurrentUserDep` from `dependencies/auth.py`

- [ ] **Step 1: Add auth import to all routers**

In each router file, add:
```python
from openforest.api.dependencies.auth import CurrentUserDep
```

- [ ] **Step 2: Add `current_user: CurrentUserDep` to every endpoint**

For `routers/projects.py`:

```python
@router.post("/")
def create_project_route(session: SessionDep, current_user: CurrentUserDep, data: ProjectCreate) -> Project:
    ...

@router.get("/")
def list_projects_route(session: SessionDep, current_user: CurrentUserDep) -> list[Project]:
    ...

@router.get("/{project_id}")
def get_project_route(session: SessionDep, current_user: CurrentUserDep, project_id: UUID) -> Project | None:
    ...

@router.patch("/{project_id}")
def update_project_route(session: SessionDep, current_user: CurrentUserDep, project_id: UUID, data: ProjectUpdate) -> Project | None:
    ...

@router.delete("/{project_id}")
def delete_project_route(session: SessionDep, current_user: CurrentUserDep, project_id: UUID) -> dict[str, str]:
    ...
```

Same pattern for `routers/areas.py`, `routers/organizations.py`, `routers/monitoring.py`.

- [ ] **Step 3: Commit**

```bash
git add backend/src/openforest/api/routers/
git commit -m "feat: protect all existing endpoints with authentication"
```

---

### Task 9: Role-Based Authorization

**Files:**
- Create: no new files
- Modify: `backend/src/openforest/api/dependencies/auth.py` — add `RoleChecker` and `require_role`

**Interfaces:**
- Consumes: `UserOrganizationRole`, `UserOrganization`, `CurrentUserDep`
- Produces: `RoleChecker(role: UserOrganizationRole)` - dependency factory

**Note on scope:** For MVP, the RoleChecker is used where organization context is available:
- Organization routes: compare `organization_id` path param
- Project routes: look up project's `organization_id` from DB
- Area routes: look up area's project → organization_id
- Monitoring routes: look up monitoring's area → project → organization_id

Only endpoints that WRITE (POST, PATCH, DELETE) require `admin` or `manager` role. Read endpoints remain open to all authenticated users.

- [ ] **Step 1: Add `require_role` to `dependencies/auth.py`**

Add to `backend/src/openforest/api/dependencies/auth.py`:

```python
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole


def require_role(*roles: UserOrganizationRole, organization_id: UUID) -> None:
    def checker(
        session: Annotated[Session, Depends(get_session)],
        current_user: CurrentUserDep,
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
    return checker
```

- [ ] **Step 2: Apply role checks to write endpoints**

For write endpoints (POST, PATCH, DELETE), call `require_role` as a dependency. Example for organizations router:

```python
@router.delete("/{organization_id}")
def delete_organization_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    _: None = Depends(require_role(UserOrganizationRole.admin, organization_id=organization_id)),
) -> dict[str, str]:
    ...
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/openforest/api/dependencies/auth.py
git commit -m "feat: add role-based authorization via UserOrganizationRole"
```

---

### Task 10: Auth Tests

**Files:**
- Create: `backend/tests/test_auth.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Add session fixture to conftest.py**

Edit `backend/tests/conftest.py` to add the session and auth_headers fixtures that all tests will need:

```python
from collections.abc import Generator
from urllib.parse import urlparse, urlunparse

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from openforest.api.config import settings

parsed = urlparse(settings.database_url)
test_db_url = urlunparse(parsed._replace(path="/openforest_test"))
test_engine = create_engine(test_db_url)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    SQLModel.metadata.create_all(test_engine)
    yield
    SQLModel.metadata.drop_all(test_engine)


@pytest.fixture
def session():
    connection = test_engine.connect()
    transaction = connection.begin()

    sql_session = Session(bind=connection)

    sql_session.begin_nested()

    def patched_commit():
        sql_session.flush()
        sql_session.begin_nested()

    sql_session.commit = patched_commit

    yield sql_session

    sql_session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def client(session):
    from openforest.api.infrastructure.database import get_session
    from openforest.api.main import app

    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Test User", "email": "test@test.com", "password": "secret123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 2: Create `tests/test_auth.py`**

```python
from fastapi.testclient import TestClient


def test_register_user(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Novo User", "email": "novo@test.com", "password": "123456"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_register_duplicate_email(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Outro", "email": "test@test.com", "password": "123456"},
    )
    assert response.status_code == 409
    data = response.json()
    assert any("já cadastrado" in item["msg"] for item in data["detail"])


def test_login_success(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"name": "Login User", "email": "login@test.com", "password": "123456"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "login@test.com", "password": "123456"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"name": "Wrong PW", "email": "wrongpw@test.com", "password": "123456"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpw@test.com", "password": "wrong"},
    )
    assert response.status_code == 401


def test_login_email_not_found(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "naoexiste@test.com", "password": "123456"},
    )
    assert response.status_code == 401


def test_refresh_token_success(client: TestClient) -> None:
    reg = client.post(
        "/api/v1/auth/register",
        json={"name": "Refresh User", "email": "refresh@test.com", "password": "123456"},
    )
    refresh_token = reg.json()["refresh_token"]

    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


def test_refresh_token_invalid(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid-token"},
    )
    assert response.status_code == 401


def test_logout(client: TestClient) -> None:
    reg = client.post(
        "/api/v1/auth/register",
        json={"name": "Logout User", "email": "logout@test.com", "password": "123456"},
    )
    refresh_token = reg.json()["refresh_token"]

    response = client.post(
        "/api/v1/auth/logout",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200

    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_response.status_code == 401


def test_protected_endpoint_no_auth(client: TestClient) -> None:
    response = client.get("/api/v1/projects")
    assert response.status_code == 401


def test_protected_endpoint_invalid_token(client: TestClient) -> None:
    response = client.get(
        "/api/v1/projects",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


def test_protected_endpoint_valid_token(client: TestClient, auth_headers: dict) -> None:
    response = client.get("/api/v1/projects", headers=auth_headers)
    assert response.status_code == 200


def test_health_public(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200
```

- [ ] **Step 3: Run auth tests**

```bash
pytest tests/test_auth.py -v
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add backend/tests/test_auth.py backend/tests/conftest.py
git commit -m "feat: add auth tests and shared fixtures"
```

---

### Task 11: Update Existing Tests

**Files:**
- Modify: `backend/tests/test_projects.py`
- Modify: `backend/tests/test_areas.py`
- Modify: `backend/tests/test_organizations.py`
- Modify: `backend/tests/test_monitoring.py`

**Note:** These files currently duplicate the session/client fixture pattern from conftest.py. After Task 10, `conftest.py` provides shared fixtures. However, the existing test files define their OWN session/client fixtures that override conftest. We need to update them to use conftest's fixtures OR keep their own but add auth_headers.

**Strategy:** Keep existing per-file fixtures (they have custom `organization`, `project`, etc. fixtures), just add `auth_headers` parameter to test functions.

- [ ] **Step 1: Add auth_headers fixture to each test file**

Add at the top of each test file:
```python
import pytest


@pytest.fixture
def auth_headers(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Test User", "email": "test@test.com", "password": "secret123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
```

- [ ] **Step 2: Add `auth_headers` parameter to every test function**

Each test function signature gets `auth_headers` added. Example:

```python
def test_create_project(client: TestClient, organization: Organization, auth_headers: dict) -> None:
    response = client.post(
        "/api/v1/projects",
        json={"name": "Reflorestamento Mata Atlântica", "organization_id": str(organization.id)},
        headers=auth_headers,
    )
```

All client calls need `headers=auth_headers` added.

- [ ] **Step 3: Run all tests**

```bash
pytest -v
```

Expected: all tests pass (existing + auth tests).

- [ ] **Step 4: Commit**

```bash
git add backend/tests/
git commit -m "test: update existing tests with auth headers"
```

---

### Task 12: Run Lint and Type Check

**Files:** all modified files

- [ ] **Step 1: Run ruff check**

```bash
ruff check backend/src/ backend/tests/
```

Fix any issues.

- [ ] **Step 2: Run mypy**

```bash
mypy backend/src/
```

Fix any type issues.

- [ ] **Step 3: Final commit if needed**

```bash
git add -A
git commit -m "chore: fix lint and type issues"
```

# Multi-tenant Scoping & Roles — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make OpenForest truly multi-tenant: every user sees only their organization's data, with capabilities determined by their role in the org (manager/researcher/volunteer/viewer), plus a global `is_superuser` that bypasses all org checks.

**Architecture:** Server-side auto-scoping via a `CurrentOrgDep` dependency that resolves the user's single org from `UserOrganization`; every service query filters by that org id (None only for superuser = global). Capability is enforced by `require_org_role`/`require_area_role` dependency factories. `created_by` is audit-only. Single-org-per-user is enforced with a unique index on `user_organization.user_id` and a 409 on org creation/member-add conflicts.

**Tech Stack:** FastAPI, SQLModel, Alembic, pytest (real PostgreSQL test DB `/openforest_test`), Ruff, mypy.

## Global Constraints

- All code follows `AGENTS.md` conventions: `Annotated` deps, `def` (sync) endpoints, `Sequence[T]`/`list[T]` return types, `| None` instead of `Optional[T]`.
- Error responses use the list format: `detail=[{"msg": "...", "type": "..."}]`.
- Portuguese error messages (e.g. `"Permissão insuficiente"`, `"Usuário não vinculado a nenhuma organização"`).
- Do **not** run `alembic upgrade head` on your dev DB mid-task; the migrations land in Tasks 1 and 7 — verify them with autogenerate output and manual review, not by executing.
- Tests use the real Postgres test DB: fixture boilerplate (module-level `test_engine`, `create_tables`, `session`, `client`) is duplicated per test file — copy it verbatim from the file being edited (do not create a shared conftest).
- Run from `backend/`: `pytest`, `ruff check src/`, `mypy src/`.
- Spec: `docs/superpowers/specs/2026-08-06-multitenant-scoping-design.md`.

---

## File Structure

**New files:**
- `src/openforest/api/services/organization_membership_service.py` — member CRUD logic
- `tests/test_dependencies.py` — dependency unit tests (Task 2)
- `tests/test_superuser.py` — superuser end-to-end (Task 8)
- `src/openforest/api/infrastructure/versions/<rev>_add_multitenant_fields.py` (Task 1)
- `src/openforest/api/infrastructure/versions/<rev>_multitenant_roles_and_single_org.py` (Task 7)

**Modified files:**
- `src/openforest/api/models/user.py`, `organization.py`, `project.py`, `user_organization.py`
- `src/openforest/api/dependencies/auth.py`, `permissions.py`
- `src/openforest/api/schemas/project.py`, `organization.py`
- `src/openforest/api/services/project_service.py`, `organization_service.py`, `area_service.py`, `monitoring_service.py`, `photo_service.py`
- `src/openforest/api/routers/projects.py`, `organizations.py`, `areas.py`, `monitoring.py`, `photos.py`
- `tests/test_auth.py`, `test_projects.py`, `test_areas.py`, `test_monitoring.py`, `test_photos.py`, `test_organizations.py`

---

### Task 1: Model fields (is_superuser, created_by) + migration

**Files:**
- Modify: `src/openforest/api/models/user.py`, `src/openforest/api/models/organization.py`, `src/openforest/api/models/project.py`
- Create: `src/openforest/api/infrastructure/versions/<autogen>_add_multitenant_fields.py`
- Test: `tests/test_auth.py`

**Interfaces:**
- Produces: `User.is_superuser: bool` (default False), `Organization.created_by: UUID | None`, `Project.created_by: UUID | None`. The `UserOrganizationRole` enum is **unchanged in this task** (admin still exists).

- [ ] **Step 1: Add the model fields**

`src/openforest/api/models/user.py`:

```python
from sqlmodel import Field

from openforest.api.models.base import Base


class User(Base, table=True):
    __tablename__ = "user"

    name: str = Field(nullable=False)
    email: str = Field(nullable=False, unique=True, index=True)
    password_hash: str = Field(nullable=False)
    is_superuser: bool = Field(default=False)
```

`src/openforest/api/models/organization.py`:

```python
from uuid import UUID

from sqlmodel import Field

from openforest.api.models.base import Base


class Organization(Base, table=True):
    __tablename__ = "organization"

    name: str = Field(nullable=False)
    slug: str = Field(nullable=False, unique=True, index=True)
    description: str | None = Field(default=None)
    created_by: UUID | None = Field(default=None, foreign_key="user.id")
```

`src/openforest/api/models/project.py` — add after `responsible`:

```python
    created_by: UUID | None = Field(default=None, foreign_key="user.id")
```

- [ ] **Step 2: Write the failing test**

Add to `tests/test_auth.py` (after `test_register_user`):

```python
def test_register_user_not_superuser(client: TestClient, session: Session) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"name": "Comum", "email": "comum@test.com", "password": "123456"},
    )
    user = session.exec(select(User).where(User.email == "comum@test.com")).first()
    assert user is not None
    assert user.is_superuser is False
```

Add the import at the top of `tests/test_auth.py`:

```python
from sqlmodel import Session, select
from openforest.api.models.user import User
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pytest tests/test_auth.py::test_register_user_not_superuser -v`
Expected: FAIL — `AttributeError: 'User' object has no attribute 'is_superuser'` (models not yet updated).

- [ ] **Step 4: Apply the model changes** (the three edits from Step 1) and run again.

- [ ] **Step 5: Verify it passes**

Run: `pytest tests/test_auth.py -v` — all pass.

- [ ] **Step 6: Generate the migration**

Run: `alembic revision --autogenerate -m "add multitenant fields"`
Expected: a new file under `src/openforest/api/infrastructure/versions/` whose `down_revision` is `e6748f45857d`, containing `op.add_column` for `user.is_superuser`, `organization.created_by`, `project.created_by`. Record the generated revision id (e.g. `abc123…`) — Task 7 will reference it. If autogenerate also emits unrelated changes, hand-edit the file to keep only the three `add_column` ops and matching `drop_column` in `downgrade`.

- [ ] **Step 7: Run the full suite + lint + mypy**

Run: `pytest && ruff check src/ && mypy src/`
Expected: all pass (nothing else changed yet).

- [ ] **Step 8: Commit**

```bash
git add src/openforest/api/models/ src/openforest/api/infrastructure/versions/ tests/test_auth.py
git commit -m "feat: is_superuser and created_by fields"
```

---

### Task 2: Scoping dependencies (CurrentOrgDep, require_org_role, require_superuser, require_org_access, require_area_role)

**Files:**
- Modify: `src/openforest/api/dependencies/auth.py`
- Modify: `src/openforest/api/dependencies/permissions.py`
- Create: `tests/test_dependencies.py`

**Interfaces:**
- Produces (used by every later task):
  - `CurrentOrgDep = Annotated[UserOrganization | None, Depends(get_current_org)]` — `None` only for superuser; raises 403 for a user with no org.
  - `require_org_role(*roles: UserOrganizationRole) -> Any` — dependency factory; superuser passes.
  - `require_org_access(organization_id: UUID, *roles: UserOrganizationRole) -> Any` — for org routes where the target org id is a path param; returns 404 if the org is not the caller's own (or superuser).
  - `require_superuser(current_user: CurrentUserDep) -> None`.
  - `resolve_area_organization_id(session: Session, area_id: UUID) -> UUID | None`.
  - `check_area_role(session, user, current_org, area_id, *roles) -> None` — non-factory helper (used where area_id is known only after a DB lookup).
  - `require_area_role(area_id: UUID, *roles: UserOrganizationRole) -> Any` — dependency factory wrapping `check_area_role`.
- Consumes: `CurrentUserDep` (exists), `SessionDep` (exists).

- [ ] **Step 1: Write the failing tests**

Create `tests/test_dependencies.py`:

```python
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from openforest.api.config import settings
from openforest.api.dependencies.auth import (
    CurrentOrgDep,
    require_org_role,
    require_superuser,
)
from openforest.api.infrastructure.database import get_session
from openforest.api.models.organization import Organization
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
from openforest.api.services.auth_service import create_access_token, hash_password

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

    session = Session(bind=connection)

    session.begin_nested()

    def patched_commit():
        session.flush()
        session.begin_nested()

    session.commit = patched_commit

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture
def organization(session):
    org = Organization(name="ONG Teste", slug="ong-teste")
    session.add(org)
    session.commit()
    return org


@pytest.fixture
def user(session):
    u = User(name="Test User", email="test@test.com", password_hash=hash_password("secret123"))
    session.add(u)
    session.commit()
    return u


def _add_membership(session, user, organization, role):
    membership = UserOrganization(
        user_id=user.id, organization_id=organization.id, role=role
    )
    session.add(membership)
    session.commit()
    return membership


test_app = FastAPI()


@test_app.get("/me-org")
def me_org(current_org: CurrentOrgDep) -> dict:
    return {"organization_id": str(current_org.organization_id) if current_org else None}


@test_app.get("/check")
def check(_: None = require_org_role(UserOrganizationRole.manager)) -> dict:
    return {"ok": True}


@test_app.get("/super")
def super_route(_: None = require_superuser) -> dict:
    return {"ok": True}


def _headers(session, user):
    test_app.dependency_overrides[get_session] = lambda: session
    token = create_access_token(str(user.id))
    return test_app, {"Authorization": f"Bearer {token}"}


def test_get_current_org_for_member(session, user, organization):
    _add_membership(session, user, organization, UserOrganizationRole.manager)
    app, headers = _headers(session, user)
    with TestClient(app) as c:
        response = c.get("/me-org", headers=headers)
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"organization_id": str(organization.id)}


def test_get_current_org_for_no_org_user(client_is_ignored, session, user):
    app, headers = _headers(session, user)
    with TestClient(app) as c:
        response = c.get("/me-org", headers=headers)
    app.dependency_overrides.clear()
    assert response.status_code == 403
    assert any("vinculado" in item["msg"] for item in response.json()["detail"])


def test_get_current_org_for_superuser(session):
    admin = User(
        name="Admin", email="admin@test.com",
        password_hash=hash_password("secret123"), is_superuser=True,
    )
    session.add(admin)
    session.commit()
    app, headers = _headers(session, admin)
    with TestClient(app) as c:
        response = c.get("/me-org", headers=headers)
    app.dependency_overrides.clear()
    assert response.status_code == 200
    assert response.json() == {"organization_id": None}


def test_require_org_role_manager_allowed(session, user, organization):
    _add_membership(session, user, organization, UserOrganizationRole.manager)
    app, headers = _headers(session, user)
    with TestClient(app) as c:
        response = c.get("/check", headers=headers)
    app.dependency_overrides.clear()
    assert response.status_code == 200


def test_require_org_role_viewer_forbidden(session, user, organization):
    _add_membership(session, user, organization, UserOrganizationRole.viewer)
    app, headers = _headers(session, user)
    with TestClient(app) as c:
        response = c.get("/check", headers=headers)
    app.dependency_overrides.clear()
    assert response.status_code == 403


def test_require_org_role_superuser_allowed(session):
    admin = User(
        name="Admin", email="admin2@test.com",
        password_hash=hash_password("secret123"), is_superuser=True,
    )
    session.add(admin)
    session.commit()
    app, headers = _headers(session, admin)
    with TestClient(app) as c:
        response = c.get("/check", headers=headers)
    app.dependency_overrides.clear()
    assert response.status_code == 200


def test_require_superuser_forbidden_for_regular(session, user, organization):
    _add_membership(session, user, organization, UserOrganizationRole.manager)
    app, headers = _headers(session, user)
    with TestClient(app) as c:
        response = c.get("/super", headers=headers)
    app.dependency_overrides.clear()
    assert response.status_code == 403


def test_require_superuser_allowed(session):
    admin = User(
        name="Admin", email="admin3@test.com",
        password_hash=hash_password("secret123"), is_superuser=True,
    )
    session.add(admin)
    session.commit()
    app, headers = _headers(session, admin)
    with TestClient(app) as c:
        response = c.get("/super", headers=headers)
    app.dependency_overrides.clear()
    assert response.status_code == 200


def test_no_token_returns_401(session):
    test_app.dependency_overrides[get_session] = lambda: session
    with TestClient(test_app) as c:
        response = c.get("/me-org")
    test_app.dependency_overrides.clear()
    assert response.status_code == 401
```

Note: `client_is_ignored` is not a fixture — it does not exist. Remove it from `test_get_current_org_for_no_org_user`'s signature:

```python
def test_get_current_org_for_no_org_user(session, user):
```

- [ ] **Step 2: Run to verify they fail**

Run: `pytest tests/test_dependencies.py -v`
Expected: FAIL — `ImportError: cannot import name 'CurrentOrgDep'`.

- [ ] **Step 3: Implement `dependencies/auth.py`**

Add to `dependencies/auth.py` (imports already present: `Annotated`, `Any`, `Session`, `Depends`, `HTTPException`, `get_session`, `User`, `UserOrganization`, `UserOrganizationRole`; add `from sqlmodel import select`):

```python
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


def require_org_access(organization_id: UUID, *roles: UserOrganizationRole) -> Any:
    def checker(
        session: Annotated[Session, Depends(get_session)],
        current_user: CurrentUserDep,
        current_org: CurrentOrgDep,
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
```

Keep the existing `require_role` function — `routers/organizations.py` still uses it until Task 7. Do not remove it yet.

- [ ] **Step 4: Implement `dependencies/permissions.py`**

Replace the entire file content:

```python
from typing import Annotated, Any
from uuid import UUID

from fastapi import Depends, HTTPException
from sqlmodel import Session

from openforest.api.dependencies.auth import CurrentOrgDep, CurrentUserDep
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.area import Area
from openforest.api.models.project import Project
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole


def resolve_area_organization_id(session: Session, area_id: UUID) -> UUID | None:
    area = session.get(Area, area_id)
    if not area:
        return None
    project = session.get(Project, area.project_id)
    if not project:
        return None
    return project.organization_id


def check_area_role(
    session: Session,
    user: User,
    current_org: UserOrganization | None,
    area_id: UUID,
    *roles: UserOrganizationRole,
) -> None:
    if user.is_superuser:
        return
    if current_org is None:
        raise HTTPException(
            status_code=403,
            detail=[
                {
                    "msg": "Usuário não vinculado a nenhuma organização",
                    "type": "no_organization",
                }
            ],
        )
    org_id = resolve_area_organization_id(session, area_id)
    if org_id is None:
        return
    if org_id != current_org.organization_id:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    if current_org.role not in roles:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )


def require_area_role(area_id: UUID, *roles: UserOrganizationRole) -> Any:
    def checker(
        session: SessionDep,
        current_user: CurrentUserDep,
        current_org: CurrentOrgDep,
    ) -> None:
        check_area_role(session, current_user, current_org, area_id, *roles)

    return Depends(checker)
```

This removes `check_area_write_permission` (its consumers migrate in Tasks 5–6).

- [ ] **Step 5: Run tests to verify they pass**

Run: `pytest tests/test_dependencies.py -v`
Expected: all pass.

- [ ] **Step 6: Run the full suite + lint + mypy**

Run: `pytest && ruff check src/ && mypy src/`
Expected: all pass (permissions.py now lacks `check_area_write_permission`, which monitoring.py/photos.py still import — see step 7).

- [ ] **Step 7: Handle the dangling import**

`routers/monitoring.py` and `routers/photos.py` still do `from ...permissions import check_area_write_permission`, which now fails. Add a temporary alias at the end of `dependencies/permissions.py` so the suite stays green until Tasks 5–6 migrate those routers:

```python
check_area_write_permission = check_area_role
```

Run: `pytest && ruff check src/ && mypy src/` — all pass.

- [ ] **Step 8: Commit**

```bash
git add src/openforest/api/dependencies/ tests/test_dependencies.py
git commit -m "feat: scoping and role dependencies"
```

---

### Task 3: Projects — scoped reads, role-gated writes

**Files:**
- Modify: `src/openforest/api/schemas/project.py`, `src/openforest/api/services/project_service.py`, `src/openforest/api/routers/projects.py`
- Rewrite: `tests/test_projects.py`
- Modify: `tests/test_auth.py`

**Interfaces:**
- Produces:
  - `ProjectCreate.organization_id: UUID | None` (used only by superuser; removed from ProjectRead? No — ProjectRead keeps `organization_id`).
  - `create_project(session, organization_id: UUID, data: ProjectCreate, created_by: UUID | None) -> Project`
  - `list_projects(session, offset, limit, organization_id: UUID | None = None) -> tuple[list[Project], int]`
  - `get_project(session, project_id, organization_id: UUID | None = None) -> Project | None`
  - `update_project(session, project_id, data) -> Project | None`, `delete_project(session, project_id) -> bool` (unchanged signatures)
- Consumes: `CurrentOrgDep`, `require_org_role` from Task 2.

- [ ] **Step 1: Update the schema**

`src/openforest/api/schemas/project.py` — `ProjectCreate` gains an optional org id (for superuser only); `ProjectRead` keeps its inherited field:

```python
class ProjectCreate(SQLModel):
    organization_id: UUID | None = None
    name: str
    description: str | None = None
    goal: str | None = None
    start_date: date | None = None
    responsible: str | None = None
```

- [ ] **Step 2: Update the service**

`src/openforest/api/services/project_service.py`:

```python
def create_project(
    session: Session,
    organization_id: UUID,
    data: ProjectCreate,
    created_by: UUID | None,
) -> Project:
    organization = session.get(Organization, organization_id)
    if not organization:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Organização com ID '{organization_id}' não encontrada",
                    "type": "not_found",
                }
            ],
        )
    project = Project(
        **data.model_dump(exclude={"organization_id"}),
        organization_id=organization_id,
        created_by=created_by,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    return project


def get_project(
    session: Session, project_id: UUID, organization_id: UUID | None = None
) -> Project | None:
    stmt = select(Project).where(Project.id == project_id)
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return session.exec(stmt).first()


def list_projects(
    session: Session,
    offset: int,
    limit: int,
    organization_id: UUID | None = None,
) -> tuple[list[Project], int]:
    count_stmt = select(func.count()).select_from(Project)
    stmt = select(Project).order_by("created_at", "id")
    if organization_id is not None:
        count_stmt = count_stmt.where(Project.organization_id == organization_id)
        stmt = stmt.where(Project.organization_id == organization_id)
    total = session.exec(count_stmt).one()
    items = session.exec(stmt.offset(offset).limit(limit)).all()
    return list(items), total


def update_project(session: Session, project_id: UUID, data: ProjectUpdate) -> Project | None:
    project = session.get(Project, project_id)
    if not project:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    session.commit()
    session.refresh(project)
    return project


def delete_project(session: Session, project_id: UUID) -> bool:
    project = session.get(Project, project_id)
    if not project:
        return False
    session.delete(project)
    session.commit()
    return True
```

- [ ] **Step 3: Update the router**

`src/openforest/api/routers/projects.py` — full replacement:

```python
from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import (
    CurrentOrgDep,
    CurrentUserDep,
    require_org_role,
)
from openforest.api.dependencies.pagination import PaginationDep
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.project import Project
from openforest.api.models.user_organization import UserOrganizationRole
from openforest.api.schemas.pagination import Paginated
from openforest.api.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from openforest.api.services.project_service import (
    create_project,
    delete_project,
    get_project,
    list_projects,
    update_project,
)

router = APIRouter(prefix="/projects", tags=["projetos"])


@router.post("/", response_model=ProjectRead)
def create_project_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    data: ProjectCreate,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> Project:
    organization_id = current_org.organization_id if current_org else data.organization_id
    if organization_id is None:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": "organization_id é obrigatório para o admin global",
                    "type": "validation_error",
                }
            ],
        )
    return create_project(session, organization_id, data, created_by=current_user.id)


@router.get("/", response_model=Paginated[ProjectRead])
def list_projects_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    pagination: PaginationDep,
) -> Paginated[Project]:
    organization_id = current_org.organization_id if current_org else None
    items, total = list_projects(session, pagination.offset, pagination.limit, organization_id)
    return Paginated(items=items, total=total, offset=pagination.offset, limit=pagination.limit)


@router.get("/{project_id}", response_model=ProjectRead)
def get_project_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
) -> Project | None:
    organization_id = current_org.organization_id if current_org else None
    project = get_project(session, project_id, organization_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    return project


@router.patch("/{project_id}", response_model=ProjectRead)
def update_project_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
    data: ProjectUpdate,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> Project | None:
    organization_id = current_org.organization_id if current_org else None
    project = get_project(session, project_id, organization_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    return update_project(session, project_id, data)


@router.delete("/{project_id}")
def delete_project_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> dict[str, str]:
    organization_id = current_org.organization_id if current_org else None
    project = get_project(session, project_id, organization_id)
    if not project:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Projeto não encontrado", "type": "not_found"}],
        )
    delete_project(session, project_id)
    return {"msg": "Projeto deletado com sucesso"}
```

Remove the old `_check_role_in_org` helper and the `Annotated`/`Query`/`Organization`/`User`/`UserOrganization`/`select` imports (no longer used).

- [ ] **Step 4: Rewrite `tests/test_projects.py`**

Replace the file with the content below. Changes vs. old: `admin_membership` → `manager_membership` (role `manager`); `auth_headers` depends on `manager_membership`; create payloads drop `organization_id`; org-filter tests replaced by scoping tests; role matrix tests added.

```python
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from openforest.api.config import settings
from openforest.api.models.organization import Organization
from openforest.api.models.project import Project
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
from openforest.api.services.auth_service import hash_password

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

    session = Session(bind=connection)

    session.begin_nested()

    def patched_commit():
        session.flush()
        session.begin_nested()

    session.commit = patched_commit

    yield session

    session.close()
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
def organization(session):
    org = Organization(name="ONG Teste", slug="ong-teste")
    session.add(org)
    session.commit()
    return org


@pytest.fixture
def user(session):
    u = User(name="Test User", email="test@test.com", password_hash=hash_password("secret123"))
    session.add(u)
    session.commit()
    return u


@pytest.fixture
def manager_membership(session, user, organization):
    membership = UserOrganization(
        user_id=user.id, organization_id=organization.id, role=UserOrganizationRole.manager
    )
    session.add(membership)
    session.commit()
    return membership


@pytest.fixture
def auth_headers(client, user, manager_membership):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@test.com", "password": "secret123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _login_headers(client, email: str) -> dict:
    response = client.post("/api/v1/auth/login", json={"email": email, "password": "secret123"})
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def _add_membership(session, user_id, organization_id, role) -> None:
    session.add(
        UserOrganization(user_id=user_id, organization_id=organization_id, role=role)
    )
    session.commit()


def test_create_project(
    client: TestClient,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    response = client.post(
        "/api/v1/projects",
        json={"name": "Reflorestamento Mata Atlântica"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Reflorestamento Mata Atlântica"
    assert data["organization_id"] == str(manager_membership.organization_id)
    assert "id" in data


def test_list_projects_empty(client: TestClient, auth_headers: dict) -> None:
    response = client.get("/api/v1/projects", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "offset": 0, "limit": 20}


def test_get_project_not_found(
    client: TestClient, auth_headers: dict
) -> None:
    response = client.get(f"/api/v1/projects/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_create_and_list(
    client: TestClient,
    auth_headers: dict,
) -> None:
    client.post("/api/v1/projects", json={"name": "Projeto A"}, headers=auth_headers)
    client.post("/api/v1/projects", json={"name": "Projeto B"}, headers=auth_headers)
    response = client.get("/api/v1/projects", headers=auth_headers)
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 2


def test_list_projects_pagination(
    client: TestClient,
    auth_headers: dict,
) -> None:
    for name in ["Projeto A", "Projeto B", "Projeto C"]:
        client.post("/api/v1/projects", json={"name": name}, headers=auth_headers)

    page_one = client.get("/api/v1/projects?offset=0&limit=2", headers=auth_headers).json()
    assert len(page_one["items"]) == 2
    assert page_one["total"] == 3

    page_two = client.get("/api/v1/projects?offset=2&limit=2", headers=auth_headers).json()
    assert len(page_two["items"]) == 1
    assert page_two["total"] == 3


def test_list_projects_invalid_pagination(client: TestClient, auth_headers: dict) -> None:
    assert client.get("/api/v1/projects?limit=0", headers=auth_headers).status_code == 422
    assert client.get("/api/v1/projects?limit=101", headers=auth_headers).status_code == 422
    assert client.get("/api/v1/projects?offset=-1", headers=auth_headers).status_code == 422


def test_list_projects_scoped_to_own_org(
    client: TestClient,
    session: Session,
    user: User,
    organization: Organization,
    auth_headers: dict,
) -> None:
    other_org = Organization(name="Outra ONG", slug="outra-ong")
    other_user = User(
        name="Other User", email="other@test.com", password_hash=hash_password("secret123")
    )
    session.add(other_org)
    session.add(other_user)
    session.commit()
    _add_membership(session, other_user.id, other_org.id, UserOrganizationRole.manager)

    client.post("/api/v1/projects", json={"name": "Projeto A"}, headers=auth_headers)

    other_headers = _login_headers(client, "other@test.com")
    client.post("/api/v1/projects", json={"name": "Projeto B"}, headers=other_headers)

    response = client.get("/api/v1/projects", headers=auth_headers)
    data = response.json()
    assert data["total"] == 1
    assert {item["name"] for item in data["items"]} == {"Projeto A"}


def test_user_cannot_read_other_org_project(
    client: TestClient,
    session: Session,
    organization: Organization,
    auth_headers: dict,
) -> None:
    other_org = Organization(name="Outra ONG 2", slug="outra-ong-2")
    other_user = User(
        name="Other User 2", email="other2@test.com", password_hash=hash_password("secret123")
    )
    session.add(other_org)
    session.add(other_user)
    session.commit()
    _add_membership(session, other_user.id, other_org.id, UserOrganizationRole.manager)

    other_headers = _login_headers(client, "other2@test.com")
    create_resp = client.post(
        "/api/v1/projects", json={"name": "Projeto secreto"}, headers=other_headers
    )
    other_project_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/projects/{other_project_id}", headers=auth_headers)
    assert response.status_code == 404


def test_update_project(
    client: TestClient,
    auth_headers: dict,
) -> None:
    create_resp = client.post(
        "/api/v1/projects", json={"name": "Nome Original"}, headers=auth_headers
    )
    project_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/projects/{project_id}", json={"name": "Nome Atualizado"}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Nome Atualizado"


def test_update_project_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.patch(
        f"/api/v1/projects/{uuid4()}", json={"name": "Qualquer"}, headers=auth_headers
    )
    assert response.status_code == 404


def test_delete_project(client: TestClient, auth_headers: dict) -> None:
    create_resp = client.post(
        "/api/v1/projects", json={"name": "Projeto para deletar"}, headers=auth_headers
    )
    project_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_delete_project_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.delete(f"/api/v1/projects/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_researcher_can_create_project(
    client: TestClient,
    session: Session,
    organization: Organization,
    auth_headers: dict,
) -> None:
    researcher = User(
        name="Researcher", email="researcher@test.com", password_hash=hash_password("secret123")
    )
    session.add(researcher)
    session.commit()
    _add_membership(session, researcher.id, organization.id, UserOrganizationRole.researcher)

    headers = _login_headers(client, "researcher@test.com")
    response = client.post(
        "/api/v1/projects", json={"name": "Projeto do pesquisador"}, headers=headers
    )
    assert response.status_code == 200


def test_viewer_cannot_create_project(
    client: TestClient,
    session: Session,
    organization: Organization,
    auth_headers: dict,
) -> None:
    viewer = User(
        name="Viewer", email="viewer@test.com", password_hash=hash_password("secret123")
    )
    session.add(viewer)
    session.commit()
    _add_membership(session, viewer.id, organization.id, UserOrganizationRole.viewer)

    headers = _login_headers(client, "viewer@test.com")
    response = client.post(
        "/api/v1/projects", json={"name": "Projeto do viewer"}, headers=headers
    )
    assert response.status_code == 403


def test_volunteer_cannot_create_project(
    client: TestClient,
    session: Session,
    organization: Organization,
    auth_headers: dict,
) -> None:
    volunteer = User(
        name="Volunteer", email="volunteer@test.com", password_hash=hash_password("secret123")
    )
    session.add(volunteer)
    session.commit()
    _add_membership(session, volunteer.id, organization.id, UserOrganizationRole.volunteer)

    headers = _login_headers(client, "volunteer@test.com")
    response = client.post(
        "/api/v1/projects", json={"name": "Projeto do voluntário"}, headers=headers
    )
    assert response.status_code == 403


def test_create_project_invalid_organization_is_ignored_for_regular_user(
    client: TestClient, auth_headers: dict
) -> None:
    response = client.post(
        "/api/v1/projects",
        json={"name": "Projeto", "organization_id": str(uuid4())},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["organization_id"] != str(uuid4())
```

- [ ] **Step 5: Update `tests/test_auth.py`**

Replace `test_protected_endpoint_valid_token` — a user without an org now gets 403 on reads:

```python
def test_protected_endpoint_user_without_org_forbidden(
    client: TestClient, auth_headers: dict
) -> None:
    response = client.get("/api/v1/projects", headers=auth_headers)
    assert response.status_code == 403
```

- [ ] **Step 6: Run the tests**

Run: `pytest tests/test_projects.py tests/test_auth.py tests/test_dependencies.py -v`
Expected: all pass.

- [ ] **Step 7: Full suite + lint + mypy**

Run: `pytest && ruff check src/ && mypy src/`
Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add src/openforest/api/schemas/project.py src/openforest/api/services/project_service.py src/openforest/api/routers/projects.py tests/test_projects.py tests/test_auth.py
git commit -m "feat: scope projects to organization and gate writes by role"
```

---

### Task 4: Areas — scoped reads, role-gated writes

**Files:**
- Modify: `src/openforest/api/services/area_service.py`, `src/openforest/api/routers/areas.py`
- Rewrite: `tests/test_areas.py`

**Interfaces:**
- Produces:
  - `create_area(session, project_id, data, organization_id: UUID) -> Area`
  - `list_areas(session, project_id, organization_id: UUID | None = None) -> list[Area]`
  - `get_area(session, area_id, organization_id: UUID | None = None) -> Area | None`
  - `update_area(session, area_id, data) -> Area | None`, `delete_area(session, area_id) -> bool` (unchanged)
- Consumes: `require_org_role` from Task 2. Cross-org projects are rejected in the service (403); reads of another org's areas return None (404).

- [ ] **Step 1: Update the service**

`src/openforest/api/services/area_service.py`:

```python
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.area import Area
from openforest.api.models.project import Project
from openforest.api.schemas.area import AreaCreate, AreaUpdate


def create_area(
    session: Session, project_id: UUID, data: AreaCreate, organization_id: UUID
) -> Area:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Projeto com ID '{project_id}' não encontrado",
                    "type": "not_found",
                }
            ],
        )
    if project.organization_id != organization_id:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    area = Area(**data.model_dump(), project_id=project_id)
    session.add(area)
    session.commit()
    session.refresh(area)
    return area


def get_area(
    session: Session, area_id: UUID, organization_id: UUID | None = None
) -> Area | None:
    stmt = (
        select(Area)
        .join(Project, Area.project_id == Project.id)
        .where(Area.id == area_id)
    )
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return session.exec(stmt).first()


def list_areas(
    session: Session, project_id: UUID, organization_id: UUID | None = None
) -> list[Area]:
    stmt = (
        select(Area)
        .join(Project, Area.project_id == Project.id)
        .where(Area.project_id == project_id)
    )
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return list(session.exec(stmt).all())


def update_area(session: Session, area_id: UUID, data: AreaUpdate) -> Area | None:
    area = session.get(Area, area_id)
    if not area:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(area, field, value)
    session.commit()
    session.refresh(area)
    return area


def delete_area(session: Session, area_id: UUID) -> bool:
    area = session.get(Area, area_id)
    if not area:
        return False
    session.delete(area)
    session.commit()
    return True
```

- [ ] **Step 2: Update the router**

`src/openforest/api/routers/areas.py` — full replacement:

```python
from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import CurrentOrgDep, CurrentUserDep, require_org_role
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.area import Area
from openforest.api.models.user_organization import UserOrganizationRole
from openforest.api.schemas.area import AreaCreate, AreaRead, AreaUpdate
from openforest.api.services.area_service import (
    create_area,
    delete_area,
    get_area,
    list_areas,
    update_area,
)

router = APIRouter(tags=["áreas"])


@router.get("/projects/{project_id}/areas", response_model=list[AreaRead])
def list_areas_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
) -> list[Area]:
    organization_id = current_org.organization_id if current_org else None
    return list_areas(session, project_id, organization_id)


@router.post("/projects/{project_id}/areas", response_model=AreaRead)
def create_area_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    project_id: UUID,
    data: AreaCreate,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> Area:
    organization_id = current_org.organization_id if current_org else None
    if organization_id is None:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    return create_area(session, project_id, data, organization_id)


@router.get("/areas/{area_id}", response_model=AreaRead)
def get_area_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
) -> Area | None:
    organization_id = current_org.organization_id if current_org else None
    area = get_area(session, area_id, organization_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    return area


@router.patch("/areas/{area_id}", response_model=AreaRead)
def update_area_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
    data: AreaUpdate,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> Area | None:
    organization_id = current_org.organization_id if current_org else None
    area = get_area(session, area_id, organization_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    return update_area(session, area_id, data)


@router.delete("/areas/{area_id}")
def delete_area_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
    _: None = require_org_role(
        UserOrganizationRole.manager, UserOrganizationRole.researcher
    ),
) -> dict[str, str]:
    organization_id = current_org.organization_id if current_org else None
    area = get_area(session, area_id, organization_id)
    if not area:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Área não encontrada", "type": "not_found"}],
        )
    delete_area(session, area_id)
    return {"msg": "Área deletada com sucesso"}
```

Note: `create_area` for a superuser (org None) raises 403 — a superuser creating an area must first create the project in an org via `POST /projects` with `organization_id`. Acceptable for this milestone; documented in Task 8.

- [ ] **Step 3: Rewrite `tests/test_areas.py`**

Keep the fixtures and unchanged CRUD tests from the current file, applying these changes:
- Rename `admin_membership` fixture → `manager_membership`, role `manager`.
- Make `auth_headers` depend on `manager_membership`.
- Delete `test_list_areas_scoped_to_project` (it creates a second membership for the same user, violating single-org).
- Add the tests below (cross-org scoping + role matrix).

Add these tests (place after `test_delete_area_not_found`):

```python
def test_researcher_can_create_area(
    client: TestClient,
    project: Project,
    organization: Organization,
    session: Session,
) -> None:
    researcher = User(
        name="Researcher", email="resarea@test.com", password_hash=hash_password("secret123")
    )
    session.add(researcher)
    session.commit()
    membership = UserOrganization(
        user_id=researcher.id, organization_id=organization.id,
        role=UserOrganizationRole.researcher,
    )
    session.add(membership)
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "resarea@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/projects/{project.id}/areas", json={"name": "Área 1"}, headers=headers
    )
    assert response.status_code == 200


def test_volunteer_cannot_create_area(
    client: TestClient,
    project: Project,
    organization: Organization,
    session: Session,
) -> None:
    volunteer = User(
        name="Volunteer", email="volarea@test.com", password_hash=hash_password("secret123")
    )
    session.add(volunteer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=volunteer.id, organization_id=organization.id,
            role=UserOrganizationRole.volunteer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "volarea@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/projects/{project.id}/areas", json={"name": "Área 1"}, headers=headers
    )
    assert response.status_code == 403


def test_user_cannot_read_other_org_area(
    client: TestClient,
    session: Session,
    project: Project,
    organization: Organization,
    auth_headers: dict,
) -> None:
    other_org = Organization(name="Outra ONG", slug="outra-ong-area")
    other_user = User(
        name="Other", email="otherarea@test.com", password_hash=hash_password("secret123")
    )
    session.add(other_org)
    session.add(other_user)
    session.commit()
    session.add(
        UserOrganization(
            user_id=other_user.id, organization_id=other_org.id,
            role=UserOrganizationRole.manager,
        )
    )
    session.commit()

    create_resp = client.post(
        f"/api/v1/projects/{project.id}/areas", json={"name": "Área A"}, headers=auth_headers
    )
    area_id = create_resp.json()["id"]

    login = client.post(
        "/api/v1/auth/login", json={"email": "otherarea@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get(f"/api/v1/areas/{area_id}", headers=headers)
    assert response.status_code == 404


def test_user_cannot_create_area_in_other_org_project(
    client: TestClient,
    session: Session,
    organization: Organization,
    project: Project,
    auth_headers: dict,
) -> None:
    other_org = Organization(name="Outra ONG 2", slug="outra-ong-area-2")
    other_user = User(
        name="Other 2", email="otherarea2@test.com", password_hash=hash_password("secret123")
    )
    session.add(other_org)
    session.add(other_user)
    session.commit()
    session.add(
        UserOrganization(
            user_id=other_user.id, organization_id=other_org.id,
            role=UserOrganizationRole.manager,
        )
    )
    session.commit()

    other_headers = _login_headers(client, "otherarea2@test.com")
    response = client.post(
        f"/api/v1/projects/{project.id}/areas", json={"name": "Área X"}, headers=other_headers
    )
    assert response.status_code == 403
```

Add the `_login_headers` helper (same as in Task 3) to `tests/test_areas.py`.

- [ ] **Step 4: Run the tests**

Run: `pytest tests/test_areas.py -v` — all pass.

- [ ] **Step 5: Full suite + lint + mypy**

Run: `pytest && ruff check src/ && mypy src/` — all pass.

- [ ] **Step 6: Commit**

```bash
git add src/openforest/api/services/area_service.py src/openforest/api/routers/areas.py tests/test_areas.py
git commit -m "feat: scope areas to organization and gate writes by role"
```

---

### Task 5: Monitoring — volunteer field entry

**Files:**
- Modify: `src/openforest/api/services/monitoring_service.py`, `src/openforest/api/routers/monitoring.py`, `src/openforest/api/dependencies/permissions.py`
- Rewrite: `tests/test_monitoring.py`

**Interfaces:**
- Produces:
  - `create_monitoring(session, area_id, data, organization_id: UUID) -> Monitoring`
  - `list_monitorings(session, area_id, organization_id: UUID | None = None) -> list[Monitoring]`
  - `get_monitoring(session, monitoring_id, organization_id: UUID | None = None) -> Monitoring | None`
  - `update_monitoring(session, monitoring_id, data)`, `delete_monitoring(session, monitoring_id)` unchanged
- Consumes: `require_area_role`, `check_area_role` from Task 2.
- Role matrix: create = manager|researcher|volunteer; update/delete = manager|researcher.

- [ ] **Step 1: Update the service**

`src/openforest/api/services/monitoring_service.py`:

```python
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.area import Area
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.project import Project
from openforest.api.schemas.monitoring import MonitoringCreate, MonitoringUpdate


def create_monitoring(
    session: Session, area_id: UUID, data: MonitoringCreate, organization_id: UUID
) -> Monitoring:
    area = session.get(Area, area_id)
    if not area:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Área com ID '{area_id}' não encontrada",
                    "type": "not_found",
                }
            ],
        )
    project = session.get(Project, area.project_id)
    if project is None or project.organization_id != organization_id:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    monitoring = Monitoring(**data.model_dump(), area_id=area_id)
    session.add(monitoring)
    session.commit()
    session.refresh(monitoring)
    return monitoring


def get_monitoring(
    session: Session, monitoring_id: UUID, organization_id: UUID | None = None
) -> Monitoring | None:
    stmt = (
        select(Monitoring)
        .join(Area, Monitoring.area_id == Area.id)
        .join(Project, Area.project_id == Project.id)
        .where(Monitoring.id == monitoring_id)
    )
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return session.exec(stmt).first()


def list_monitorings(
    session: Session, area_id: UUID, organization_id: UUID | None = None
) -> list[Monitoring]:
    stmt = (
        select(Monitoring)
        .join(Area, Monitoring.area_id == Area.id)
        .join(Project, Area.project_id == Project.id)
        .where(Monitoring.area_id == area_id)
    )
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return list(session.exec(stmt).all())


def update_monitoring(
    session: Session, monitoring_id: UUID, data: MonitoringUpdate
) -> Monitoring | None:
    monitoring = session.get(Monitoring, monitoring_id)
    if not monitoring:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(monitoring, field, value)
    session.commit()
    session.refresh(monitoring)
    return monitoring


def delete_monitoring(session: Session, monitoring_id: UUID) -> bool:
    monitoring = session.get(Monitoring, monitoring_id)
    if not monitoring:
        return False
    session.delete(monitoring)
    session.commit()
    return True
```

- [ ] **Step 2: Update the router**

`src/openforest/api/routers/monitoring.py` — full replacement:

```python
from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import CurrentOrgDep, CurrentUserDep
from openforest.api.dependencies.permissions import check_area_role, require_area_role
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.user_organization import UserOrganizationRole
from openforest.api.schemas.monitoring import (
    MonitoringCreate,
    MonitoringRead,
    MonitoringUpdate,
)
from openforest.api.services.monitoring_service import (
    create_monitoring,
    delete_monitoring,
    get_monitoring,
    list_monitorings,
    update_monitoring,
)

router = APIRouter(tags=["monitoramentos"])


@router.get("/areas/{area_id}/monitorings", response_model=list[MonitoringRead])
def list_monitorings_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
) -> list[Monitoring]:
    organization_id = current_org.organization_id if current_org else None
    return list_monitorings(session, area_id, organization_id)


@router.post("/areas/{area_id}/monitorings", response_model=MonitoringRead)
def create_monitoring_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    area_id: UUID,
    data: MonitoringCreate,
    _: None = require_area_role(
        area_id,
        UserOrganizationRole.manager,
        UserOrganizationRole.researcher,
        UserOrganizationRole.volunteer,
    ),
) -> Monitoring:
    organization_id = current_org.organization_id if current_org else None
    if organization_id is None:
        raise HTTPException(
            status_code=403,
            detail=[{"msg": "Permissão insuficiente", "type": "forbidden"}],
        )
    return create_monitoring(session, area_id, data, organization_id)


@router.get("/monitorings/{monitoring_id}", response_model=MonitoringRead)
def get_monitoring_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    monitoring_id: UUID,
) -> Monitoring | None:
    organization_id = current_org.organization_id if current_org else None
    monitoring = get_monitoring(session, monitoring_id, organization_id)
    if not monitoring:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Monitoramento não encontrado", "type": "not_found"}],
        )
    return monitoring


@router.patch("/monitorings/{monitoring_id}", response_model=MonitoringRead)
def update_monitoring_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    monitoring_id: UUID,
    data: MonitoringUpdate,
) -> Monitoring | None:
    organization_id = current_org.organization_id if current_org else None
    monitoring = get_monitoring(session, monitoring_id, organization_id)
    if not monitoring:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Monitoramento não encontrado", "type": "not_found"}],
        )
    check_area_role(
        session,
        current_user,
        current_org,
        monitoring.area_id,
        UserOrganizationRole.manager,
        UserOrganizationRole.researcher,
    )
    return update_monitoring(session, monitoring_id, data)


@router.delete("/monitorings/{monitoring_id}")
def delete_monitoring_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    monitoring_id: UUID,
) -> dict[str, str]:
    organization_id = current_org.organization_id if current_org else None
    monitoring = get_monitoring(session, monitoring_id, organization_id)
    if not monitoring:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Monitoramento não encontrado", "type": "not_found"}],
        )
    check_area_role(
        session,
        current_user,
        current_org,
        monitoring.area_id,
        UserOrganizationRole.manager,
        UserOrganizationRole.researcher,
    )
    delete_monitoring(session, monitoring_id)
    return {"msg": "Monitoramento deletado com sucesso"}
```

- [ ] **Step 3: Remove the temporary alias in `dependencies/permissions.py`**

Delete the line added in Task 2 Step 7:

```python
check_area_write_permission = check_area_role
```

- [ ] **Step 4: Rewrite `tests/test_monitoring.py`**

Apply the same fixture changes as Task 4 (rename to `manager_membership`, `auth_headers` depends on it), keep the CRUD tests, and add:

```python
def test_volunteer_can_create_monitoring(
    client: TestClient,
    area: Area,
    organization: Organization,
    session: Session,
) -> None:
    volunteer = User(
        name="Volunteer", email="volmon@test.com", password_hash=hash_password("secret123")
    )
    session.add(volunteer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=volunteer.id, organization_id=organization.id,
            role=UserOrganizationRole.volunteer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "volmon@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=headers,
    )
    assert response.status_code == 200


def test_viewer_cannot_create_monitoring(
    client: TestClient,
    area: Area,
    organization: Organization,
    session: Session,
) -> None:
    viewer = User(
        name="Viewer", email="viewermon@test.com", password_hash=hash_password("secret123")
    )
    session.add(viewer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=viewer.id, organization_id=organization.id,
            role=UserOrganizationRole.viewer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "viewermon@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=headers,
    )
    assert response.status_code == 403


def test_volunteer_cannot_update_monitoring(
    client: TestClient,
    area: Area,
    organization: Organization,
    session: Session,
    auth_headers: dict,
) -> None:
    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01", "seedling_count": 100},
        headers=auth_headers,
    )
    monitoring_id = create_resp.json()["id"]

    volunteer = User(
        name="Volunteer 2", email="volmon2@test.com", password_hash=hash_password("secret123")
    )
    session.add(volunteer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=volunteer.id, organization_id=organization.id,
            role=UserOrganizationRole.volunteer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "volmon2@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.patch(
        f"/api/v1/monitorings/{monitoring_id}",
        json={"seedling_count": 200},
        headers=headers,
    )
    assert response.status_code == 403


def test_user_cannot_read_other_org_monitoring(
    client: TestClient,
    session: Session,
    area: Area,
    organization: Organization,
    auth_headers: dict,
) -> None:
    other_org = Organization(name="Outra ONG", slug="outra-ong-mon")
    other_user = User(
        name="Other", email="othermon@test.com", password_hash=hash_password("secret123")
    )
    session.add(other_org)
    session.add(other_user)
    session.commit()
    session.add(
        UserOrganization(
            user_id=other_user.id, organization_id=other_org.id,
            role=UserOrganizationRole.manager,
        )
    )
    session.commit()

    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=auth_headers,
    )
    monitoring_id = create_resp.json()["id"]

    login = client.post(
        "/api/v1/auth/login", json={"email": "othermon@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get(f"/api/v1/monitorings/{monitoring_id}", headers=headers)
    assert response.status_code == 404
```

Add the `_login_headers` helper to `tests/test_monitoring.py`.

- [ ] **Step 5: Run the tests**

Run: `pytest tests/test_monitoring.py -v` — all pass.

- [ ] **Step 6: Full suite + lint + mypy**

Run: `pytest && ruff check src/ && mypy src/` — all pass.

- [ ] **Step 7: Commit**

```bash
git add src/openforest/api/services/monitoring_service.py src/openforest/api/routers/monitoring.py src/openforest/api/dependencies/permissions.py tests/test_monitoring.py
git commit -m "feat: scope monitoring and allow volunteer field entry"
```

---

### Task 6: Photos — scoped access, volunteer upload

**Files:**
- Modify: `src/openforest/api/services/photo_service.py`, `src/openforest/api/routers/photos.py`
- Rewrite: `tests/test_photos.py`

**Interfaces:**
- Produces:
  - `get_photo(session, photo_id, organization_id: UUID | None = None) -> Photo | None`
  - `create_photo(session, monitoring_id, data, file_path)`, `delete_photo(session, photo_id)` unchanged
- Consumes: `check_area_role` from Task 2.
- Role matrix: upload = manager|researcher|volunteer; delete = manager|researcher; get/download = any org member (scoped).

- [ ] **Step 1: Update the service**

`src/openforest/api/services/photo_service.py` — replace `get_photo` with an org-scoped version and add the join imports:

```python
from openforest.api.models.area import Area
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.photo import Photo
from openforest.api.models.project import Project
```

```python
def get_photo(
    session: Session, photo_id: UUID, organization_id: UUID | None = None
) -> Photo | None:
    stmt = (
        select(Photo)
        .join(Monitoring, Photo.monitoring_id == Monitoring.id)
        .join(Area, Monitoring.area_id == Area.id)
        .join(Project, Area.project_id == Project.id)
        .where(Photo.id == photo_id)
    )
    if organization_id is not None:
        stmt = stmt.where(Project.organization_id == organization_id)
    return session.exec(stmt).first()
```

- [ ] **Step 2: Update the router**

`src/openforest/api/routers/photos.py` — full replacement:

```python
from uuid import UUID

from fastapi import APIRouter, HTTPException, UploadFile
from fastapi.responses import Response

from openforest.api.config import settings
from openforest.api.dependencies.auth import CurrentOrgDep, CurrentUserDep
from openforest.api.dependencies.permissions import check_area_role
from openforest.api.infrastructure.database import SessionDep
from openforest.api.infrastructure.storage import delete_file, read_file, save_upload
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.photo import Photo
from openforest.api.models.user_organization import UserOrganizationRole
from openforest.api.schemas.photo import PhotoCreate, PhotoRead
from openforest.api.services.photo_service import create_photo, delete_photo, get_photo

router = APIRouter(tags=["fotos"])


@router.post("/monitorings/{monitoring_id}/photos", response_model=PhotoRead)
def upload_photo_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    monitoring_id: UUID,
    file: UploadFile,
) -> Photo:
    monitoring = session.get(Monitoring, monitoring_id)
    if not monitoring:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Monitoramento com ID '{monitoring_id}' não encontrado",
                    "type": "not_found",
                }
            ],
        )
    check_area_role(
        session,
        current_user,
        current_org,
        monitoring.area_id,
        UserOrganizationRole.manager,
        UserOrganizationRole.researcher,
        UserOrganizationRole.volunteer,
    )

    if file.content_type and not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=422,
            detail=[{"msg": "O arquivo deve ser uma imagem", "type": "validation_error"}],
        )

    file_bytes = file.file.read()

    max_size = settings.max_upload_size_mb * 1024 * 1024
    if len(file_bytes) > max_size:
        raise HTTPException(
            status_code=422,
            detail=[
                {
                    "msg": f"Arquivo excede o limite de {settings.max_upload_size_mb}MB",
                    "type": "validation_error",
                }
            ],
        )

    data = PhotoCreate(
        original_filename=file.filename,
        mime_type=file.content_type,
        file_size=len(file_bytes),
    )

    file_path = save_upload(file_bytes, file.filename or "", file.content_type, monitoring_id)
    try:
        photo = create_photo(session, monitoring_id, data, file_path)
    except Exception:
        delete_file(file_path)
        raise
    return photo


@router.get("/photos/{photo_id}", response_model=PhotoRead)
def get_photo_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    photo_id: UUID,
) -> Photo | None:
    organization_id = current_org.organization_id if current_org else None
    photo = get_photo(session, photo_id, organization_id)
    if not photo:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Foto não encontrada", "type": "not_found"}],
        )
    return photo


@router.get("/photos/{photo_id}/download")
def download_photo_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    photo_id: UUID,
) -> Response:
    organization_id = current_org.organization_id if current_org else None
    photo = get_photo(session, photo_id, organization_id)
    if not photo:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Foto não encontrada", "type": "not_found"}],
        )
    content = read_file(photo.file_path)
    filename = (
        (photo.original_filename or "foto").replace('"', "").replace("\r", "").replace("\n", "")
    )
    return Response(
        content=content,
        media_type=photo.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.delete("/photos/{photo_id}")
def delete_photo_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    photo_id: UUID,
) -> dict[str, str]:
    organization_id = current_org.organization_id if current_org else None
    photo = get_photo(session, photo_id, organization_id)
    if not photo:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Foto não encontrada", "type": "not_found"}],
        )
    monitoring = session.get(Monitoring, photo.monitoring_id)
    if monitoring:
        check_area_role(
            session,
            current_user,
            current_org,
            monitoring.area_id,
            UserOrganizationRole.manager,
            UserOrganizationRole.researcher,
        )
    deleted = delete_photo(session, photo_id)
    if deleted:
        delete_file(deleted.file_path)
    return {"msg": "Foto deletada com sucesso"}
```

- [ ] **Step 3: Rewrite `tests/test_photos.py`**

Apply the fixture changes (rename to `manager_membership`, `auth_headers` depends on it), keep the storage/upload/get/download/delete tests and the `local_storage` autouse fixture, and add:

```python
def test_volunteer_can_upload_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
) -> None:
    volunteer = User(
        name="Volunteer", email="volphoto@test.com", password_hash=hash_password("secret123")
    )
    session.add(volunteer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=volunteer.id, organization_id=organization.id,
            role=UserOrganizationRole.volunteer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "volphoto@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 200


def test_viewer_cannot_upload_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
) -> None:
    viewer = User(
        name="Viewer", email="viewerphoto@test.com", password_hash=hash_password("secret123")
    )
    session.add(viewer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=viewer.id, organization_id=organization.id,
            role=UserOrganizationRole.viewer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "viewerphoto@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 403


def test_volunteer_cannot_delete_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
    auth_headers: dict,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload_resp.json()["id"]

    volunteer = User(
        name="Volunteer 2", email="volphoto2@test.com", password_hash=hash_password("secret123")
    )
    session.add(volunteer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=volunteer.id, organization_id=organization.id,
            role=UserOrganizationRole.volunteer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "volphoto2@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.delete(f"/api/v1/photos/{photo_id}", headers=headers)
    assert response.status_code == 403


def test_researcher_can_delete_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
    auth_headers: dict,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload_resp.json()["id"]

    researcher = User(
        name="Researcher", email="resphoto@test.com", password_hash=hash_password("secret123")
    )
    session.add(researcher)
    session.commit()
    session.add(
        UserOrganization(
            user_id=researcher.id, organization_id=organization.id,
            role=UserOrganizationRole.researcher,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "resphoto@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.delete(f"/api/v1/photos/{photo_id}", headers=headers)
    assert response.status_code == 200


def test_user_cannot_read_other_org_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
    auth_headers: dict,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload_resp.json()["id"]

    other_org = Organization(name="Outra ONG", slug="outra-ong-photo")
    other_user = User(
        name="Other", email="otherphoto@test.com", password_hash=hash_password("secret123")
    )
    session.add(other_org)
    session.add(other_user)
    session.commit()
    session.add(
        UserOrganization(
            user_id=other_user.id, organization_id=other_org.id,
            role=UserOrganizationRole.manager,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "otherphoto@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get(f"/api/v1/photos/{photo_id}", headers=headers)
    assert response.status_code == 404
```

Note: existing `test_upload_photo_forbidden` and `test_delete_photo_forbidden` use `other_user` with no membership → `get_current_org` now returns 403 for them, so they still pass unchanged.

- [ ] **Step 4: Run the tests**

Run: `pytest tests/test_photos.py -v` — all pass.

- [ ] **Step 5: Full suite + lint + mypy**

Run: `pytest && ruff check src/ && mypy src/` — all pass.

- [ ] **Step 6: Commit**

```bash
git add src/openforest/api/services/photo_service.py src/openforest/api/routers/photos.py tests/test_photos.py
git commit -m "feat: scope photos to organization and allow volunteer upload"
```

---

### Task 7: Organizations — auto-manager, single-org guard, member management, enum cleanup

**Files:**
- Modify: `src/openforest/api/models/user_organization.py`, `src/openforest/api/services/organization_service.py`, `src/openforest/api/schemas/organization.py`, `src/openforest/api/routers/organizations.py`, `src/openforest/api/dependencies/auth.py`
- Create: `src/openforest/api/services/organization_membership_service.py`, `src/openforest/api/infrastructure/versions/<autogen>_multitenant_roles_and_single_org.py`
- Rewrite: `tests/test_organizations.py`

**Interfaces:**
- Consumes: `require_org_access` from Task 2.
- Produces:
  - `create_organization(session, data: OrganizationCreate, current_user: User) -> Organization` — 409 if the user already belongs to an org (non-superuser); auto-creates `manager` membership; sets `created_by`.
  - `list_members(session, organization_id) -> list[MemberRead]`
  - `add_member(session, organization_id, data: MemberAdd) -> MemberRead` — 409 if target already in another org.
  - `update_member_role(session, organization_id, user_id, data: MemberUpdate) -> MemberRead`
  - `remove_member(session, organization_id, user_id) -> None` — 422 if removing the last manager.
  - `MemberAdd(user_id, role)`, `MemberUpdate(role)`, `MemberRead(user_id, organization_id, role, name, email)`.
  - `UserOrganizationRole` loses `admin`; `UserOrganization` gains `UniqueConstraint("user_id")`.
  - Old `require_role` in `dependencies/auth.py` is removed (no longer used).

- [ ] **Step 1: Update the model**

`src/openforest/api/models/user_organization.py`:

```python
import enum
from uuid import UUID

from sqlmodel import Field, SQLModel, UniqueConstraint


class UserOrganizationRole(str, enum.Enum):
    manager = "manager"
    researcher = "researcher"
    volunteer = "volunteer"
    viewer = "viewer"


class UserOrganization(SQLModel, table=True):
    __tablename__ = "user_organization"

    __table_args__ = (UniqueConstraint("user_id", name="uq_user_organization_user_id"),)

    user_id: UUID = Field(
        nullable=False, primary_key=True, foreign_key="user.id", ondelete="CASCADE"
    )
    organization_id: UUID = Field(
        nullable=False, primary_key=True, foreign_key="organization.id", ondelete="CASCADE"
    )
    role: UserOrganizationRole = Field(nullable=False, default=UserOrganizationRole.viewer)
```

- [ ] **Step 2: Update the schemas**

`src/openforest/api/schemas/organization.py` — append:

```python
from openforest.api.models.user_organization import UserOrganizationRole


class MemberAdd(SQLModel):
    user_id: UUID
    role: UserOrganizationRole = UserOrganizationRole.viewer


class MemberUpdate(SQLModel):
    role: UserOrganizationRole


class MemberRead(SQLModel):
    user_id: UUID
    organization_id: UUID
    role: UserOrganizationRole
    name: str | None = None
    email: str | None = None
```

- [ ] **Step 3: Update `organization_service.py`**

Replace `create_organization` with:

```python
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole


def create_organization(
    session: Session, data: OrganizationCreate, current_user: User
) -> Organization:
    if not current_user.is_superuser:
        existing = session.exec(
            select(UserOrganization).where(UserOrganization.user_id == current_user.id)
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=[
                    {
                        "msg": "Usuário já vinculado a uma organização",
                        "type": "conflict",
                    }
                ],
            )

    if data.slug:
        _check_slug_unique(session, data.slug.strip())
        slug = data.slug.strip()
    else:
        slug = _generate_unique_slug(session, data.name)

    organization = Organization(
        **data.model_dump(exclude={"slug"}), slug=slug, created_by=current_user.id
    )
    session.add(organization)
    session.flush()
    if not current_user.is_superuser:
        session.add(
            UserOrganization(
                user_id=current_user.id,
                organization_id=organization.id,
                role=UserOrganizationRole.manager,
            )
        )
    session.commit()
    session.refresh(organization)
    return organization
```

`get_organization`, `list_organizations`, `update_organization`, `delete_organization` stay unchanged.

- [ ] **Step 4: Create `organization_membership_service.py`**

```python
from uuid import UUID

from fastapi import HTTPException
from sqlmodel import Session, select

from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
from openforest.api.schemas.organization import MemberAdd, MemberRead, MemberUpdate


def list_members(session: Session, organization_id: UUID) -> list[MemberRead]:
    stmt = (
        select(User, UserOrganization.role)
        .join(UserOrganization, UserOrganization.user_id == User.id)
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
```

- [ ] **Step 5: Rewrite `routers/organizations.py`**

```python
from uuid import UUID

from fastapi import APIRouter, HTTPException

from openforest.api.dependencies.auth import (
    CurrentOrgDep,
    CurrentUserDep,
    require_org_access,
)
from openforest.api.dependencies.pagination import PaginationDep
from openforest.api.infrastructure.database import SessionDep
from openforest.api.models.organization import Organization
from openforest.api.models.user_organization import UserOrganizationRole
from openforest.api.schemas.organization import (
    MemberAdd,
    MemberRead,
    MemberUpdate,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
)
from openforest.api.schemas.pagination import Paginated
from openforest.api.services.organization_membership_service import (
    add_member,
    list_members,
    remove_member,
    update_member_role,
)
from openforest.api.services.organization_service import (
    create_organization,
    delete_organization,
    get_organization,
    list_organizations,
    update_organization,
)

router = APIRouter(prefix="/organizations", tags=["organizações"])


@router.post("/", response_model=OrganizationRead)
def create_organization_route(
    session: SessionDep, current_user: CurrentUserDep, data: OrganizationCreate
) -> Organization:
    return create_organization(session, data, current_user)


@router.get("/", response_model=Paginated[OrganizationRead])
def list_organizations_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    current_org: CurrentOrgDep,
    pagination: PaginationDep,
) -> Paginated[Organization]:
    if current_org is not None:
        organization = session.get(Organization, current_org.organization_id)
        items = [organization] if organization else []
        return Paginated(
            items=items, total=len(items), offset=pagination.offset, limit=pagination.limit
        )
    items, total = list_organizations(session, pagination.offset, pagination.limit)
    return Paginated(items=items, total=total, offset=pagination.offset, limit=pagination.limit)


@router.get("/{organization_id}", response_model=OrganizationRead)
def get_organization_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    _: None = require_org_access(organization_id),
) -> Organization | None:
    organization = get_organization(session, organization_id)
    if not organization:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    return organization


@router.patch("/{organization_id}", response_model=OrganizationRead)
def update_organization_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    data: OrganizationUpdate,
    _: None = require_org_access(
        organization_id, UserOrganizationRole.manager
    ),
) -> Organization | None:
    organization = update_organization(session, organization_id, data)
    if not organization:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    return organization


@router.delete("/{organization_id}")
def delete_organization_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    _: None = require_org_access(
        organization_id, UserOrganizationRole.manager
    ),
) -> dict[str, str]:
    deleted = delete_organization(session, organization_id)
    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=[{"msg": "Organização não encontrada", "type": "not_found"}],
        )
    return {"msg": "Organização deletada com sucesso"}


@router.get("/{organization_id}/members", response_model=list[MemberRead])
def list_members_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    _: None = require_org_access(
        organization_id, UserOrganizationRole.manager
    ),
) -> list[MemberRead]:
    return list_members(session, organization_id)


@router.post("/{organization_id}/members", response_model=MemberRead)
def add_member_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    data: MemberAdd,
    _: None = require_org_access(
        organization_id, UserOrganizationRole.manager
    ),
) -> MemberRead:
    return add_member(session, organization_id, data)


@router.patch("/{organization_id}/members/{user_id}", response_model=MemberRead)
def update_member_role_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    user_id: UUID,
    data: MemberUpdate,
    _: None = require_org_access(
        organization_id, UserOrganizationRole.manager
    ),
) -> MemberRead:
    return update_member_role(session, organization_id, user_id, data)


@router.delete("/{organization_id}/members/{user_id}")
def remove_member_route(
    session: SessionDep,
    current_user: CurrentUserDep,
    organization_id: UUID,
    user_id: UUID,
    _: None = require_org_access(
        organization_id, UserOrganizationRole.manager
    ),
) -> dict[str, str]:
    remove_member(session, organization_id, user_id)
    return {"msg": "Membro removido com sucesso"}
```

- [ ] **Step 6: Remove the old `require_role`**

In `src/openforest/api/dependencies/auth.py`, delete the `require_role` function (lines `def require_role(...)` through the `return Depends(checker)`) — nothing references it anymore.

- [ ] **Step 7: Write the failing tests — rewrite `tests/test_organizations.py`**

```python
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from openforest.api.config import settings
from openforest.api.models.organization import Organization
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization, UserOrganizationRole
from openforest.api.services.auth_service import hash_password

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

    session = Session(bind=connection)

    session.begin_nested()

    def patched_commit():
        session.flush()
        session.begin_nested()

    session.commit = patched_commit

    yield session

    session.close()
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
def user(session):
    u = User(name="Test User", email="test@test.com", password_hash=hash_password("secret123"))
    session.add(u)
    session.commit()
    return u


@pytest.fixture
def auth_headers(client, user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@test.com", "password": "secret123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _register(client, name: str, email: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": "secret123"},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "secret123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


def test_create_organization(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Amazônia", "slug": "ong-amazonia"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "ONG Amazônia"
    assert data["slug"] == "ong-amazonia"
    assert "id" in data


def test_create_organization_binds_creator_as_manager(
    client: TestClient, session: Session, user: User, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Cerrado", "slug": "ong-cerrado"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    members_resp = client.get(
        f"/api/v1/organizations/{org_id}/members", headers=auth_headers
    )
    assert members_resp.status_code == 200
    members = members_resp.json()
    assert len(members) == 1
    assert members[0]["user_id"] == str(user.id)
    assert members[0]["role"] == "manager"


def test_create_second_organization_conflict(
    client: TestClient, auth_headers: dict
) -> None:
    client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    response = client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b"},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert any("já vinculado" in item["msg"] for item in response.json()["detail"])


def test_list_organizations_shows_own_org(
    client: TestClient, auth_headers: dict
) -> None:
    client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    response = client.get("/api/v1/organizations", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Org A"


def test_get_other_organization_returns_404(
    client: TestClient, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_a_id = create_resp.json()["id"]

    other_headers = _register(client, "Other", "other@test.com")
    other_create = client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b"},
        headers=other_headers,
    )
    org_b_id = other_create.json()["id"]

    assert client.get(f"/api/v1/organizations/{org_a_id}", headers=other_headers).status_code == 404
    assert client.get(f"/api/v1/organizations/{org_b_id}", headers=auth_headers).status_code == 404


def test_update_organization(
    client: TestClient, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Nome Original", "slug": "nome-original"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/organizations/{org_id}",
        json={"name": "Nome Atualizado"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Nome Atualizado"


def test_update_organization_requires_manager(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    viewer_headers = _register(client, "Viewer", "viewer@test.com")
    viewer_id = session.exec(
        select(User).where(User.email == "viewer@test.com")
    ).first().id
    session.add(
        UserOrganization(
            user_id=viewer_id, organization_id=org_id, role=UserOrganizationRole.viewer
        )
    )
    session.commit()

    response = client.patch(
        f"/api/v1/organizations/{org_id}",
        json={"name": "Inválido"},
        headers=viewer_headers,
    )
    assert response.status_code == 403


def test_delete_organization(
    client: TestClient, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org para deletar", "slug": "org-deletar"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/organizations/{org_id}", headers=auth_headers)
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/organizations/{org_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_create_organization_auto_slug(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Mata Atlântica"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["slug"] == "ong-mata-atlantica"


def test_add_member_and_list(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    member = User(
        name="Membro", email="membro@test.com", password_hash=hash_password("secret123")
    )
    session.add(member)
    session.commit()

    add_resp = client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": str(member.id), "role": "researcher"},
        headers=auth_headers,
    )
    assert add_resp.status_code == 200
    assert add_resp.json()["role"] == "researcher"

    list_resp = client.get(f"/api/v1/organizations/{org_id}/members", headers=auth_headers)
    members = list_resp.json()
    assert len(members) == 2
    assert {m["user_id"] for m in members} == {str(session.get(User, _).id for _ in [])} | {str(member.id)}
```

Note: the last assertion above is intentionally awkward — replace it with a clean one:

```python
    user_ids = {m["user_id"] for m in members}
    assert str(member.id) in user_ids
    assert len(user_ids) == 2
```

- [ ] **Step 8: Add the remaining member-management tests**

Append to `tests/test_organizations.py`:

```python
def test_add_member_already_in_other_org_returns_409(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    other_headers = _register(client, "Other", "other409@test.com")
    other_org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b"},
        headers=other_headers,
    )
    other_user_id = session.exec(
        select(User).where(User.email == "other409@test.com")
    ).first().id

    response = client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": str(other_user_id), "role": "viewer"},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert any("já pertence" in item["msg"] for item in response.json()["detail"])


def test_update_member_role(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    member = User(
        name="Membro", email="membro2@test.com", password_hash=hash_password("secret123")
    )
    session.add(member)
    session.commit()
    client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": str(member.id), "role": "viewer"},
        headers=auth_headers,
    )

    response = client.patch(
        f"/api/v1/organizations/{org_id}/members/{member.id}",
        json={"role": "researcher"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["role"] == "researcher"


def test_remove_member(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    member = User(
        name="Membro", email="membro3@test.com", password_hash=hash_password("secret123")
    )
    session.add(member)
    session.commit()
    client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": str(member.id), "role": "volunteer"},
        headers=auth_headers,
    )

    response = client.delete(
        f"/api/v1/organizations/{org_id}/members/{member.id}", headers=auth_headers
    )
    assert response.status_code == 200

    list_resp = client.get(f"/api/v1/organizations/{org_id}/members", headers=auth_headers)
    user_ids = {m["user_id"] for m in list_resp.json()}
    assert str(member.id) not in user_ids


def test_remove_last_manager_returns_422(
    client: TestClient, session: Session, auth_headers: dict, user: User
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    response = client.delete(
        f"/api/v1/organizations/{org_id}/members/{user.id}", headers=auth_headers
    )
    assert response.status_code == 422
    assert any("último manager" in item["msg"] for item in response.json()["detail"])


def test_members_requires_manager(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    viewer_headers = _register(client, "Viewer", "viewer409@test.com")
    viewer_id = session.exec(
        select(User).where(User.email == "viewer409@test.com")
    ).first().id
    session.add(
        UserOrganization(
            user_id=viewer_id, organization_id=org_id, role=UserOrganizationRole.viewer
        )
    )
    session.commit()

    response = client.get(
        f"/api/v1/organizations/{org_id}/members", headers=viewer_headers
    )
    assert response.status_code == 403
```

Add `from sqlmodel import select` to the imports of `tests/test_organizations.py`.

- [ ] **Step 9: Run the tests**

Run: `pytest tests/test_organizations.py -v`
Expected: FAIL — `AttributeError: 'Enum' object has no attribute 'admin'` or import/conflict errors (model changed but references remain). If a test fails because `UserOrganizationRole.admin` no longer exists anywhere, that confirms the enum cleanup is complete.

Run: `rg "UserOrganizationRole.admin|UserOrganizationRole\.admin" src/ tests/` — must return **no matches** in `src/`.

- [ ] **Step 10: Create the migration**

Run: `alembic revision -m "multitenant roles and single org"` (plain revision, not autogenerate — the enum work is manual). Set `down_revision` to the Task 1 revision id. Replace the stub with:

```python
"""multitenant roles and single org

Revision ID: <this file's autogenerated id>
Revises: <task1 revision id>
Create Date: 2026-08-06

"""

from typing import Sequence, Union

from alembic import op

revision: str = "<this file's autogenerated id>"
down_revision: Union[str, Sequence[str], None] = "<task1 revision id>"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE user_organization SET role = 'manager' WHERE role = 'admin'")

    op.execute(
        """
        DELETE FROM user_organization a
        USING user_organization b
        WHERE a.user_id = b.user_id
          AND a.organization_id <> b.organization_id
          AND a.role > b.role
        """
    )

    op.execute(
        "CREATE TYPE userorganizationrole_new AS ENUM "
        "('manager', 'researcher', 'volunteer', 'viewer')"
    )
    op.execute(
        "ALTER TABLE user_organization ALTER COLUMN role TYPE userorganizationrole_new "
        "USING role::text::userorganizationrole_new"
    )
    op.execute("DROP TYPE userorganizationrole")
    op.execute("ALTER TYPE userorganizationrole_new RENAME TO userorganizationrole")

    op.create_unique_constraint(
        "uq_user_organization_user_id", "user_organization", ["user_id"]
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_user_organization_user_id", "user_organization", type_="unique"
    )

    op.execute(
        "CREATE TYPE userorganizationrole_old AS ENUM "
        "('admin', 'manager', 'researcher', 'volunteer', 'viewer')"
    )
    op.execute(
        "ALTER TABLE user_organization ALTER COLUMN role TYPE userorganizationrole_old "
        "USING role::text::userorganizationrole_old"
    )
    op.execute("DROP TYPE userorganizationrole")
    op.execute("ALTER TYPE userorganizationrole_old RENAME TO userorganizationrole")
```

- [ ] **Step 11: Full suite + lint + mypy**

Run: `pytest && ruff check src/ && mypy src/` — all pass.

- [ ] **Step 12: Commit**

```bash
git add src/openforest/api/models/user_organization.py src/openforest/api/schemas/organization.py src/openforest/api/services/organization_service.py src/openforest/api/services/organization_membership_service.py src/openforest/api/routers/organizations.py src/openforest/api/dependencies/auth.py src/openforest/api/infrastructure/versions/ tests/test_organizations.py
git commit -m "feat: organization member management and single-org enforcement"
```

---

### Task 8: Superuser end-to-end + full verification

**Files:**
- Create: `tests/test_superuser.py`

**Interfaces:**
- Consumes: everything from Tasks 1–7.

- [ ] **Step 1: Write the failing tests**

Create `tests/test_superuser.py` (reuse the module boilerplate from `tests/test_organizations.py` — `test_engine`, `create_tables`, `session`, `client`, plus a `superuser` fixture):

```python
@pytest.fixture
def superuser(session):
    u = User(
        name="Admin",
        email="admin@test.com",
        password_hash=hash_password("secret123"),
        is_superuser=True,
    )
    session.add(u)
    session.commit()
    return u


@pytest.fixture
def admin_headers(client, superuser):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@test.com", "password": "secret123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_superuser_can_create_organization_without_membership(
    client: TestClient, admin_headers: dict
) -> None:
    response = client.post(
        "/api/v1/organizations",
        json={"name": "Org Admin", "slug": "org-admin"},
        headers=admin_headers,
    )
    assert response.status_code == 200
    org_id = response.json()["id"]

    members = client.get(
        f"/api/v1/organizations/{org_id}/members", headers=admin_headers
    ).json()
    assert members == []


def test_superuser_lists_all_organizations(
    client: TestClient, admin_headers: dict
) -> None:
    client.post(
        "/api/v1/organizations", json={"name": "Org 1", "slug": "org-1"}, headers=admin_headers
    )
    client.post(
        "/api/v1/organizations", json={"name": "Org 2", "slug": "org-2"}, headers=admin_headers
    )
    response = client.get("/api/v1/organizations", headers=admin_headers)
    assert response.json()["total"] == 2


def test_superuser_can_read_any_organization(
    client: TestClient, admin_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations", json={"name": "Org 1", "slug": "org-1"}, headers=admin_headers
    )
    org_id = create_resp.json()["id"]
    response = client.get(f"/api/v1/organizations/{org_id}", headers=admin_headers)
    assert response.status_code == 200


def test_superuser_can_create_project_in_any_org(
    client: TestClient, admin_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations", json={"name": "Org 1", "slug": "org-1"}, headers=admin_headers
    )
    org_id = org_resp.json()["id"]

    response = client.post(
        "/api/v1/projects",
        json={"name": "Projeto global", "organization_id": str(org_id)},
        headers=admin_headers,
    )
    assert response.status_code == 200
    assert response.json()["organization_id"] == str(org_id)


def test_superuser_requires_organization_id_for_project(
    client: TestClient, admin_headers: dict
) -> None:
    response = client.post(
        "/api/v1/projects",
        json={"name": "Projeto sem org"},
        headers=admin_headers,
    )
    assert response.status_code == 422


def test_superuser_reads_all_projects(
    client: TestClient, admin_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations", json={"name": "Org 1", "slug": "org-1"}, headers=admin_headers
    )
    org_id = org_resp.json()["id"]
    client.post(
        "/api/v1/projects",
        json={"name": "Projeto global", "organization_id": str(org_id)},
        headers=admin_headers,
    )

    response = client.get("/api/v1/projects", headers=admin_headers)
    assert response.json()["total"] == 1
```

- [ ] **Step 2: Run to verify they pass**

Run: `pytest tests/test_superuser.py -v` — all pass.

- [ ] **Step 3: Full suite + lint + mypy**

Run: `pytest && ruff check src/ && mypy src/`
Expected: everything passes. Fix any stragglers (e.g. unused imports) with `ruff check --fix src/`.

- [ ] **Step 4: Verify the spec's Definition of Done**

Check each item from the spec:
- Rotas, dependências e services escopados conforme a matriz — covered by Tasks 2–6 (tests in each).
- Endpoints de membros funcionando (manager/superuser) — Task 7.
- Migrações aplicadas e dados legados tratados — Tasks 1 & 7. **Important:** do NOT run `alembic upgrade head` here unless asked; the migration files are reviewed and committed, and applied separately by the maintainer.
- Testes cobrindo a matriz e o escopo — Tasks 2–8.
- Docs atualizadas — already committed (README, AGENTS.md, ARCHITECTURE.md, ROADMAP.md).

- [ ] **Step 5: Commit**

```bash
git add tests/test_superuser.py
git commit -m "test: superuser multi-tenant bypass"
```

---

## Self-Review Notes

- **Spec coverage:** every spec item maps to a task (matrix → Tasks 2–6, members → Task 7, migrations → Tasks 1 & 7, no-org 403 → Task 2, cross-org read blocked → Tasks 3–6, create-org auto-manager → Task 7, superuser → Task 8).
- **Deferred items** (export gate, per-project permissions, RLS, multi-org switcher) are intentionally not built — they are recorded in the spec's "Itens Adiados".
- **Known limitation:** superuser creating an area/monitoring/photo must go through a project/area/monitoring created in an org first (area create raises 403 when `current_org` is None). Documented in Task 4; acceptable for this milestone.

# Database Models Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all SQLModel table models defined in the database design spec, including Alembic migration.

**Architecture:** SQLModel models in `models/` directory, each entity in its own file. Schemas in `schemas/` directory. Tests use SQLite in-memory. Alembic generates the initial migration.

**Tech Stack:** SQLModel (SQLAlchemy + Pydantic), Alembic, pytest + httpx

## Global Constraints

- All models inherit from `Base` (UUID id, auto created_at, auto updated_at)
- Use `Annotated` for dependency injection where applicable
- Types: `UUID` primary keys, `datetime` with UTC timezone
- Foreign keys use `ON DELETE CASCADE`
- All model files go in `backend/src/openforest/api/models/`
- All schema files go in `backend/src/openforest/api/schemas/`
- Tests go in `backend/tests/`
- Run `ruff check` and `mypy` after each task

---

### Task 1: Base Model + Model Scaffold

**Files:**
- Create: `backend/src/openforest/api/models/__init__.py`
- Create: `backend/src/openforest/api/models/base.py`
- Create: `backend/src/openforest/api/schemas/__init__.py`
- Modify: `backend/src/openforest/api/infrastructure/env.py:15`
- Modify: `backend/pyproject.toml`

**Interfaces:**
- Consumes: nothing
- Produces: `Base` class with `id: UUID`, `created_at: datetime`, `updated_at: datetime`

- [ ] **Step 1: Write the failing test**

```python
# tests/test_base_model.py
from uuid import UUID
from datetime import datetime, timezone

from sqlmodel import Session, SQLModel, create_engine

from openforest.api.models.base import Base


def test_base_model_attributes() -> None:
    class TestModel(Base, table=True):
        __tablename__ = "test_model"
        name: str

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        obj = TestModel(name="test")
        session.add(obj)
        session.commit()
        session.refresh(obj)

        assert isinstance(obj.id, UUID)
        assert isinstance(obj.created_at, datetime)
        assert isinstance(obj.updated_at, datetime)
        assert obj.created_at.tzinfo is not None
        assert obj.updated_at.tzinfo is not None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_base_model.py -v`
Expected: FAIL — ModuleNotFoundError or ImportError (models don't exist yet)

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/openforest/api/models/base.py
from uuid import UUID, uuid4
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Base(SQLModel):
    id: UUID = Field(default_factory=uuid4, primary_key=True)
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
    )
    updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        sa_column_kwargs={"onupdate": lambda: datetime.now(timezone.utc)},
    )
```

```python
# backend/src/openforest/api/models/__init__.py
from openforest.api.models.base import Base

__all__ = ["Base"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_base_model.py -v`
Expected: PASS

- [ ] **Step 5: Update env.py to import models**

```python
# backend/src/openforest/api/infrastructure/env.py:15
from openforest.api import models  # noqa: F401

target_metadata = SQLModel.metadata
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/openforest/api/models/ backend/src/openforest/api/infrastructure/env.py tests/test_base_model.py
git commit -m "feat: add Base model with UUID PK and auto timestamps"
```

---

### Task 2: User Model

**Files:**
- Create: `backend/src/openforest/api/models/user.py`
- Create: `backend/src/openforest/api/schemas/user.py`
- Create: `backend/tests/test_models_user.py`
- Modify: `backend/src/openforest/api/models/__init__.py`

**Interfaces:**
- Consumes: `Base` from `openforest.api.models.base`
- Produces: `User` table model, `UserCreate`/`UserRead`/`UserUpdate` schemas

- [ ] **Step 1: Write the failing test**

```python
# tests/test_models_user.py
from uuid import UUID
from datetime import datetime

from sqlmodel import Session, SQLModel, create_engine

from openforest.api.models.user import User


def test_user_creation() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(name="Ana Silva", email="ana@institutoverde.org", password_hash="abc123")
        session.add(user)
        session.commit()
        session.refresh(user)

        assert isinstance(user.id, UUID)
        assert user.name == "Ana Silva"
        assert user.email == "ana@institutoverde.org"
        assert user.password_hash == "abc123"
        assert isinstance(user.created_at, datetime)


def test_user_email_unique() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user1 = User(name="Ana", email="same@email.com", password_hash="a")
        user2 = User(name="João", email="same@email.com", password_hash="b")
        session.add(user1)
        session.commit()
        session.add(user2)
        import pytest
        with pytest.raises(Exception):
            session.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models_user.py -v`
Expected: FAIL — ImportError

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/openforest/api/models/user.py
from sqlmodel import Field

from openforest.api.models.base import Base


class User(Base, table=True):
    __tablename__ = "user"

    name: str = Field(nullable=False)
    email: str = Field(nullable=False, unique=True)
    password_hash: str = Field(nullable=False)
```

```python
# backend/src/openforest/api/schemas/user.py
from uuid import UUID
from datetime import datetime

from pydantic import EmailStr

from openforest.api.models.base import Base


class UserCreate(Base):
    name: str
    email: EmailStr
    password: str


class UserRead(Base):
    id: UUID
    name: str
    email: str
    created_at: datetime
    updated_at: datetime


class UserUpdate(Base):
    name: str | None = None
    email: EmailStr | None = None
```

```python
# backend/src/openforest/api/models/__init__.py
from openforest.api.models.base import Base
from openforest.api.models.user import User

__all__ = ["Base", "User"]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_models_user.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/openforest/api/models/ backend/src/openforest/api/schemas/ tests/test_models_user.py
git commit -m "feat: add User model with unique email constraint"
```

---

### Task 3: Organization + UserOrganization Models

**Files:**
- Create: `backend/src/openforest/api/models/organization.py`
- Create: `backend/src/openforest/api/schemas/organization.py`
- Create: `backend/tests/test_models_organization.py`
- Modify: `backend/src/openforest/api/models/__init__.py`

**Interfaces:**
- Consumes: `User` from `openforest.api.models.user`
- Produces: `Organization` table model, `UserOrganization` table model with role enum

- [ ] **Step 1: Write the failing test**

```python
# tests/test_models_organization.py
from uuid import UUID
import enum

from sqlmodel import Session, SQLModel, create_engine

from openforest.api.models.user import User
from openforest.api.models.organization import Organization, UserOrganization, OrganizationRole


def test_organization_creation() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        org = Organization(name="Instituto Verde Vivo", slug="instituto-verde-vivo")
        session.add(org)
        session.commit()
        session.refresh(org)

        assert isinstance(org.id, UUID)
        assert org.name == "Instituto Verde Vivo"
        assert org.slug == "instituto-verde-vivo"


def test_user_membership() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        user = User(name="Ana", email="ana@org.org", password_hash="x")
        org = Organization(name="Verde Vivo", slug="verde-vivo")
        session.add(user)
        session.add(org)
        session.commit()

        membership = UserOrganization(user_id=user.id, organization_id=org.id, role=OrganizationRole.admin)
        session.add(membership)
        session.commit()
        session.refresh(membership)

        assert membership.role == OrganizationRole.admin
        assert str(membership.user_id) == str(user.id)
        assert str(membership.organization_id) == str(org.id)


def test_org_slug_unique() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        org1 = Organization(name="Org A", slug="same-slug")
        org2 = Organization(name="Org B", slug="same-slug")
        session.add(org1)
        session.commit()
        session.add(org2)
        import pytest
        with pytest.raises(Exception):
            session.commit()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models_organization.py -v`
Expected: FAIL — ImportError

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/openforest/api/models/organization.py
import enum
from uuid import UUID

from sqlmodel import Field, SQLModel

from openforest.api.models.base import Base


class OrganizationRole(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    researcher = "researcher"
    volunteer = "volunteer"
    viewer = "viewer"


class Organization(Base, table=True):
    __tablename__ = "organization"

    name: str = Field(nullable=False)
    slug: str = Field(nullable=False, unique=True)
    description: str | None = Field(default=None)


class UserOrganization(SQLModel, table=True):
    __tablename__ = "user_organization"

    user_id: UUID = Field(foreign_key="user.id", primary_key=True, ondelete="CASCADE")
    organization_id: UUID = Field(foreign_key="organization.id", primary_key=True, ondelete="CASCADE")
    role: OrganizationRole = Field(nullable=False)
```

```python
# backend/src/openforest/api/schemas/organization.py
from uuid import UUID
from datetime import datetime

from openforest.api.models.base import Base


class OrganizationCreate(Base):
    name: str
    slug: str
    description: str | None = None


class OrganizationRead(Base):
    id: UUID
    name: str
    slug: str
    description: str | None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Update models __init__.py**

```python
# backend/src/openforest/api/models/__init__.py
from openforest.api.models.base import Base
from openforest.api.models.user import User
from openforest.api.models.organization import Organization, OrganizationRole, UserOrganization

__all__ = ["Base", "User", "Organization", "OrganizationRole", "UserOrganization"]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_models_organization.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/openforest/api/models/ backend/src/openforest/api/schemas/ tests/test_models_organization.py
git commit -m "feat: add Organization and UserOrganization models with role enum"
```

---

### Task 4: Project Model

**Files:**
- Create: `backend/src/openforest/api/models/project.py`
- Create: `backend/src/openforest/api/schemas/project.py`
- Create: `backend/tests/test_models_project.py`
- Modify: `backend/src/openforest/api/models/__init__.py`

**Interfaces:**
- Consumes: `Organization` from `openforest.api.models.organization`
- Produces: `Project` table model

- [ ] **Step 1: Write the failing test**

```python
# tests/test_models_project.py
from uuid import UUID
from datetime import date

from sqlmodel import Session, SQLModel, create_engine

from openforest.api.models.organization import Organization
from openforest.api.models.project import Project


def test_project_creation() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        org = Organization(name="Org", slug="org")
        session.add(org)
        session.commit()

        project = Project(
            organization_id=org.id,
            name="Recuperação do Rio Cuiabá",
            description="Restauração de mata ciliar",
            goal="Plantar 1000 mudas",
            start_date=date(2026, 1, 15),
            responsible="Ana Silva",
        )
        session.add(project)
        session.commit()
        session.refresh(project)

        assert isinstance(project.id, UUID)
        assert project.name == "Recuperação do Rio Cuiabá"
        assert str(project.organization_id) == str(org.id)
        assert project.responsible == "Ana Silva"


def test_project_org_relationship() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        org = Organization(name="Org", slug="org-rel")
        project = Project(organization_id=org.id, name="Projeto A")
        session.add(org)
        session.add(project)
        session.commit()
        session.refresh(project)

        assert project.organization_id == org.id
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models_project.py -v`
Expected: FAIL — ImportError

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/openforest/api/models/project.py
from uuid import UUID
from datetime import date

from sqlmodel import Field

from openforest.api.models.base import Base


class Project(Base, table=True):
    __tablename__ = "project"

    organization_id: UUID = Field(foreign_key="organization.id", nullable=False, ondelete="CASCADE", index=True)
    name: str = Field(nullable=False)
    description: str | None = Field(default=None)
    goal: str | None = Field(default=None)
    start_date: date | None = Field(default=None)
    responsible: str | None = Field(default=None)
```

```python
# backend/src/openforest/api/schemas/project.py
from uuid import UUID
from datetime import date, datetime

from openforest.api.models.base import Base


class ProjectCreate(Base):
    organization_id: UUID
    name: str
    description: str | None = None
    goal: str | None = None
    start_date: date | None = None
    responsible: str | None = None


class ProjectRead(Base):
    id: UUID
    organization_id: UUID
    name: str
    description: str | None
    goal: str | None
    start_date: date | None
    responsible: str | None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Update models __init__.py**

```python
# backend/src/openforest/api/models/__init__.py
from openforest.api.models.base import Base
from openforest.api.models.user import User
from openforest.api.models.organization import Organization, OrganizationRole, UserOrganization
from openforest.api.models.project import Project

__all__ = ["Base", "User", "Organization", "OrganizationRole", "UserOrganization", "Project"]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_models_project.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/openforest/api/models/ backend/src/openforest/api/schemas/ tests/test_models_project.py
git commit -m "feat: add Project model with FK to Organization"
```

---

### Task 5: Area Model

**Files:**
- Create: `backend/src/openforest/api/models/area.py`
- Create: `backend/src/openforest/api/schemas/area.py`
- Create: `backend/tests/test_models_area.py`
- Modify: `backend/src/openforest/api/models/__init__.py`

**Interfaces:**
- Consumes: `Project` from `openforest.api.models.project`
- Produces: `Area` table model with restoration_status enum

- [ ] **Step 1: Write the failing test**

```python
# tests/test_models_area.py
from uuid import UUID

from sqlmodel import Session, SQLModel, create_engine

from openforest.api.models.organization import Organization
from openforest.api.models.project import Project
from openforest.api.models.area import Area, RestorationStatus


def test_area_creation() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        org = Organization(name="Org", slug="org-area")
        session.add(org)
        session.commit()

        project = Project(organization_id=org.id, name="Projeto")
        session.add(project)
        session.commit()

        area = Area(
            project_id=project.id,
            name="Área 01",
            size_hectares=12.5,
            biome="Cerrado",
            coordinates={"lat": -15.5, "lng": -56.0},
        )
        session.add(area)
        session.commit()
        session.refresh(area)

        assert isinstance(area.id, UUID)
        assert area.name == "Área 01"
        assert area.size_hectares == 12.5
        assert area.biome == "Cerrado"
        assert area.coordinates == {"lat": -15.5, "lng": -56.0}
        assert area.restoration_status == RestorationStatus.planned


def test_area_status_transition() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        org = Organization(name="Org", slug="org-area2")
        session.add(org)
        session.commit()

        project = Project(organization_id=org.id, name="Projeto")
        session.add(project)
        session.commit()

        area = Area(project_id=project.id, name="Área 02", restoration_status=RestorationStatus.active)
        session.add(area)
        session.commit()
        session.refresh(area)

        assert area.restoration_status == RestorationStatus.active
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models_area.py -v`
Expected: FAIL — ImportError

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/openforest/api/models/area.py
import enum
from uuid import UUID

from sqlmodel import JSON, Column, Field

from openforest.api.models.base import Base


class RestorationStatus(str, enum.Enum):
    planned = "planned"
    active = "active"
    completed = "completed"
    cancelled = "cancelled"


class Area(Base, table=True):
    __tablename__ = "area"

    project_id: UUID = Field(foreign_key="project.id", nullable=False, ondelete="CASCADE")
    name: str = Field(nullable=False)
    size_hectares: float | None = Field(default=None)
    biome: str | None = Field(default=None)
    coordinates: dict | None = Field(default=None, sa_column=Column(JSON))
    restoration_status: RestorationStatus = Field(default=RestorationStatus.planned)
```

```python
# backend/src/openforest/api/schemas/area.py
from uuid import UUID
from datetime import datetime

from openforest.api.models.base import Base
from openforest.api.models.area import RestorationStatus


class AreaCreate(Base):
    project_id: UUID
    name: str
    size_hectares: float | None = None
    biome: str | None = None
    coordinates: dict | None = None
    restoration_status: RestorationStatus = RestorationStatus.planned


class AreaRead(Base):
    id: UUID
    project_id: UUID
    name: str
    size_hectares: float | None
    biome: str | None
    coordinates: dict | None
    restoration_status: RestorationStatus
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 4: Update models __init__.py**

```python
# backend/src/openforest/api/models/__init__.py
from openforest.api.models.base import Base
from openforest.api.models.user import User
from openforest.api.models.organization import Organization, OrganizationRole, UserOrganization
from openforest.api.models.project import Project
from openforest.api.models.area import Area, RestorationStatus

__all__ = [
    "Base", "User", "Organization", "OrganizationRole", "UserOrganization",
    "Project", "Area", "RestorationStatus",
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_models_area.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/openforest/api/models/ backend/src/openforest/api/schemas/ tests/test_models_area.py
git commit -m "feat: add Area model with restoration status enum and JSON coordinates"
```

---

### Task 6: Monitoring + Photo Models

**Files:**
- Create: `backend/src/openforest/api/models/monitoring.py`
- Create: `backend/src/openforest/api/schemas/monitoring.py`
- Create: `backend/tests/test_models_monitoring.py`
- Modify: `backend/src/openforest/api/models/__init__.py`

**Interfaces:**
- Consumes: `Area` from `openforest.api.models.area`
- Produces: `Monitoring` and `Photo` table models

- [ ] **Step 1: Write the failing test**

```python
# tests/test_models_monitoring.py
from uuid import UUID
from datetime import date

from sqlmodel import Session, SQLModel, create_engine

from openforest.api.models.organization import Organization
from openforest.api.models.project import Project
from openforest.api.models.area import Area
from openforest.api.models.monitoring import Monitoring, Photo


def test_monitoring_creation() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        org = Organization(name="Org", slug="org-mon")
        session.add(org)
        session.commit()

        project = Project(organization_id=org.id, name="Projeto")
        session.add(project)
        session.commit()

        area = Area(project_id=project.id, name="Área 01")
        session.add(area)
        session.commit()

        monitoring = Monitoring(
            area_id=area.id,
            visit_date=date(2026, 3, 20),
            notes="Plantio realizado com sucesso",
            seedling_count=500,
            avg_height=0.3,
            species_data=[{"name": "Ipê Amarelo", "count": 200}, {"name": "Angico", "count": 300}],
        )
        session.add(monitoring)
        session.commit()
        session.refresh(monitoring)

        assert isinstance(monitoring.id, UUID)
        assert monitoring.visit_date == date(2026, 3, 20)
        assert monitoring.seedling_count == 500
        assert monitoring.avg_height == 0.3
        assert len(monitoring.species_data) == 2
        assert monitoring.species_data[0]["name"] == "Ipê Amarelo"


def test_photo_creation() -> None:
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        org = Organization(name="Org", slug="org-photo")
        session.add(org)
        session.commit()

        project = Project(organization_id=org.id, name="Projeto")
        session.add(project)
        session.commit()

        area = Area(project_id=project.id, name="Área 01")
        session.add(area)
        session.commit()

        monitoring = Monitoring(area_id=area.id, visit_date=date(2026, 3, 20))
        session.add(monitoring)
        session.commit()

        photo = Photo(
            monitoring_id=monitoring.id,
            file_path="monitoring/uuid-here/photo-1.jpg",
            original_filename="img_20260320.jpg",
            mime_type="image/jpeg",
            file_size=2048576,
            width=1920,
            height=1080,
        )
        session.add(photo)
        session.commit()
        session.refresh(photo)

        assert isinstance(photo.id, UUID)
        assert photo.file_path == "monitoring/uuid-here/photo-1.jpg"
        assert photo.mime_type == "image/jpeg"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/test_models_monitoring.py -v`
Expected: FAIL — ImportError

- [ ] **Step 3: Write minimal implementation**

```python
# backend/src/openforest/api/models/monitoring.py
from uuid import UUID
from datetime import date

from sqlmodel import JSON, Column, Field, Index

from openforest.api.models.base import Base


class Monitoring(Base, table=True):
    __tablename__ = "monitoring"
    __table_args__ = (Index("idx_monitoring_area_date", "area_id", "visit_date"),)

    area_id: UUID = Field(foreign_key="area.id", nullable=False, ondelete="CASCADE")
    visit_date: date = Field(nullable=False)
    notes: str | None = Field(default=None)
    seedling_count: int | None = Field(default=None)
    avg_height: float | None = Field(default=None)
    species_data: list[dict] | None = Field(default=None, sa_column=Column(JSON))


class Photo(Base, table=True):
    __tablename__ = "photo"

    monitoring_id: UUID = Field(foreign_key="monitoring.id", nullable=False, ondelete="CASCADE", index=True)
    file_path: str = Field(nullable=False)
    original_filename: str | None = Field(default=None)
    mime_type: str | None = Field(default=None)
    file_size: int | None = Field(default=None)
    width: int | None = Field(default=None)
    height: int | None = Field(default=None)
```

```python
# backend/src/openforest/api/schemas/monitoring.py
from uuid import UUID
from datetime import date, datetime

from openforest.api.models.base import Base


class MonitoringCreate(Base):
    area_id: UUID
    visit_date: date
    notes: str | None = None
    seedling_count: int | None = None
    avg_height: float | None = None
    species_data: list[dict] | None = None


class MonitoringRead(Base):
    id: UUID
    area_id: UUID
    visit_date: date
    notes: str | None
    seedling_count: int | None
    avg_height: float | None
    species_data: list[dict] | None
    created_at: datetime
    updated_at: datetime


class PhotoCreate(Base):
    monitoring_id: UUID
    file_path: str
    original_filename: str | None = None
    mime_type: str | None = None
    file_size: int | None = None
    width: int | None = None
    height: int | None = None


class PhotoRead(Base):
    id: UUID
    monitoring_id: UUID
    file_path: str
    original_filename: str | None
    mime_type: str | None
    file_size: int | None
    width: int | None
    height: int | None
    created_at: datetime
```

- [ ] **Step 4: Update models __init__.py**

```python
# backend/src/openforest/api/models/__init__.py
from openforest.api.models.base import Base
from openforest.api.models.user import User
from openforest.api.models.organization import Organization, OrganizationRole, UserOrganization
from openforest.api.models.project import Project
from openforest.api.models.area import Area, RestorationStatus
from openforest.api.models.monitoring import Monitoring, Photo

__all__ = [
    "Base", "User", "Organization", "OrganizationRole", "UserOrganization",
    "Project", "Area", "RestorationStatus", "Monitoring", "Photo",
]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/test_models_monitoring.py -v`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/openforest/api/models/ backend/src/openforest/api/schemas/ tests/test_models_monitoring.py
git commit -m "feat: add Monitoring and Photo models with JSON species_data"
```

---

### Task 7: Alembic Initial Migration

**Files:**
- Create: `backend/src/openforest/api/infrastructure/versions/` (Alembic will create this)
- Verify: migration output matches the ER diagram

**Interfaces:**
- Consumes: All models imported via `models/__init__.py` into `env.py`
- Produces: Alembic migration file

- [ ] **Step 1: Verify all models are importable in env.py**

Read `backend/src/openforest/api/infrastructure/env.py` and confirm it has:

```python
from openforest.api import models  # noqa: F401
```

- [ ] **Step 2: Generate initial migration**

Run: `cd backend && alembic revision --autogenerate -m "initial models"`
Expected: Migration file created in `backend/src/openforest/api/infrastructure/versions/`

- [ ] **Step 3: Review migration output**

Check the generated migration contains CREATE TABLE statements for:
- `user`
- `organization`
- `user_organization`
- `project`
- `area`
- `monitoring`
- `photo`

Check FKs match the ER diagram:
- `user_organization.user_id → user.id`
- `user_organization.organization_id → organization.id`
- `project.organization_id → organization.id`
- `area.project_id → project.id`
- `monitoring.area_id → area.id`
- `photo.monitoring_id → monitoring.id`

Check unique constraints:
- `user.email`
- `organization.slug`

- [ ] **Step 4: Apply migration (dry-run) to verify it's valid**

Run: `cd backend && alembic upgrade head --sql`
Expected: SQL output showing all CREATE TABLE statements without errors

- [ ] **Step 5: Commit**

```bash
git add backend/src/openforest/api/infrastructure/versions/
git commit -m "feat: add initial Alembic migration for all MVP models"
```

---

### Self-Review Checklist

- [ ] **Spec coverage:** All 7 entities from spec have models: User, Organization, UserOrganization, Project, Area, Monitoring, Photo
- [ ] **Placeholder scan:** No TBD, TODO, or vague steps
- [ ] **Type consistency:** FK field types (UUID) match referenced PKs (UUID); relationship directions are correct
- [ ] **Test coverage:** Each model has creation test; unique constraints tested for User.email and Organization.slug; enum values tested

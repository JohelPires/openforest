from pathlib import Path
from urllib.parse import urlparse, urlunparse

import pytest
from sqlmodel import Session, SQLModel, create_engine, func, select, text

from openforest.api.config import settings
from openforest.api.models.area import Area
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.organization import Organization
from openforest.api.models.photo import Photo
from openforest.api.models.project import Project
from openforest.api.models.user import User
from openforest.api.models.user_organization import UserOrganization
from openforest.api.seed import DEFAULT_PASSWORD, SUPERUSER_EMAIL, reset, seed
from openforest.api.services.auth_service import verify_password

parsed = urlparse(settings.database_url)
test_db_url = urlunparse(parsed._replace(path="/openforest_test"))
test_engine = create_engine(test_db_url)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    with test_engine.begin() as connection:
        connection.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
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


@pytest.fixture(autouse=True)
def local_storage(tmp_path):
    original_backend = settings.storage_backend
    original_path = settings.storage_path
    settings.storage_backend = "local"
    settings.storage_path = str(tmp_path)
    yield
    settings.storage_backend = original_backend
    settings.storage_path = original_path


def _count(session: Session, model: type[SQLModel]) -> int:
    return session.exec(select(func.count()).select_from(model)).one()


def test_seed_creates_realistic_data(session) -> None:
    report = seed(session, create_photos=True)
    session.commit()

    assert report.users_created >= 22
    assert report.organizations_created >= 6
    assert report.projects_created >= 13
    assert report.areas_created >= 50
    assert report.monitorings_created >= 400
    assert report.photos_created >= 600

    assert _count(session, Organization) == report.organizations_created
    assert _count(session, Project) == report.projects_created
    assert _count(session, Area) == report.areas_created
    assert _count(session, Monitoring) == report.monitorings_created
    assert _count(session, Photo) == report.photos_created

    photos_files = [p for p in Path(settings.storage_path).rglob("*") if p.is_file()]
    assert len(photos_files) == report.photos_created


def test_seed_is_idempotent(session) -> None:
    seed(session, create_photos=True)
    session.commit()
    counts_before = {
        "organization": _count(session, Organization),
        "project": _count(session, Project),
        "area": _count(session, Area),
        "monitoring": _count(session, Monitoring),
        "photo": _count(session, Photo),
        "user": _count(session, User),
    }

    second = seed(session, create_photos=True)
    session.commit()

    assert second.users_created == 0
    assert second.organizations_created == 0
    assert second.projects_created == 0
    assert second.areas_created == 0
    assert second.monitorings_created == 0
    assert second.photos_created == 0

    assert counts_before == {
        "organization": _count(session, Organization),
        "project": _count(session, Project),
        "area": _count(session, Area),
        "monitoring": _count(session, Monitoring),
        "photo": _count(session, Photo),
        "user": _count(session, User),
    }


def test_reset_clears_tables_and_reseeds(session) -> None:
    seed(session, create_photos=False)
    session.commit()

    reset(session)

    for model in (Photo, Monitoring, Area, Project, UserOrganization, Organization, User):
        assert _count(session, model) == 0

    second = seed(session, create_photos=False)
    session.commit()

    assert second.organizations_created >= 6
    assert second.areas_created >= 50
    assert _count(session, Monitoring) == second.monitorings_created


def test_seed_credentials(session) -> None:
    seed(session, create_photos=False)
    session.commit()

    admin = session.exec(select(User).where(User.email == SUPERUSER_EMAIL)).one()
    assert admin.is_superuser is True
    assert verify_password(DEFAULT_PASSWORD, admin.password_hash)

    org_users = session.exec(select(User).where(User.email != SUPERUSER_EMAIL)).all()
    assert len(org_users) >= 21
    for user in org_users[:3]:
        assert verify_password(DEFAULT_PASSWORD, user.password_hash)


def test_seed_memberships(session) -> None:
    seed(session, create_photos=False)
    session.commit()

    memberships = session.exec(select(UserOrganization)).all()
    org_users = session.exec(select(User).where(User.email != SUPERUSER_EMAIL)).all()
    assert len(memberships) == len(org_users)
    assert all(
        membership.role in ("manager", "researcher", "volunteer", "viewer")
        for membership in memberships
    )


def test_seed_without_photos_writes_no_files(session) -> None:
    seed(session, create_photos=False)
    session.commit()

    assert _count(session, Photo) == 0
    files = [p for p in Path(settings.storage_path).rglob("*") if p.is_file()]
    assert files == []

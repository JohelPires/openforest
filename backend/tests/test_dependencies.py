from urllib.parse import urlparse, urlunparse

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, text

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
    membership = UserOrganization(user_id=user.id, organization_id=organization.id, role=role)
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
def super_route(_: None = Depends(require_superuser)) -> dict:
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


def test_get_current_org_for_no_org_user(session, user):
    app, headers = _headers(session, user)
    with TestClient(app) as c:
        response = c.get("/me-org", headers=headers)
    app.dependency_overrides.clear()
    assert response.status_code == 403
    assert any("vinculado" in item["msg"] for item in response.json()["detail"])


def test_get_current_org_for_superuser(session):
    admin = User(
        name="Admin",
        email="admin@test.com",
        password_hash=hash_password("secret123"),
        is_superuser=True,
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
        name="Admin",
        email="admin2@test.com",
        password_hash=hash_password("secret123"),
        is_superuser=True,
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
        name="Admin",
        email="admin3@test.com",
        password_hash=hash_password("secret123"),
        is_superuser=True,
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

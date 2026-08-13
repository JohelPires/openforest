from urllib.parse import urlparse, urlunparse

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, text

from openforest.api.config import settings
from openforest.api.models.user import User
from openforest.api.services.auth_service import hash_password

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
def client(session):
    from openforest.api.infrastructure.database import get_session
    from openforest.api.main import app

    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


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

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

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
def project(session, organization):
    proj = Project(name="Projeto Teste", organization_id=organization.id)
    session.add(proj)
    session.commit()
    return proj


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


def test_create_area(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    response = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={
            "name": "Área 1",
            "biome": "Mata Atlântica",
            "goal": "Restaurar 5 ha de mata ciliar",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Área 1"
    assert data["biome"] == "Mata Atlântica"
    assert data["goal"] == "Restaurar 5 ha de mata ciliar"
    assert data["project_id"] == str(project.id)
    assert "id" in data


def test_create_area_invalid_project(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        f"/api/v1/projects/{uuid4()}/areas",
        json={"name": "Área Inválida"},
        headers=auth_headers,
    )
    assert response.status_code == 422
    data = response.json()
    assert any("não encontrado" in item["msg"] for item in data["detail"])


def test_list_areas_empty(client: TestClient, project: Project, auth_headers: dict) -> None:
    response = client.get(f"/api/v1/projects/{project.id}/areas", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_list_areas_by_project(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área A"},
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área B"},
        headers=auth_headers,
    )
    response = client.get(f"/api/v1/projects/{project.id}/areas", headers=auth_headers)
    assert len(response.json()) == 2


def test_get_area(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    create_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área para GET"},
        headers=auth_headers,
    )
    area_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/areas/{area_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Área para GET"


def test_get_area_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.get(f"/api/v1/areas/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_update_area(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    create_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Nome Original", "biome": "Cerrado"},
        headers=auth_headers,
    )
    area_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/areas/{area_id}",
        json={"name": "Nome Atualizado", "goal": "Meta atualizada"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Nome Atualizado"
    assert response.json()["biome"] == "Cerrado"
    assert response.json()["goal"] == "Meta atualizada"


def test_update_area_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.patch(
        f"/api/v1/areas/{uuid4()}",
        json={"name": "Qualquer"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_delete_area(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    create_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área para deletar"},
        headers=auth_headers,
    )
    area_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/areas/{area_id}", headers=auth_headers)
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/areas/{area_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_delete_area_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.delete(f"/api/v1/areas/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


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

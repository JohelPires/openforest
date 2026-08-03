from urllib.parse import urlparse, urlunparse
from uuid import UUID, uuid4

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
def admin_membership(session, user, organization):
    membership = UserOrganization(
        user_id=user.id, organization_id=organization.id, role=UserOrganizationRole.admin
    )
    session.add(membership)
    session.commit()
    return membership


@pytest.fixture
def auth_headers(client, user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@test.com", "password": "secret123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_area(
    client: TestClient, project: Project, auth_headers: dict, admin_membership: UserOrganization
) -> None:
    response = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área 1", "biome": "Mata Atlântica"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Área 1"
    assert data["biome"] == "Mata Atlântica"
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
    client: TestClient, project: Project, auth_headers: dict, admin_membership: UserOrganization
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


def test_list_areas_scoped_to_project(
    client: TestClient,
    project: Project,
    organization: Organization,
    session: Session,
    user: User,
    auth_headers: dict,
    admin_membership: UserOrganization,
) -> None:
    other_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Outra ONG", "slug": "outra-ong"},
        headers=auth_headers,
    )
    other_org_id = other_resp.json()["id"]
    membership = UserOrganization(
        user_id=user.id, organization_id=UUID(other_org_id), role=UserOrganizationRole.admin
    )
    session.add(membership)
    session.commit()
    other_resp = client.post(
        "/api/v1/projects",
        json={"name": "Outro Projeto", "organization_id": other_org_id},
        headers=auth_headers,
    )
    other_project_id = other_resp.json()["id"]

    client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área do Projeto 1"},
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/projects/{other_project_id}/areas",
        json={"name": "Área do Projeto 2"},
        headers=auth_headers,
    )

    response = client.get(f"/api/v1/projects/{project.id}/areas", headers=auth_headers)
    assert len(response.json()) == 1
    assert response.json()[0]["name"] == "Área do Projeto 1"


def test_get_area(
    client: TestClient, project: Project, auth_headers: dict, admin_membership: UserOrganization
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
    client: TestClient, project: Project, auth_headers: dict, admin_membership: UserOrganization
) -> None:
    create_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Nome Original", "biome": "Cerrado"},
        headers=auth_headers,
    )
    area_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/areas/{area_id}",
        json={"name": "Nome Atualizado"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Nome Atualizado"
    assert response.json()["biome"] == "Cerrado"


def test_update_area_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.patch(
        f"/api/v1/areas/{uuid4()}",
        json={"name": "Qualquer"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_delete_area(
    client: TestClient, project: Project, auth_headers: dict, admin_membership: UserOrganization
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

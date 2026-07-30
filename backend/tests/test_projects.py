from urllib.parse import urlparse, urlunparse
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from openforest.api.config import settings
from openforest.api.models.organization import Organization

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
def client(session):
    from openforest.api.infrastructure.database import get_session
    from openforest.api.main import app

    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def test_create_project(client: TestClient, organization: Organization) -> None:
    response = client.post(
        "/api/v1/projects",
        json={"name": "Reflorestamento Mata Atlântica", "organization_id": str(organization.id)},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Reflorestamento Mata Atlântica"
    assert data["organization_id"] == str(organization.id)
    assert "id" in data


def test_list_projects_empty(client: TestClient) -> None:
    response = client.get("/api/v1/projects")
    assert response.status_code == 200
    assert response.json() == []


def test_get_project_not_found(client: TestClient, organization: Organization) -> None:
    response = client.get(f"/api/v1/projects/{uuid4()}")
    assert response.status_code == 404


def test_create_and_list(client: TestClient, organization: Organization) -> None:
    client.post(
        "/api/v1/projects",
        json={"name": "Projeto A", "organization_id": str(organization.id)},
    )
    client.post(
        "/api/v1/projects",
        json={"name": "Projeto B", "organization_id": str(organization.id)},
    )
    response = client.get("/api/v1/projects")
    assert len(response.json()) == 2


def test_update_project(client: TestClient, organization: Organization) -> None:
    create_resp = client.post(
        "/api/v1/projects",
        json={"name": "Nome Original", "organization_id": str(organization.id)},
    )
    project_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/projects/{project_id}",
        json={"name": "Nome Atualizado"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Nome Atualizado"


def test_update_project_not_found(client: TestClient, organization: Organization) -> None:
    response = client.patch(
        f"/api/v1/projects/{uuid4()}",
        json={"name": "Qualquer"},
    )
    assert response.status_code == 404


def test_delete_project(client: TestClient, organization: Organization) -> None:
    create_resp = client.post(
        "/api/v1/projects",
        json={"name": "Projeto para deletar", "organization_id": str(organization.id)},
    )
    project_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/projects/{project_id}")
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/projects/{project_id}")
    assert get_response.status_code == 404


def test_delete_project_not_found(client: TestClient, organization: Organization) -> None:
    response = client.delete(f"/api/v1/projects/{uuid4()}")
    assert response.status_code == 404


def test_create_project_invalid_organization(client: TestClient) -> None:
    response = client.post(
        "/api/v1/projects",
        json={"name": "Projeto Inválido", "organization_id": str(uuid4())},
    )
    assert response.status_code == 422
    data = response.json()
    assert any("não encontrada" in item["msg"] for item in data["detail"])

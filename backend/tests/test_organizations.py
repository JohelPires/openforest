from urllib.parse import urlparse, urlunparse
from uuid import uuid4

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


def test_create_organization(client: TestClient) -> None:
    response = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Amazônia", "slug": "ong-amazonia"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "ONG Amazônia"
    assert data["slug"] == "ong-amazonia"
    assert data["description"] is None
    assert "id" in data


def test_create_organization_with_description(client: TestClient) -> None:
    response = client.post(
        "/api/v1/organizations",
        json={
            "name": "ONG Mata Atlântica",
            "slug": "ong-mata-atlantica",
            "description": "Preservação da Mata Atlântica",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "ONG Mata Atlântica"
    assert data["description"] == "Preservação da Mata Atlântica"


def test_list_organizations_empty(client: TestClient) -> None:
    response = client.get("/api/v1/organizations")
    assert response.status_code == 200
    assert response.json() == []


def test_create_and_list(client: TestClient) -> None:
    client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
    )
    client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b"},
    )
    response = client.get("/api/v1/organizations")
    assert len(response.json()) == 2


def test_get_organization(client: TestClient) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Cerrado", "slug": "ong-cerrado"},
    )
    org_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/organizations/{org_id}")
    assert response.status_code == 200
    assert response.json()["name"] == "ONG Cerrado"


def test_get_organization_not_found(client: TestClient) -> None:
    response = client.get(f"/api/v1/organizations/{uuid4()}")
    assert response.status_code == 404


def test_update_organization(client: TestClient) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Nome Original", "slug": "nome-original"},
    )
    org_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/organizations/{org_id}",
        json={"name": "Nome Atualizado"},
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Nome Atualizado"


def test_update_organization_not_found(client: TestClient) -> None:
    response = client.patch(
        f"/api/v1/organizations/{uuid4()}",
        json={"name": "Qualquer"},
    )
    assert response.status_code == 404


def test_delete_organization(client: TestClient) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "ONG para deletar", "slug": "ong-deletar"},
    )
    org_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/organizations/{org_id}")
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/organizations/{org_id}")
    assert get_response.status_code == 404


def test_delete_organization_not_found(client: TestClient) -> None:
    response = client.delete(f"/api/v1/organizations/{uuid4()}")
    assert response.status_code == 404


def test_create_duplicate_slug(client: TestClient) -> None:
    client.post(
        "/api/v1/organizations",
        json={"name": "Primeira", "slug": "slug-repetido"},
    )
    response = client.post(
        "/api/v1/organizations",
        json={"name": "Segunda", "slug": "slug-repetido"},
    )
    assert response.status_code == 422
    data = response.json()
    assert any("já está em uso" in item["msg"] for item in data["detail"])

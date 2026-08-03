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
def auth_headers(client, user):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@test.com", "password": "secret123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _add_admin_membership(session, user_id, org_id):
    membership = UserOrganization(
        user_id=user_id, organization_id=org_id, role=UserOrganizationRole.admin
    )
    session.add(membership)
    session.commit()


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
    assert data["description"] is None
    assert "id" in data


def test_create_organization_with_description(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        "/api/v1/organizations",
        json={
            "name": "ONG Mata Atlântica",
            "slug": "ong-mata-atlantica",
            "description": "Preservação da Mata Atlântica",
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "ONG Mata Atlântica"
    assert data["description"] == "Preservação da Mata Atlântica"


def test_list_organizations_empty(client: TestClient, auth_headers: dict) -> None:
    response = client.get("/api/v1/organizations", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "offset": 0, "limit": 20}


def test_create_and_list(client: TestClient, auth_headers: dict) -> None:
    client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b"},
        headers=auth_headers,
    )
    response = client.get("/api/v1/organizations", headers=auth_headers)
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 2


def test_list_organizations_pagination(client: TestClient, auth_headers: dict) -> None:
    for name, slug in [("Org A", "org-a"), ("Org B", "org-b"), ("Org C", "org-c")]:
        client.post(
            "/api/v1/organizations",
            json={"name": name, "slug": slug},
            headers=auth_headers,
        )

    page_one = client.get("/api/v1/organizations?offset=0&limit=2", headers=auth_headers).json()
    assert len(page_one["items"]) == 2
    assert page_one["total"] == 3
    assert page_one["offset"] == 0
    assert page_one["limit"] == 2

    page_two = client.get("/api/v1/organizations?offset=2&limit=2", headers=auth_headers).json()
    assert len(page_two["items"]) == 1
    assert page_two["total"] == 3
    assert page_two["offset"] == 2

    past_end = client.get("/api/v1/organizations?offset=10&limit=2", headers=auth_headers).json()
    assert past_end["items"] == []
    assert past_end["total"] == 3


def test_list_organizations_invalid_pagination(client: TestClient, auth_headers: dict) -> None:
    assert (
        client.get("/api/v1/organizations?limit=0", headers=auth_headers).status_code == 422
    )
    assert (
        client.get("/api/v1/organizations?limit=101", headers=auth_headers).status_code == 422
    )
    assert (
        client.get("/api/v1/organizations?offset=-1", headers=auth_headers).status_code == 422
    )


def test_get_organization(client: TestClient, auth_headers: dict) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Cerrado", "slug": "ong-cerrado"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/organizations/{org_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "ONG Cerrado"


def test_get_organization_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.get(f"/api/v1/organizations/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_update_organization(
    client: TestClient, session: Session, user: User, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Nome Original", "slug": "nome-original"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]
    _add_admin_membership(session, user.id, org_id)

    response = client.patch(
        f"/api/v1/organizations/{org_id}",
        json={"name": "Nome Atualizado"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Nome Atualizado"


def test_update_organization_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.patch(
        f"/api/v1/organizations/{uuid4()}",
        json={"name": "Qualquer"},
        headers=auth_headers,
    )
    assert response.status_code == 403


def test_delete_organization(
    client: TestClient, session: Session, user: User, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "ONG para deletar", "slug": "ong-deletar"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]
    _add_admin_membership(session, user.id, org_id)

    response = client.delete(f"/api/v1/organizations/{org_id}", headers=auth_headers)
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/organizations/{org_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_delete_organization_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.delete(f"/api/v1/organizations/{uuid4()}", headers=auth_headers)
    assert response.status_code == 403


def test_create_organization_auto_slug(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Mata Atlântica"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "ong-mata-atlantica"


def test_create_organization_auto_slug_avoids_conflict(
    client: TestClient, auth_headers: dict
) -> None:
    client.post(
        "/api/v1/organizations",
        json={"name": "ONG Teste", "slug": "ong-teste"},
        headers=auth_headers,
    )
    response = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Teste"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "ong-teste-1"


def test_update_organization_auto_slug(
    client: TestClient, session: Session, user: User, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Nome Original", "slug": "slug-original"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]
    _add_admin_membership(session, user.id, org_id)

    response = client.patch(
        f"/api/v1/organizations/{org_id}",
        json={"slug": None},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["slug"] == "nome-original"


def test_create_duplicate_slug_returns_error(client: TestClient, auth_headers: dict) -> None:
    client.post(
        "/api/v1/organizations",
        json={"name": "Primeira", "slug": "slug-repetido"},
        headers=auth_headers,
    )
    response = client.post(
        "/api/v1/organizations",
        json={"name": "Segunda", "slug": "slug-repetido"},
        headers=auth_headers,
    )
    assert response.status_code == 422
    data = response.json()
    assert any("já está em uso" in item["msg"] for item in data["detail"])

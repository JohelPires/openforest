from urllib.parse import urlparse, urlunparse

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from openforest.api.config import settings
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


def _register(client, name: str, email: str) -> dict:
    client.post(
        "/api/v1/auth/register",
        json={"name": name, "email": email, "password": "secret123"},
    )
    login = client.post("/api/v1/auth/login", json={"email": email, "password": "secret123"})
    return {"Authorization": f"Bearer {login.json()['access_token']}"}


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
    assert "id" in data


def test_create_organization_binds_creator_as_manager(
    client: TestClient, session: Session, user: User, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Cerrado", "slug": "ong-cerrado"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    members_resp = client.get(
        f"/api/v1/organizations/{org_id}/members", headers=auth_headers
    )
    assert members_resp.status_code == 200
    members = members_resp.json()
    assert len(members) == 1
    assert members[0]["user_id"] == str(user.id)
    assert members[0]["role"] == "manager"


def test_create_second_organization_conflict(
    client: TestClient, auth_headers: dict
) -> None:
    client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    response = client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b"},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert any("já vinculado" in item["msg"] for item in response.json()["detail"])


def test_list_organizations_shows_own_org(
    client: TestClient, auth_headers: dict
) -> None:
    client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    response = client.get("/api/v1/organizations", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Org A"


def test_get_other_organization_returns_404(
    client: TestClient, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_a_id = create_resp.json()["id"]

    other_headers = _register(client, "Other", "other@test.com")
    other_create = client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b"},
        headers=other_headers,
    )
    org_b_id = other_create.json()["id"]

    assert client.get(f"/api/v1/organizations/{org_a_id}", headers=other_headers).status_code == 404
    assert client.get(f"/api/v1/organizations/{org_b_id}", headers=auth_headers).status_code == 404


def test_update_organization(
    client: TestClient, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Nome Original", "slug": "nome-original"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/organizations/{org_id}",
        json={"name": "Nome Atualizado"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Nome Atualizado"


def test_update_organization_requires_manager(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    viewer_headers = _register(client, "Viewer", "viewer@test.com")
    viewer_id = session.exec(
        select(User).where(User.email == "viewer@test.com")
    ).first().id
    session.add(
        UserOrganization(
            user_id=viewer_id, organization_id=org_id, role=UserOrganizationRole.viewer
        )
    )
    session.commit()

    response = client.patch(
        f"/api/v1/organizations/{org_id}",
        json={"name": "Inválido"},
        headers=viewer_headers,
    )
    assert response.status_code == 403


def test_delete_organization(
    client: TestClient, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org para deletar", "slug": "org-deletar"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/organizations/{org_id}", headers=auth_headers)
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/organizations/{org_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_create_organization_auto_slug(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        "/api/v1/organizations",
        json={"name": "ONG Mata Atlântica"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["slug"] == "ong-mata-atlantica"


def test_add_member_and_list(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    create_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = create_resp.json()["id"]

    member = User(
        name="Membro", email="membro@test.com", password_hash=hash_password("secret123")
    )
    session.add(member)
    session.commit()

    add_resp = client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": str(member.id), "role": "researcher"},
        headers=auth_headers,
    )
    assert add_resp.status_code == 200
    assert add_resp.json()["role"] == "researcher"

    list_resp = client.get(f"/api/v1/organizations/{org_id}/members", headers=auth_headers)
    members = list_resp.json()
    assert len(members) == 2
    user_ids = {m["user_id"] for m in members}
    assert str(member.id) in user_ids
    assert len(user_ids) == 2


def test_add_member_already_in_other_org_returns_409(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    other_headers = _register(client, "Other", "other409@test.com")
    other_org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org B", "slug": "org-b"},
        headers=other_headers,
    )
    other_user_id = session.exec(
        select(User).where(User.email == "other409@test.com")
    ).first().id

    response = client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": str(other_user_id), "role": "viewer"},
        headers=auth_headers,
    )
    assert response.status_code == 409
    assert any("já pertence" in item["msg"] for item in response.json()["detail"])


def test_update_member_role(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    member = User(
        name="Membro", email="membro2@test.com", password_hash=hash_password("secret123")
    )
    session.add(member)
    session.commit()
    client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": str(member.id), "role": "viewer"},
        headers=auth_headers,
    )

    response = client.patch(
        f"/api/v1/organizations/{org_id}/members/{member.id}",
        json={"role": "researcher"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["role"] == "researcher"


def test_remove_member(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    member = User(
        name="Membro", email="membro3@test.com", password_hash=hash_password("secret123")
    )
    session.add(member)
    session.commit()
    client.post(
        f"/api/v1/organizations/{org_id}/members",
        json={"user_id": str(member.id), "role": "volunteer"},
        headers=auth_headers,
    )

    response = client.delete(
        f"/api/v1/organizations/{org_id}/members/{member.id}", headers=auth_headers
    )
    assert response.status_code == 200

    list_resp = client.get(f"/api/v1/organizations/{org_id}/members", headers=auth_headers)
    user_ids = {m["user_id"] for m in list_resp.json()}
    assert str(member.id) not in user_ids


def test_remove_last_manager_returns_422(
    client: TestClient, session: Session, auth_headers: dict, user: User
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    response = client.delete(
        f"/api/v1/organizations/{org_id}/members/{user.id}", headers=auth_headers
    )
    assert response.status_code == 422
    assert any("último manager" in item["msg"] for item in response.json()["detail"])


def test_demote_last_manager_returns_422(
    client: TestClient, session: Session, auth_headers: dict, user: User
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    response = client.patch(
        f"/api/v1/organizations/{org_id}/members/{user.id}",
        json={"role": "viewer"},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert any("último manager" in item["msg"] for item in response.json()["detail"])


def test_members_requires_manager(
    client: TestClient, session: Session, auth_headers: dict
) -> None:
    org_resp = client.post(
        "/api/v1/organizations",
        json={"name": "Org A", "slug": "org-a"},
        headers=auth_headers,
    )
    org_id = org_resp.json()["id"]

    viewer_headers = _register(client, "Viewer", "viewer409@test.com")
    viewer_id = session.exec(
        select(User).where(User.email == "viewer409@test.com")
    ).first().id
    session.add(
        UserOrganization(
            user_id=viewer_id, organization_id=org_id, role=UserOrganizationRole.viewer
        )
    )
    session.commit()

    response = client.get(
        f"/api/v1/organizations/{org_id}/members", headers=viewer_headers
    )
    assert response.status_code == 403

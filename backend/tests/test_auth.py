from urllib.parse import urlparse, urlunparse

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, select

from openforest.api.config import settings
from openforest.api.infrastructure.database import get_session
from openforest.api.models.user import User
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
    from openforest.api.main import app

    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers(client):
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Test User", "email": "test@test.com", "password": "secret123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_register_user(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Novo User", "email": "novo@test.com", "password": "123456"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_register_user_not_superuser(client: TestClient, session: Session) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"name": "Comum", "email": "comum@test.com", "password": "123456"},
    )
    user = session.exec(select(User).where(User.email == "comum@test.com")).first()
    assert user is not None
    assert user.is_superuser is False


def test_register_duplicate_email(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Outro", "email": "test@test.com", "password": "123456"},
    )
    assert response.status_code == 409
    data = response.json()
    assert any("já cadastrado" in item["msg"] for item in data["detail"])


def test_login_success(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"name": "Login User", "email": "login@test.com", "password": "123456"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "login@test.com", "password": "123456"},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_login_wrong_password(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={"name": "Wrong PW", "email": "wrongpw@test.com", "password": "123456"},
    )
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpw@test.com", "password": "wrong"},
    )
    assert response.status_code == 401


def test_login_email_not_found(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "naoexiste@test.com", "password": "123456"},
    )
    assert response.status_code == 401


def test_refresh_token_success(client: TestClient) -> None:
    reg = client.post(
        "/api/v1/auth/register",
        json={"name": "Refresh User", "email": "refresh@test.com", "password": "123456"},
    )
    refresh_token = reg.json()["refresh_token"]

    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data


def test_refresh_token_invalid(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": "invalid-token"},
    )
    assert response.status_code == 401


def test_protected_endpoint_no_auth(client: TestClient) -> None:
    response = client.get("/api/v1/projects")
    assert response.status_code == 401


def test_protected_endpoint_invalid_token(client: TestClient) -> None:
    response = client.get(
        "/api/v1/projects",
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


def test_protected_endpoint_user_without_org_forbidden(
    client: TestClient, auth_headers: dict
) -> None:
    response = client.get("/api/v1/projects", headers=auth_headers)
    assert response.status_code == 403


def test_me_no_token(client: TestClient) -> None:
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401


def test_me_without_org(client: TestClient, auth_headers: dict) -> None:
    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test User"
    assert data["email"] == "test@test.com"
    assert data["organization"] is None


def test_me_with_org(client: TestClient, auth_headers: dict) -> None:
    org_response = client.post(
        "/api/v1/organizations",
        json={"name": "Minha Org", "slug": "minha-org"},
        headers=auth_headers,
    )
    assert org_response.status_code == 200
    org_id = org_response.json()["id"]
    org_name = org_response.json()["name"]

    response = client.get("/api/v1/auth/me", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["organization"]["id"] == org_id
    assert data["organization"]["name"] == org_name
    assert data["organization"]["role"] == "manager"


def test_me_superuser(client: TestClient, session: Session) -> None:
    superuser = User(
        name="Admin",
        email="admin-me@test.com",
        password_hash=hash_password("secret123"),
        is_superuser=True,
    )
    session.add(superuser)
    session.commit()

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "admin-me@test.com", "password": "secret123"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = client.get("/api/v1/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Admin"
    assert data["organization"] is None


def test_health_public(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.status_code == 200

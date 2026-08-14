from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, text

from openforest.api.config import settings
from openforest.api.models.area import Area
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
def area(session, project):
    a = Area(name="Área Teste", project_id=project.id)
    session.add(a)
    session.commit()
    return a


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


def test_create_monitoring(
    client: TestClient, area: Area, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    response = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={
            "visit_date": "2026-07-01",
            "seedling_count": 150,
            "avg_height": 1.5,
        },
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["visit_date"] == "2026-07-01"
    assert data["seedling_count"] == 150
    assert data["avg_height"] == 1.5
    assert data["area_id"] == str(area.id)
    assert "id" in data


def test_create_monitoring_invalid_area(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        f"/api/v1/areas/{uuid4()}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=auth_headers,
    )
    assert response.status_code == 422
    data = response.json()
    assert any("não encontrada" in item["msg"] for item in data["detail"])


def test_list_monitorings_empty(client: TestClient, area: Area, auth_headers: dict) -> None:
    response = client.get(f"/api/v1/areas/{area.id}/monitorings", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "offset": 0, "limit": 20}


def test_list_monitorings_by_area(
    client: TestClient, area: Area, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-08-01"},
        headers=auth_headers,
    )
    response = client.get(f"/api/v1/areas/{area.id}/monitorings", headers=auth_headers)
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 2


def test_list_monitorings_scoped_to_area(
    client: TestClient,
    area: Area,
    project: Project,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    other_area_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Outra Área"},
        headers=auth_headers,
    )
    other_area_id = other_area_resp.json()["id"]

    client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=auth_headers,
    )
    client.post(
        f"/api/v1/areas/{other_area_id}/monitorings",
        json={"visit_date": "2026-08-01"},
        headers=auth_headers,
    )

    response = client.get(f"/api/v1/areas/{area.id}/monitorings", headers=auth_headers)
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["visit_date"] == "2026-07-01"


def test_list_monitorings_total_scoped_to_area(
    client: TestClient,
    project: Project,
    area: Area,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    other_area_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Outra Área"},
        headers=auth_headers,
    )
    other_area_id = other_area_resp.json()["id"]

    for visit_date in ["2026-05-01", "2026-06-01", "2026-07-01"]:
        client.post(
            f"/api/v1/areas/{area.id}/monitorings",
            json={"visit_date": visit_date},
            headers=auth_headers,
        )
    for visit_date in ["2026-07-02", "2026-07-03"]:
        client.post(
            f"/api/v1/areas/{other_area_id}/monitorings",
            json={"visit_date": visit_date},
            headers=auth_headers,
        )

    page_one = client.get(
        f"/api/v1/areas/{area.id}/monitorings?offset=0&limit=2", headers=auth_headers
    ).json()
    assert len(page_one["items"]) == 2
    assert page_one["total"] == 3

    beyond_last = client.get(
        f"/api/v1/areas/{area.id}/monitorings?offset=3&limit=2", headers=auth_headers
    ).json()
    assert beyond_last["items"] == []
    assert beyond_last["total"] == 3


def test_list_monitorings_pagination(
    client: TestClient, area: Area, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    for visit_date in ["2026-05-01", "2026-06-01", "2026-07-01"]:
        client.post(
            f"/api/v1/areas/{area.id}/monitorings",
            json={"visit_date": visit_date},
            headers=auth_headers,
        )

    page_one = client.get(
        f"/api/v1/areas/{area.id}/monitorings?offset=0&limit=2", headers=auth_headers
    ).json()
    assert len(page_one["items"]) == 2
    assert page_one["total"] == 3
    assert [item["visit_date"] for item in page_one["items"]] == ["2026-07-01", "2026-06-01"]

    page_two = client.get(
        f"/api/v1/areas/{area.id}/monitorings?offset=2&limit=2", headers=auth_headers
    ).json()
    assert len(page_two["items"]) == 1
    assert page_two["total"] == 3
    assert page_two["items"][0]["visit_date"] == "2026-05-01"


def test_list_monitorings_invalid_pagination(
    client: TestClient, area: Area, auth_headers: dict
) -> None:
    assert (
        client.get(f"/api/v1/areas/{area.id}/monitorings?limit=0", headers=auth_headers).status_code
        == 422
    )
    assert (
        client.get(
            f"/api/v1/areas/{area.id}/monitorings?limit=101", headers=auth_headers
        ).status_code
        == 422
    )
    assert (
        client.get(
            f"/api/v1/areas/{area.id}/monitorings?offset=-1", headers=auth_headers
        ).status_code
        == 422
    )


def test_get_monitoring(
    client: TestClient, area: Area, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01", "notes": "Primeira visita"},
        headers=auth_headers,
    )
    monitoring_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/monitorings/{monitoring_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["notes"] == "Primeira visita"


def test_get_monitoring_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.get(f"/api/v1/monitorings/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_update_monitoring(
    client: TestClient, area: Area, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01", "seedling_count": 100},
        headers=auth_headers,
    )
    monitoring_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/monitorings/{monitoring_id}",
        json={"seedling_count": 200},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["seedling_count"] == 200
    assert response.json()["visit_date"] == "2026-07-01"


def test_update_monitoring_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.patch(
        f"/api/v1/monitorings/{uuid4()}",
        json={"notes": "Qualquer"},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_delete_monitoring(
    client: TestClient, area: Area, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=auth_headers,
    )
    monitoring_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/monitorings/{monitoring_id}", headers=auth_headers)
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/monitorings/{monitoring_id}", headers=auth_headers)
    assert get_response.status_code == 404


def test_delete_monitoring_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.delete(f"/api/v1/monitorings/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_volunteer_can_create_monitoring(
    client: TestClient,
    area: Area,
    organization: Organization,
    session: Session,
) -> None:
    volunteer = User(
        name="Volunteer", email="volmon@test.com", password_hash=hash_password("secret123")
    )
    session.add(volunteer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=volunteer.id,
            organization_id=organization.id,
            role=UserOrganizationRole.volunteer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "volmon@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=headers,
    )
    assert response.status_code == 200


def test_viewer_cannot_create_monitoring(
    client: TestClient,
    area: Area,
    organization: Organization,
    session: Session,
) -> None:
    viewer = User(
        name="Viewer", email="viewermon@test.com", password_hash=hash_password("secret123")
    )
    session.add(viewer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=viewer.id,
            organization_id=organization.id,
            role=UserOrganizationRole.viewer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "viewermon@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=headers,
    )
    assert response.status_code == 403


def test_volunteer_cannot_update_monitoring(
    client: TestClient,
    area: Area,
    organization: Organization,
    session: Session,
    auth_headers: dict,
) -> None:
    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01", "seedling_count": 100},
        headers=auth_headers,
    )
    monitoring_id = create_resp.json()["id"]

    volunteer = User(
        name="Volunteer 2", email="volmon2@test.com", password_hash=hash_password("secret123")
    )
    session.add(volunteer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=volunteer.id,
            organization_id=organization.id,
            role=UserOrganizationRole.volunteer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "volmon2@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.patch(
        f"/api/v1/monitorings/{monitoring_id}",
        json={"seedling_count": 200},
        headers=headers,
    )
    assert response.status_code == 403


def test_user_cannot_read_other_org_monitoring(
    client: TestClient,
    session: Session,
    area: Area,
    organization: Organization,
    auth_headers: dict,
) -> None:
    other_org = Organization(name="Outra ONG", slug="outra-ong-mon")
    other_user = User(
        name="Other", email="othermon@test.com", password_hash=hash_password("secret123")
    )
    session.add(other_org)
    session.add(other_user)
    session.commit()
    session.add(
        UserOrganization(
            user_id=other_user.id,
            organization_id=other_org.id,
            role=UserOrganizationRole.manager,
        )
    )
    session.commit()

    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=auth_headers,
    )
    monitoring_id = create_resp.json()["id"]

    login = client.post(
        "/api/v1/auth/login", json={"email": "othermon@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get(f"/api/v1/monitorings/{monitoring_id}", headers=headers)
    assert response.status_code == 404

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


def test_create_area_roundtrips_geojson_coordinates(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    polygon = {
        "type": "Polygon",
        "coordinates": [
            [
                [-56.12, -15.62],
                [-56.10, -15.62],
                [-56.10, -15.60],
                [-56.12, -15.60],
                [-56.12, -15.62],
            ]
        ],
    }
    create_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área com geometria", "coordinates": polygon},
        headers=auth_headers,
    )
    assert create_resp.status_code == 200
    area_id = create_resp.json()["id"]
    assert create_resp.json()["coordinates"]["type"] == "Polygon"

    get_resp = client.get(f"/api/v1/areas/{area_id}", headers=auth_headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["coordinates"]["coordinates"] == polygon["coordinates"]

    update_resp = client.patch(
        f"/api/v1/areas/{area_id}",
        json={"coordinates": None},
        headers=auth_headers,
    )
    assert update_resp.status_code == 200
    assert update_resp.json()["coordinates"] is None


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
    assert response.json() == {"items": [], "total": 0, "offset": 0, "limit": 20}


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
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 2


def test_list_areas_pagination(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    for name in ["Área A", "Área B", "Área C"]:
        client.post(
            f"/api/v1/projects/{project.id}/areas",
            json={"name": name},
            headers=auth_headers,
        )

    page_one = client.get(
        f"/api/v1/projects/{project.id}/areas?offset=0&limit=2", headers=auth_headers
    ).json()
    assert len(page_one["items"]) == 2
    assert page_one["total"] == 3

    page_two = client.get(
        f"/api/v1/projects/{project.id}/areas?offset=2&limit=2", headers=auth_headers
    ).json()
    assert len(page_two["items"]) == 1
    assert page_two["total"] == 3


def test_list_areas_total_scoped_to_project(
    client: TestClient,
    session: Session,
    project: Project,
    organization: Organization,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    other_project = Project(name="Projeto 2", organization_id=organization.id)
    session.add(other_project)
    session.commit()

    for name in ["Área A", "Área B", "Área C"]:
        client.post(
            f"/api/v1/projects/{project.id}/areas",
            json={"name": name},
            headers=auth_headers,
        )
    for name in ["Área D", "Área E"]:
        client.post(
            f"/api/v1/projects/{other_project.id}/areas",
            json={"name": name},
            headers=auth_headers,
        )

    page_one = client.get(
        f"/api/v1/projects/{project.id}/areas?offset=0&limit=2", headers=auth_headers
    ).json()
    assert len(page_one["items"]) == 2
    assert page_one["total"] == 3

    beyond_last = client.get(
        f"/api/v1/projects/{project.id}/areas?offset=3&limit=2", headers=auth_headers
    ).json()
    assert beyond_last["items"] == []
    assert beyond_last["total"] == 3


def test_list_areas_invalid_pagination(
    client: TestClient, project: Project, auth_headers: dict
) -> None:
    assert (
        client.get(f"/api/v1/projects/{project.id}/areas?limit=0", headers=auth_headers).status_code
        == 422
    )
    assert (
        client.get(
            f"/api/v1/projects/{project.id}/areas?limit=101", headers=auth_headers
        ).status_code
        == 422
    )
    assert (
        client.get(
            f"/api/v1/projects/{project.id}/areas?offset=-1", headers=auth_headers
        ).status_code
        == 422
    )


def test_list_areas_recent_monitorings_empty(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área sem monitoramentos"},
        headers=auth_headers,
    )
    response = client.get(f"/api/v1/projects/{project.id}/areas", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["items"][0]["recent_monitorings"] == []


def test_list_areas_includes_recent_monitorings_ordered(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    area_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área com monitoramentos"},
        headers=auth_headers,
    )
    area_id = area_resp.json()["id"]

    for visit_date in ("2026-05-01", "2026-08-01", "2026-07-01"):
        client.post(
            f"/api/v1/areas/{area_id}/monitorings",
            json={"visit_date": visit_date},
            headers=auth_headers,
        )

    response = client.get(f"/api/v1/projects/{project.id}/areas", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    recent = data["items"][0]["recent_monitorings"]
    assert len(recent) == 3
    assert [m["visit_date"] for m in recent] == ["2026-08-01", "2026-07-01", "2026-05-01"]
    assert recent[0]["area_id"] == area_id


def test_list_areas_recent_monitorings_limited_to_10(
    client: TestClient, project: Project, auth_headers: dict, manager_membership: UserOrganization
) -> None:
    area_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Área com muitos monitoramentos"},
        headers=auth_headers,
    )
    area_id = area_resp.json()["id"]

    for month in range(1, 13):
        client.post(
            f"/api/v1/areas/{area_id}/monitorings",
            json={"visit_date": f"2026-{month:02d}-01"},
            headers=auth_headers,
        )

    response = client.get(f"/api/v1/projects/{project.id}/areas", headers=auth_headers)
    recent = response.json()["items"][0]["recent_monitorings"]
    assert len(recent) == 10
    assert recent[0]["visit_date"] == "2026-12-01"
    assert recent[-1]["visit_date"] == "2026-03-01"


def test_list_areas_recent_monitorings_scoped_to_org(
    client: TestClient,
    session: Session,
    project: Project,
    organization: Organization,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    other_org = Organization(name="Outra ONG", slug="outra-ong-area-mon")
    other_user = User(
        name="Other", email="otherareamon@test.com", password_hash=hash_password("secret123")
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

    other_project = Project(name="Projeto Outra ONG", organization_id=other_org.id)
    session.add(other_project)
    session.commit()
    other_area = Area(name="Área Outra ONG", project_id=other_project.id)
    session.add(other_area)
    session.commit()

    area_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Minha Área"},
        headers=auth_headers,
    )
    area_id = area_resp.json()["id"]

    client.post(
        f"/api/v1/areas/{area_id}/monitorings",
        json={"visit_date": "2026-07-01"},
        headers=auth_headers,
    )

    other_login = client.post(
        "/api/v1/auth/login", json={"email": "otherareamon@test.com", "password": "secret123"}
    )
    other_headers = {"Authorization": f"Bearer {other_login.json()['access_token']}"}
    client.post(
        f"/api/v1/areas/{other_area.id}/monitorings",
        json={"visit_date": "2026-08-01"},
        headers=other_headers,
    )

    response = client.get(f"/api/v1/projects/{project.id}/areas", headers=auth_headers)
    assert response.status_code == 200
    recent = response.json()["items"][0]["recent_monitorings"]
    assert [m["visit_date"] for m in recent] == ["2026-07-01"]


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
        user_id=researcher.id,
        organization_id=organization.id,
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
            user_id=volunteer.id,
            organization_id=organization.id,
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
            user_id=other_user.id,
            organization_id=other_org.id,
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
            user_id=other_user.id,
            organization_id=other_org.id,
            role=UserOrganizationRole.manager,
        )
    )
    session.commit()

    other_headers = _login_headers(client, "otherarea2@test.com")
    response = client.post(
        f"/api/v1/projects/{project.id}/areas", json={"name": "Área X"}, headers=other_headers
    )
    assert response.status_code == 403

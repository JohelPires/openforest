from datetime import date
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

from openforest.api.config import settings
from openforest.api.models.area import Area
from openforest.api.models.organization import Organization
from openforest.api.models.project import Project

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
def area(session, project):
    a = Area(name="Área Teste", project_id=project.id)
    session.add(a)
    session.commit()
    return a


def test_create_monitoring(client: TestClient, area: Area) -> None:
    response = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={
            "visit_date": "2026-07-01",
            "seedling_count": 150,
            "avg_height": 1.5,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["visit_date"] == "2026-07-01"
    assert data["seedling_count"] == 150
    assert data["avg_height"] == 1.5
    assert data["area_id"] == str(area.id)
    assert "id" in data


def test_create_monitoring_invalid_area(client: TestClient) -> None:
    response = client.post(
        f"/api/v1/areas/{uuid4()}/monitorings",
        json={"visit_date": "2026-07-01"},
    )
    assert response.status_code == 422
    data = response.json()
    assert any("não encontrada" in item["msg"] for item in data["detail"])


def test_list_monitorings_empty(client: TestClient, area: Area) -> None:
    response = client.get(f"/api/v1/areas/{area.id}/monitorings")
    assert response.status_code == 200
    assert response.json() == []


def test_list_monitorings_by_area(client: TestClient, area: Area) -> None:
    client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
    )
    client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-08-01"},
    )
    response = client.get(f"/api/v1/areas/{area.id}/monitorings")
    assert len(response.json()) == 2


def test_list_monitorings_scoped_to_area(
    client: TestClient, area: Area, project: Project
) -> None:
    other_area_resp = client.post(
        f"/api/v1/projects/{project.id}/areas",
        json={"name": "Outra Área"},
    )
    other_area_id = other_area_resp.json()["id"]

    client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
    )
    client.post(
        f"/api/v1/areas/{other_area_id}/monitorings",
        json={"visit_date": "2026-08-01"},
    )

    response = client.get(f"/api/v1/areas/{area.id}/monitorings")
    assert len(response.json()) == 1
    assert response.json()[0]["visit_date"] == "2026-07-01"


def test_get_monitoring(client: TestClient, area: Area) -> None:
    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01", "notes": "Primeira visita"},
    )
    monitoring_id = create_resp.json()["id"]

    response = client.get(f"/api/v1/monitorings/{monitoring_id}")
    assert response.status_code == 200
    assert response.json()["notes"] == "Primeira visita"


def test_get_monitoring_not_found(client: TestClient) -> None:
    response = client.get(f"/api/v1/monitorings/{uuid4()}")
    assert response.status_code == 404


def test_update_monitoring(client: TestClient, area: Area) -> None:
    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01", "seedling_count": 100},
    )
    monitoring_id = create_resp.json()["id"]

    response = client.patch(
        f"/api/v1/monitorings/{monitoring_id}",
        json={"seedling_count": 200},
    )
    assert response.status_code == 200
    assert response.json()["seedling_count"] == 200
    assert response.json()["visit_date"] == "2026-07-01"


def test_update_monitoring_not_found(client: TestClient) -> None:
    response = client.patch(
        f"/api/v1/monitorings/{uuid4()}",
        json={"notes": "Qualquer"},
    )
    assert response.status_code == 404


def test_delete_monitoring(client: TestClient, area: Area) -> None:
    create_resp = client.post(
        f"/api/v1/areas/{area.id}/monitorings",
        json={"visit_date": "2026-07-01"},
    )
    monitoring_id = create_resp.json()["id"]

    response = client.delete(f"/api/v1/monitorings/{monitoring_id}")
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/monitorings/{monitoring_id}")
    assert get_response.status_code == 404


def test_delete_monitoring_not_found(client: TestClient) -> None:
    response = client.delete(f"/api/v1/monitorings/{uuid4()}")
    assert response.status_code == 404

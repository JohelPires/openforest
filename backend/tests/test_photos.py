from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine, text

from openforest.api.config import settings
from openforest.api.models.area import Area
from openforest.api.models.monitoring import Monitoring
from openforest.api.models.organization import Organization
from openforest.api.models.photo import Photo
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


@pytest.fixture(autouse=True)
def local_storage(tmp_path):
    original_backend = settings.storage_backend
    original_path = settings.storage_path
    settings.storage_backend = "local"
    settings.storage_path = str(tmp_path)
    yield
    settings.storage_backend = original_backend
    settings.storage_path = original_path


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
def monitoring(session, area):
    m = Monitoring(area_id=area.id, visit_date="2026-07-01")
    session.add(m)
    session.commit()
    return m


@pytest.fixture
def user(session):
    u = User(name="Test User", email="test@test.com", password_hash=hash_password("secret123"))
    session.add(u)
    session.commit()
    return u


@pytest.fixture
def other_user(session):
    u = User(name="Other User", email="other@test.com", password_hash=hash_password("secret123"))
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
def auth_headers(client, manager_membership):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "test@test.com", "password": "secret123"},
    )
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_upload_photo(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    response = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["monitoring_id"] == str(monitoring.id)
    assert data["original_filename"] == "foto.jpg"
    assert data["mime_type"] == "image/jpeg"
    assert data["file_size"] == len(b"fake-image-bytes")
    assert data["file_path"].startswith(f"photos/{monitoring.id}/")
    assert Path(settings.storage_path, data["file_path"]).exists()


def test_upload_photo_unauthorized(client: TestClient, monitoring: Monitoring) -> None:
    response = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
    )
    assert response.status_code == 401


def test_upload_photo_invalid_monitoring(client: TestClient, auth_headers: dict) -> None:
    response = client.post(
        f"/api/v1/monitorings/{uuid4()}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert any(item["type"] == "not_found" for item in response.json()["detail"])


def test_upload_photo_forbidden(
    client: TestClient, monitoring: Monitoring, other_user: User
) -> None:
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "other@test.com", "password": "secret123"},
    )
    headers = {"Authorization": f"Bearer {response.json()['access_token']}"}
    response = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 403


def test_upload_photo_not_image(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    response = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("nota.txt", b"hello", "text/plain")},
        headers=auth_headers,
    )
    assert response.status_code == 422
    assert any(item["type"] == "validation_error" for item in response.json()["detail"])


def test_upload_photo_too_large(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    original_limit = settings.max_upload_size_mb
    settings.max_upload_size_mb = 0
    try:
        response = client.post(
            f"/api/v1/monitorings/{monitoring.id}/photos",
            files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
            headers=auth_headers,
        )
    finally:
        settings.max_upload_size_mb = original_limit
    assert response.status_code == 422
    assert any(item["type"] == "validation_error" for item in response.json()["detail"])


def test_get_photo(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload_resp.json()["id"]

    response = client.get(f"/api/v1/photos/{photo_id}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["id"] == photo_id


def test_get_photo_not_found(client: TestClient, auth_headers: dict) -> None:
    response = client.get(f"/api/v1/photos/{uuid4()}", headers=auth_headers)
    assert response.status_code == 404


def test_download_photo(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload_resp.json()["id"]

    response = client.get(f"/api/v1/photos/{photo_id}/download", headers=auth_headers)
    assert response.status_code == 200
    assert response.content == b"fake-image-bytes"
    assert response.headers["content-type"].startswith("image/jpeg")
    assert 'filename="foto.jpg"' in response.headers["content-disposition"]


def test_delete_photo(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo = upload_resp.json()
    photo_path = Path(settings.storage_path, photo["file_path"])

    response = client.delete(f"/api/v1/photos/{photo['id']}", headers=auth_headers)
    assert response.status_code == 200

    get_response = client.get(f"/api/v1/photos/{photo['id']}", headers=auth_headers)
    assert get_response.status_code == 404
    assert not photo_path.exists()


def test_delete_photo_forbidden(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
    other_user: User,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload_resp.json()["id"]

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "other@test.com", "password": "secret123"},
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    response = client.delete(f"/api/v1/photos/{photo_id}", headers=headers)
    assert response.status_code == 403


def test_volunteer_can_upload_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
) -> None:
    volunteer = User(
        name="Volunteer", email="volphoto@test.com", password_hash=hash_password("secret123")
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
        "/api/v1/auth/login", json={"email": "volphoto@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 200


def test_viewer_cannot_upload_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
) -> None:
    viewer = User(
        name="Viewer", email="viewerphoto@test.com", password_hash=hash_password("secret123")
    )
    session.add(viewer)
    session.commit()
    session.add(
        UserOrganization(
            user_id=viewer.id, organization_id=organization.id,
            role=UserOrganizationRole.viewer,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "viewerphoto@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=headers,
    )
    assert response.status_code == 403


def test_volunteer_cannot_delete_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
    auth_headers: dict,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload_resp.json()["id"]

    volunteer = User(
        name="Volunteer 2", email="volphoto2@test.com", password_hash=hash_password("secret123")
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
        "/api/v1/auth/login", json={"email": "volphoto2@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.delete(f"/api/v1/photos/{photo_id}", headers=headers)
    assert response.status_code == 403


def test_researcher_can_delete_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
    auth_headers: dict,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload_resp.json()["id"]

    researcher = User(
        name="Researcher", email="resphoto@test.com", password_hash=hash_password("secret123")
    )
    session.add(researcher)
    session.commit()
    session.add(
        UserOrganization(
            user_id=researcher.id, organization_id=organization.id,
            role=UserOrganizationRole.researcher,
        )
    )
    session.commit()

    login = client.post(
        "/api/v1/auth/login", json={"email": "resphoto@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.delete(f"/api/v1/photos/{photo_id}", headers=headers)
    assert response.status_code == 200


def test_user_cannot_read_other_org_photo(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
    auth_headers: dict,
) -> None:
    upload_resp = client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )
    photo_id = upload_resp.json()["id"]

    other_org = Organization(name="Outra ONG", slug="outra-ong-photo")
    other_user = User(
        name="Other", email="otherphoto@test.com", password_hash=hash_password("secret123")
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

    login = client.post(
        "/api/v1/auth/login", json={"email": "otherphoto@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get(f"/api/v1/photos/{photo_id}", headers=headers)
    assert response.status_code == 404


def test_list_photos(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
) -> None:
    for name in ("foto.jpg", "foto2.jpg"):
        client.post(
            f"/api/v1/monitorings/{monitoring.id}/photos",
            files={"file": (name, b"fake-image-bytes", "image/jpeg")},
            headers=auth_headers,
        )

    response = client.get(f"/api/v1/monitorings/{monitoring.id}/photos", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["offset"] == 0
    assert data["limit"] == 20
    assert len(data["items"]) == 2
    for item in data["items"]:
        assert item["monitoring_id"] == str(monitoring.id)
        assert item["url"] == f"/api/v1/photos/{item['id']}/download"


def test_list_photos_ordered_and_paginated(
    client: TestClient,
    monitoring: Monitoring,
    auth_headers: dict,
    manager_membership: UserOrganization,
    session: Session,
) -> None:
    base = datetime.now(timezone.utc)
    for i in range(3):
        session.add(
            Photo(
                monitoring_id=monitoring.id,
                file_path=f"photos/{monitoring.id}/{i}.jpg",
                original_filename=f"foto{i}.jpg",
                mime_type="image/jpeg",
                file_size=10,
                created_at=base - timedelta(minutes=i),
            )
        )
    session.commit()

    response = client.get(
        f"/api/v1/monitorings/{monitoring.id}/photos?offset=1&limit=2",
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 3
    assert data["offset"] == 1
    assert data["limit"] == 2
    assert len(data["items"]) == 2
    assert [p["original_filename"] for p in data["items"]] == ["foto1.jpg", "foto2.jpg"]


def test_list_photos_empty(client: TestClient, monitoring: Monitoring, auth_headers: dict) -> None:
    response = client.get(f"/api/v1/monitorings/{monitoring.id}/photos", headers=auth_headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []


def test_list_photos_other_org_scoped(
    client: TestClient,
    monitoring: Monitoring,
    organization: Organization,
    session: Session,
    auth_headers: dict,
) -> None:
    client.post(
        f"/api/v1/monitorings/{monitoring.id}/photos",
        files={"file": ("foto.jpg", b"fake-image-bytes", "image/jpeg")},
        headers=auth_headers,
    )

    other_org = Organization(name="Outra ONG", slug="outra-ong-list")
    other_user = User(
        name="Other", email="otherlist@test.com", password_hash=hash_password("secret123")
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

    login = client.post(
        "/api/v1/auth/login", json={"email": "otherlist@test.com", "password": "secret123"}
    )
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    response = client.get(f"/api/v1/monitorings/{monitoring.id}/photos", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["items"] == []

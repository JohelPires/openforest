import pytest

from openforest.api.config import settings
from openforest.api.infrastructure.storage import delete_photo_prefix, get_presigned_url


class FakeS3Client:
    def __init__(self, pages: list[dict] | None = None) -> None:
        self._pages = pages or []
        self.generate_presigned_url_calls: list[tuple] = []
        self.deleted: dict[str, list[str]] = {"keys": []}
        self.delete_objects_calls: list[int] = []
        self.put_object_calls: list[dict] = []
        self.list_objects_v2_calls: list[dict] = []

    def generate_presigned_url(
        self, ClientMethod: str, Params: dict, ExpiresIn: int = 3600, HttpMethod: str | None = None  # noqa: N803
    ) -> str:
        self.generate_presigned_url_calls.append((ClientMethod, Params, ExpiresIn))
        return f"https://minio.example/{Params['Key']}?x-id=GetObject&expires={ExpiresIn}"

    def list_objects_v2(self, **kwargs: object) -> dict:
        self.list_objects_v2_calls.append(kwargs)
        if self._pages:
            return self._pages.pop(0)
        return {"Contents": [], "IsTruncated": False}

    def delete_objects(self, *, Bucket: object = None, Delete: object = None) -> None:  # noqa: N803
        objects = Delete["Objects"]
        self.delete_objects_calls.append(len(objects))
        for obj in objects:
            self.deleted["keys"].append(obj["Key"])

    def put_object(self, **kwargs: object) -> None:
        self.put_object_calls.append(kwargs)


@pytest.fixture
def fake_s3(monkeypatch) -> FakeS3Client:
    original = settings.storage_backend
    settings.storage_backend = "s3"
    client = FakeS3Client()
    monkeypatch.setattr("openforest.api.infrastructure.storage._s3_client", lambda: client)
    yield client
    settings.storage_backend = original


def test_get_presigned_url(fake_s3: FakeS3Client) -> None:
    url = get_presigned_url("photos/abc/1.jpg")
    assert url == "https://minio.example/photos/abc/1.jpg?x-id=GetObject&expires=3600"
    method, params, expires_in = fake_s3.generate_presigned_url_calls[0]
    assert method == "get_object"
    assert params == {"Bucket": settings.s3_bucket, "Key": "photos/abc/1.jpg"}
    assert expires_in == settings.presigned_url_expire_seconds


def test_get_presigned_url_custom_expiry(fake_s3: FakeS3Client) -> None:
    get_presigned_url("photos/abc/1.jpg", expires_in=120)
    assert fake_s3.generate_presigned_url_calls[0][2] == 120


def test_get_presigned_url_requires_s3(monkeypatch) -> None:
    monkeypatch.setattr(settings, "storage_backend", "local")
    with pytest.raises(RuntimeError):
        get_presigned_url("photos/abc/1.jpg")


def test_delete_photo_prefix(fake_s3: FakeS3Client) -> None:
    fake_s3._pages = [
        {
            "Contents": [{"Key": "photos/a/1.jpg"}, {"Key": "photos/b/2.jpg"}],
            "IsTruncated": False,
        }
    ]
    delete_photo_prefix("photos/")
    assert sorted(fake_s3.deleted["keys"]) == ["photos/a/1.jpg", "photos/b/2.jpg"]


def test_delete_photo_prefix_paginates(fake_s3: FakeS3Client) -> None:
    fake_s3._pages = [
        {
            "Contents": [{"Key": "photos/a/1.jpg"}],
            "IsTruncated": True,
            "NextContinuationToken": "tok",
        },
        {"Contents": [{"Key": "photos/b/2.jpg"}], "IsTruncated": False},
    ]
    delete_photo_prefix("photos/")
    assert sorted(fake_s3.deleted["keys"]) == ["photos/a/1.jpg", "photos/b/2.jpg"]
    assert fake_s3.list_objects_v2_calls[1]["ContinuationToken"] == "tok"


def test_delete_photo_prefix_batches_over_1000_keys(fake_s3: FakeS3Client) -> None:
    keys = [f"photos/{i}.jpg" for i in range(1001)]
    fake_s3._pages = [
        {
            "Contents": [{"Key": key} for key in keys[:1000]],
            "IsTruncated": True,
            "NextContinuationToken": "tok",
        },
        {"Contents": [{"Key": keys[1000]}], "IsTruncated": False},
    ]
    delete_photo_prefix("photos/")
    assert sorted(fake_s3.deleted["keys"]) == sorted(keys)
    assert all(size <= 1000 for size in fake_s3.delete_objects_calls)

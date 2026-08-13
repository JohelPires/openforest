from openforest.api.config import Settings


def test_presigned_url_expire_default() -> None:
    assert Settings(_env_file=None).presigned_url_expire_seconds == 3600


def test_minio_env_aliases(monkeypatch) -> None:
    monkeypatch.setenv("MINIO_ENDPOINT", "http://localhost:9000")
    monkeypatch.setenv("MINIO_ACCESS_KEY", "access")
    monkeypatch.setenv("MINIO_SECRET_KEY", "secret")
    monkeypatch.setenv("MINIO_BUCKET", "openforest")
    s = Settings(_env_file=None)
    assert s.s3_endpoint_url == "http://localhost:9000"
    assert s.s3_access_key == "access"
    assert s.s3_secret_key == "secret"
    assert s.s3_bucket == "openforest"


def test_s3_env_names(monkeypatch) -> None:
    monkeypatch.setenv("S3_ENDPOINT_URL", "http://s3:9000")
    monkeypatch.setenv("S3_ACCESS_KEY", "a")
    s = Settings(_env_file=None)
    assert s.s3_endpoint_url == "http://s3:9000"
    assert s.s3_access_key == "a"

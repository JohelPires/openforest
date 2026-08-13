from pathlib import Path
from typing import Any, cast
from uuid import UUID, uuid4

from openforest.api.config import settings


def _build_key(original_filename: str, monitoring_id: UUID) -> str:
    ext = Path(original_filename).suffix.lower() if original_filename else ".bin"
    if len(ext) > 10 or not ext.startswith("."):
        ext = ".bin"
    return f"photos/{monitoring_id}/{uuid4()}{ext}"


def _local_root() -> Path:
    return Path(settings.storage_path)


def _s3_client() -> Any:
    import boto3

    kwargs: dict[str, Any] = {}
    if settings.s3_endpoint_url:
        kwargs["endpoint_url"] = settings.s3_endpoint_url
    return boto3.client(
        "s3",
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key or None,
        aws_secret_access_key=settings.s3_secret_key or None,
        **kwargs,
    )


def save_upload(
    file_bytes: bytes,
    original_filename: str,
    mime_type: str | None,
    monitoring_id: UUID,
) -> str:
    key = _build_key(original_filename, monitoring_id)
    if settings.storage_backend == "s3":
        _s3_client().put_object(
            Bucket=settings.s3_bucket,
            Key=key,
            Body=file_bytes,
            ContentType=mime_type or "application/octet-stream",
        )
    else:
        filepath = _local_root() / key
        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_bytes(file_bytes)
    return key


def delete_file(file_path: str) -> None:
    if settings.storage_backend == "s3":
        _s3_client().delete_object(Bucket=settings.s3_bucket, Key=file_path)
        return
    _local_root().joinpath(file_path).unlink(missing_ok=True)


def read_file(file_path: str) -> bytes:
    if settings.storage_backend == "s3":
        response = _s3_client().get_object(Bucket=settings.s3_bucket, Key=file_path)
        return cast(bytes, response["Body"].read())
    return _local_root().joinpath(file_path).read_bytes()


def get_presigned_url(file_path: str, expires_in: int | None = None) -> str:
    if settings.storage_backend != "s3":
        raise RuntimeError("presigned URLs requerem storage_backend='s3'")
    return cast(
        str,
        _s3_client().generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket, "Key": file_path},
            ExpiresIn=expires_in or settings.presigned_url_expire_seconds,
        ),
    )


def delete_photo_prefix(prefix: str) -> None:
    client = _s3_client()
    keys: list[str] = []
    token: str | None = None
    while True:
        kwargs: dict[str, object] = {"Bucket": settings.s3_bucket, "Prefix": prefix}
        if token:
            kwargs["ContinuationToken"] = token
        page = client.list_objects_v2(**kwargs)
        keys.extend(entry["Key"] for entry in page.get("Contents", []))
        if not page.get("IsTruncated"):
            break
        token = page.get("NextContinuationToken")
    for i in range(0, len(keys), 1000):
        batch = keys[i : i + 1000]
        client.delete_objects(
            Bucket=settings.s3_bucket,
            Delete={"Objects": [{"Key": key} for key in batch]},
        )

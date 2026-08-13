from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost:5432/openforest"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    algorithm: str = "HS256"
    storage_backend: str = "local"
    storage_path: str = "./uploads"
    s3_endpoint_url: str | None = Field(
        default=None, validation_alias=AliasChoices("S3_ENDPOINT_URL", "MINIO_ENDPOINT")
    )
    s3_bucket: str = Field(
        default="openforest", validation_alias=AliasChoices("S3_BUCKET", "MINIO_BUCKET")
    )
    s3_access_key: str = Field(
        default="", validation_alias=AliasChoices("S3_ACCESS_KEY", "MINIO_ACCESS_KEY")
    )
    s3_secret_key: str = Field(
        default="", validation_alias=AliasChoices("S3_SECRET_KEY", "MINIO_SECRET_KEY")
    )
    s3_region: str = "us-east-1"
    presigned_url_expire_seconds: int = 3600
    max_upload_size_mb: int = 10

    model_config = {"env_file": ".env"}


settings = Settings()

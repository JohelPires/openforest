from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://localhost:5432/openforest"
    redis_url: str = "redis://localhost:6379/0"
    secret_key: str = "change-me"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 7
    storage_backend: str = "local"
    storage_path: str = "./uploads"

    model_config = {"env_file": ".env"}


settings = Settings()

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # App
    APP_NAME: str = "Compliance App API"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/compliance_db"

    # JWT
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # S3 / Object Storage
    S3_BUCKET_NAME: str = "compliance-documents"
    S3_REGION: str = "af-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""

    # Push Notifications
    FCM_SERVER_KEY: str = ""

    # CORS
    ALLOWED_ORIGINS: list[str] = ["http://localhost:8081", "exp://localhost:8081"]


@lru_cache
def get_settings() -> Settings:
    return Settings()

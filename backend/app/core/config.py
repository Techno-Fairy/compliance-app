# backend/app/core/config.py

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    # ── App ───────────────────────────────────────────────────────────────────
    APP_NAME: str = "Compliance App API"
    DEBUG: bool = False

    # ── Database ──────────────────────────────────────────────────────────────
    DATABASE_URL: str = "postgresql+psycopg://postgres:postgres@localhost:5432/compliance_db"

    # ── JWT ───────────────────────────────────────────────────────────────────
    SECRET_KEY: str = "change-me-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30

    # ── S3 / Object Storage ───────────────────────────────────────────────────
    S3_BUCKET_NAME: str = "compliance-documents"
    S3_REGION: str = "af-south-1"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    S3_ENDPOINT_URL: str = ""
    USE_LOCAL_STORAGE: bool = False

    # ── Push Notifications ────────────────────────────────────────────────────
    FCM_SERVER_KEY: str = ""

    # ── CORS ──────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: list[str] = ["http://localhost:8081", "exp://localhost:8081"]

    # ── Email / SMTP ──────────────────────────────────────────────────────────
    # Leave SMTP_HOST empty to disable email (invites still work, token returned in API response).
    #
    # Gmail App Password (recommended for dev/small prod):
    #   SMTP_HOST=smtp.gmail.com
    #   SMTP_PORT=465
    #   SMTP_USE_SSL=true
    #   SMTP_USERNAME=youraddress@gmail.com
    #   SMTP_PASSWORD=<16-char App Password from myaccount.google.com/apppasswords>
    #   SMTP_FROM_EMAIL=youraddress@gmail.com
    #
    # SendGrid (recommended for production volume):
    #   SMTP_HOST=smtp.sendgrid.net
    #   SMTP_PORT=587
    #   SMTP_USE_SSL=false
    #   SMTP_USERNAME=apikey
    #   SMTP_PASSWORD=<SendGrid API key>
    #   SMTP_FROM_EMAIL=noreply@yourdomain.com
    #
    # Office 365 / Outlook:
    #   SMTP_HOST=smtp.office365.com
    #   SMTP_PORT=587
    #   SMTP_USE_SSL=false
    #   SMTP_USERNAME=youraddress@outlook.com
    #   SMTP_PASSWORD=<your password>
    #   SMTP_FROM_EMAIL=youraddress@outlook.com

    SMTP_HOST:       str  = ""
    SMTP_PORT:       int  = 465
    SMTP_USE_SSL:    bool = True   # True = port 465 SSL; False = port 587 STARTTLS
    SMTP_USERNAME:   str  = ""
    SMTP_PASSWORD:   str  = ""
    SMTP_FROM_EMAIL: str  = "noreply@compliancepro.co.bw"

    # ── Deep links / Frontend ─────────────────────────────────────────────────
    APP_DEEP_LINK_SCHEME: str = "compliancepro"           # compliancepro://team/accept/<token>
    FRONTEND_URL:         str = "https://compliancepro.co.bw"  # fallback web link in emails


@lru_cache
def get_settings() -> Settings:
    return Settings()
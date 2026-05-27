from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.models import (  # noqa: F401
    business,
    deadline,
    document,
    history,  # noqa: F401
    user,
)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version="0.3.0",
    description=(
        "CompliancePro Botswana — Business Compliance Intelligence Platform. "
        "Week 3: Evidence Locker, Penalty Engine, Filing History."
    ),
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/v1")

# Local dev: serve uploaded files at /dev/files/<s3_key>
# Only active when USE_LOCAL_STORAGE=true — never runs in prod.
if settings.USE_LOCAL_STORAGE:
    _upload_dir = Path("local_uploads")
    _upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/dev/files", StaticFiles(directory=str(_upload_dir)), name="dev_files")


@app.get("/health")
def health():
    return {"status": "ok", "version": "0.3.0"}
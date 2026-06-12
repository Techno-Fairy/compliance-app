# api/index.py
#
# Vercel serverless entry point.
# Vercel looks for a handler in api/index.py — this file wraps the
# existing FastAPI app with Mangum so it runs as an ASGI Lambda/serverless handler.
#
# Place this file at:  backend/api/index.py
# (i.e., create an `api/` folder inside the backend directory)

import sys
import os

# Ensure the backend app package is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.models import (  # noqa: F401 — imports trigger SQLAlchemy model registration
    business,
    deadline,
    document,
    history,
    knowledge,
    user,
)

settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    version="0.4.0",
    description=(
        "CompliancePro Botswana — Business Compliance Intelligence Platform."
    ),
    # Keep docs accessible on Vercel for now; set DEBUG=false to disable in prod
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

# NOTE: Local file serving (USE_LOCAL_STORAGE) is intentionally disabled on Vercel.
# Vercel's filesystem is read-only except /tmp. All file storage must go through S3.

@app.get("/health")
def health():
    return {"status": "ok", "version": "0.4.0", "env": "vercel"}


# ── Mangum adapter ────────────────────────────────────────────────────────────
# Mangum translates AWS Lambda / Vercel serverless events into ASGI requests.
# lifespan="off" disables startup/shutdown events which don't apply in serverless.
handler = Mangum(app, lifespan="off")
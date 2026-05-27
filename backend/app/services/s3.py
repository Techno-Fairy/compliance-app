"""
S3 / object-storage service for the Evidence Locker.

All document uploads are stored under:
    compliance-documents/{business_id}/{uuid}.{ext}

Pre-signed URLs expire after 15 minutes (900 seconds).

DEV MODE
--------
Set USE_LOCAL_STORAGE=true in your .env to bypass S3 entirely and
store files under ./local_uploads/.  Pre-signed URLs become plain
/dev/files/{s3_key} paths served by a static mount in main.py.
This lets the upload flow work in development without any cloud
credentials.
"""
import os
import uuid
from pathlib import Path
from typing import IO

from fastapi import HTTPException, status

from app.core.config import get_settings

PRESIGNED_URL_EXPIRY_SECONDS = 900  # 15 minutes

ALLOWED_MIME_TYPES: set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB

# Local dev uploads land here (relative to wherever uvicorn is started)
LOCAL_UPLOAD_DIR = Path("local_uploads")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _use_local() -> bool:
    return get_settings().USE_LOCAL_STORAGE


def _get_s3_client():
    """
    Build a boto3 S3 client from application settings.
    Raises HTTPException 503 if credentials are not configured.
    """
    settings = get_settings()
    if not settings.AWS_ACCESS_KEY_ID or not settings.AWS_SECRET_ACCESS_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "S3_NOT_CONFIGURED",
                "message": (
                    "Document storage is not configured. "
                    "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY "
                    "(or USE_LOCAL_STORAGE=true for local dev)."
                ),
            },
        )

    import boto3

    kwargs: dict = dict(
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )

    # Support Supabase Storage / Cloudflare R2 / MinIO via optional endpoint
    endpoint = getattr(settings, "S3_ENDPOINT_URL", None)
    if endpoint:
        kwargs["endpoint_url"] = endpoint

    return boto3.client("s3", **kwargs)


def build_s3_key(business_id: int, filename: str) -> str:
    """
    Generate a unique S3 object key.
    Format: compliance-documents/{business_id}/{uuid}.{ext}
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    unique_id = uuid.uuid4().hex
    return f"compliance-documents/{business_id}/{unique_id}.{ext}"


# ── Core operations ───────────────────────────────────────────────────────────

def upload_file(
    file_obj: IO[bytes],
    s3_key: str,
    mime_type: str,
    content_length: int,  # kept in signature for compatibility; not passed to boto3
) -> None:
    """
    Upload a file to S3 (or local disk in dev mode).

    NOTE: content_length must NOT be passed inside ExtraArgs to
    upload_fileobj — boto3 rejects it there.  Size validation happens
    before this call in the endpoint.
    """
    if _use_local():
        _local_upload(file_obj, s3_key)
        return

    settings = get_settings()
    client = _get_s3_client()
    try:
        from botocore.exceptions import BotoCoreError, ClientError
        client.upload_fileobj(
            file_obj,
            settings.S3_BUCKET_NAME,
            s3_key,
            ExtraArgs={
                "ContentType": mime_type,
                "ServerSideEncryption": "AES256",
                # ContentLength is intentionally excluded — upload_fileobj
                # streams the file and boto3 sets the header internally.
            },
        )
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "S3_UPLOAD_FAILED",
                "message": f"Document upload failed: {exc}",
            },
        ) from exc


def generate_presigned_url(s3_key: str) -> str:
    """
    Generate a pre-signed GET URL for a stored document (15-min expiry).
    In local dev mode, returns a /dev/files/{s3_key} path instead.
    """
    if _use_local():
        return f"/dev/files/{s3_key}"

    settings = get_settings()
    client = _get_s3_client()
    try:
        from botocore.exceptions import BotoCoreError, ClientError
        url: str = client.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.S3_BUCKET_NAME, "Key": s3_key},
            ExpiresIn=PRESIGNED_URL_EXPIRY_SECONDS,
        )
        return url
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "S3_URL_FAILED",
                "message": f"Could not generate download URL: {exc}",
            },
        ) from exc


def delete_object(s3_key: str) -> None:
    """
    Delete an object from S3 (or local disk in dev mode).
    S3 delete_object is idempotent — no error if the key does not exist.
    """
    if _use_local():
        _local_delete(s3_key)
        return

    settings = get_settings()
    client = _get_s3_client()
    try:
        from botocore.exceptions import BotoCoreError, ClientError
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "S3_DELETE_FAILED",
                "message": f"Could not delete document: {exc}",
            },
        ) from exc


# ── Local dev helpers ─────────────────────────────────────────────────────────

def _local_path(s3_key: str) -> Path:
    """Translate an S3 key to a local filesystem path."""
    return LOCAL_UPLOAD_DIR / s3_key


def _local_upload(file_obj: IO[bytes], s3_key: str) -> None:
    dest = _local_path(s3_key)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(file_obj.read())


def _local_delete(s3_key: str) -> None:
    path = _local_path(s3_key)
    if path.exists():
        path.unlink()


def fetch_bytes(s3_key: str) -> bytes:
    """
    Fetch the raw bytes of a stored object.

    Used by the evidence pack service to read uploaded documents before
    merging them into a single PDF.  Works transparently in both local
    dev (reads from local_uploads/) and S3 prod environments.

    Raises:
        HTTPException 404  — key does not exist in local storage.
        HTTPException 503  — S3 / boto3 error.
    """
    if _use_local():
        path = _local_path(s3_key)
        if not path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "code": "NOT_FOUND",
                    "message": f"File not found in local storage: {s3_key}",
                },
            )
        return path.read_bytes()

    settings = get_settings()
    client = _get_s3_client()
    try:
        from botocore.exceptions import BotoCoreError, ClientError

        resp = client.get_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
        return resp["Body"].read()
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "S3_FETCH_FAILED",
                "message": f"Could not fetch document from storage: {exc}",
            },
        ) from exc
"""
S3 / object-storage service for the Evidence Locker.

All document uploads are stored under:
    compliance-documents/{business_id}/{uuid}.{ext}

Pre-signed URLs expire after 15 minutes (900 seconds) to prevent
long-lived sharing of potentially sensitive compliance documents.

The service is designed to work with any S3-compatible store (AWS S3,
MinIO, Cloudflare R2) by reading credentials from Settings. If no
credentials are configured (e.g. local dev), operations gracefully
raise a clear error rather than silently failing.
"""
import uuid
from typing import IO

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, status

from app.core.config import get_settings

PRESIGNED_URL_EXPIRY_SECONDS = 900  # 15 minutes

# MIME types accepted for document uploads
ALLOWED_MIME_TYPES: set[str] = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


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
                    "Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY."
                ),
            },
        )
    return boto3.client(
        "s3",
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )


def build_s3_key(business_id: int, filename: str) -> str:
    """
    Generate a unique S3 object key.

    Format: compliance-documents/{business_id}/{uuid}.{ext}
    The UUID prevents filename collisions and ensures objects can be
    accessed by key without exposing the original filename publicly.
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    unique_id = uuid.uuid4().hex
    return f"compliance-documents/{business_id}/{unique_id}.{ext}"


def upload_file(
    file_obj: IO[bytes],
    s3_key: str,
    mime_type: str,
    content_length: int,
) -> None:
    """
    Upload a file to S3.

    Args:
        file_obj:       File-like object (UploadFile.file).
        s3_key:         Destination object key (from build_s3_key).
        mime_type:      MIME type for the Content-Type header.
        content_length: File size in bytes (validated before calling this).

    Raises:
        HTTPException 503 if the S3 upload fails.
    """
    settings = get_settings()
    client = _get_s3_client()
    try:
        client.upload_fileobj(
            file_obj,
            settings.S3_BUCKET_NAME,
            s3_key,
            ExtraArgs={
                "ContentType": mime_type,
                "ContentLength": content_length,
                # Server-side encryption — use AES256 for all uploads
                "ServerSideEncryption": "AES256",
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
    Generate a pre-signed GET URL for a stored document.

    The URL expires after PRESIGNED_URL_EXPIRY_SECONDS (15 minutes).
    Clients should re-request the URL when it expires rather than caching it.

    Raises:
        HTTPException 503 if URL generation fails.
    """
    settings = get_settings()
    client = _get_s3_client()
    try:
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
    Delete an object from S3.

    S3 delete_object is idempotent — no error if the key does not exist.
    Raises:
        HTTPException 503 if deletion fails for any other reason.
    """
    settings = get_settings()
    client = _get_s3_client()
    try:
        client.delete_object(Bucket=settings.S3_BUCKET_NAME, Key=s3_key)
    except (BotoCoreError, ClientError) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "S3_DELETE_FAILED",
                "message": f"Could not delete document: {exc}",
            },
        ) from exc
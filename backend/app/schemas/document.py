"""
Pydantic schemas for the Evidence Locker (Document Vault).
"""
from datetime import date, datetime

from pydantic import BaseModel, Field


class DocumentResponse(BaseModel):
    id: int
    business_id: int
    deadline_id: int | None
    filename: str
    mime_type: str
    file_size_bytes: int
    category: str
    expiry_date: date | None
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DocumentUploadResponse(DocumentResponse):
    """
    Returned immediately after a successful upload.
    Includes a short-lived pre-signed URL so the client can display
    or download the file without an extra round-trip.
    """
    download_url: str
    download_url_expires_in_seconds: int = 900  # 15 minutes


class PresignedDownloadResponse(BaseModel):
    download_url: str
    expires_in_seconds: int = 900
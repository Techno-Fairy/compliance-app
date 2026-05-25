"""
Evidence Locker — Document Vault endpoints.

Week 3 deliverables:
  BE-10  POST /documents  — upload to S3 with MIME/size validation
         GET  /documents  — list all documents for the business
         DELETE /documents/{id} — delete from DB + S3
  BE-11  GET /documents/{id} — return a fresh pre-signed download URL

All endpoints are scoped to the authenticated user's business profile.
Documents are stored in S3 under:
    compliance-documents/{business_id}/{uuid}.{ext}

Pre-signed download URLs expire after 15 minutes (900 s).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.business import BusinessProfile
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentResponse, DocumentUploadResponse, PresignedDownloadResponse
from app.services import history as history_svc
from app.services import s3 as s3_svc

router = APIRouter(prefix="/documents", tags=["documents"])

# Document categories accepted by the upload endpoint.
VALID_CATEGORIES = {
    "vat_receipt",
    "paye_receipt",
    "cit_receipt",
    "wht_receipt",
    "cipa_certificate",
    "trade_licence",
    "tax_clearance",
    "employment_contract",
    "other",
}


def _get_business_or_404(db: Session, owner_id: int) -> BusinessProfile:
    profile = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.owner_id == owner_id)
        .first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": (
                    "No business profile found. "
                    "Please complete your profile setup first."
                ),
            },
        )
    return profile


def _get_document_or_404(db: Session, document_id: int, business_id: int) -> Document:
    doc = db.get(Document, document_id)
    if not doc or doc.business_id != business_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Document not found."},
        )
    return doc


@router.get("", response_model=list[DocumentResponse])
def list_documents(
    deadline_id: int | None = Query(default=None, description="Filter by linked deadline"),
    category: str | None = Query(default=None, description="Filter by category"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all documents in the Evidence Locker for the authenticated user's business.

    Optionally filter by:
    - deadline_id: show only documents tagged to a specific deadline
    - category: e.g. 'vat_receipt', 'tax_clearance'

    Results are sorted newest-first (uploaded_at DESC).
    """
    business = _get_business_or_404(db, owner_id=current_user.id)
    q = db.query(Document).filter(Document.business_id == business.id)

    if deadline_id is not None:
        q = q.filter(Document.deadline_id == deadline_id)
    if category is not None:
        q = q.filter(Document.category == category)

    return q.order_by(Document.uploaded_at.desc()).all()


@router.post("", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile,
    category: str = Query(..., description="Document category"),
    deadline_id: int | None = Query(default=None, description="Link to a specific deadline"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload a compliance document to the Evidence Locker.

    **Validation (client + server):**
    - Accepted types: PDF, JPEG, PNG, DOCX
    - Maximum size: 10 MB
    - Category must be one of the accepted values

    The file is stored in S3. A pre-signed download URL (15-minute expiry)
    is returned in the response so the client can immediately display a preview
    without an extra round-trip.

    A filing history entry is created for the audit trail.
    """
    business = _get_business_or_404(db, owner_id=current_user.id)

    # ── Validate category ─────────────────────────────────────────────────────
    if category not in VALID_CATEGORIES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INVALID_CATEGORY",
                "message": (
                    f"Invalid category '{category}'. "
                    f"Accepted: {sorted(VALID_CATEGORIES)}"
                ),
            },
        )

    # ── Validate MIME type ────────────────────────────────────────────────────
    mime_type = file.content_type or ""
    if mime_type not in s3_svc.ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "INVALID_FILE_TYPE",
                "message": "Only PDF, JPEG, PNG, and DOCX files are accepted.",
            },
        )

    # ── Read + validate file size ─────────────────────────────────────────────
    content = await file.read()
    file_size = len(content)
    if file_size > s3_svc.MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={
                "code": "FILE_TOO_LARGE",
                "message": f"File exceeds the 10 MB limit ({file_size:,} bytes received).",
            },
        )
    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "EMPTY_FILE", "message": "Uploaded file is empty."},
        )

    # ── Validate deadline ownership if provided ───────────────────────────────
    if deadline_id is not None:
        from app.models.deadline import Deadline
        dl = db.get(Deadline, deadline_id)
        if not dl or dl.business_id != business.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Deadline not found."},
            )

    # ── Upload to S3 ──────────────────────────────────────────────────────────
    import io
    s3_key = s3_svc.build_s3_key(business.id, file.filename or "upload")
    s3_svc.upload_file(
        file_obj=io.BytesIO(content),
        s3_key=s3_key,
        mime_type=mime_type,
        content_length=file_size,
    )

    # ── Persist document record ───────────────────────────────────────────────
    doc = Document(
        business_id=business.id,
        deadline_id=deadline_id,
        filename=file.filename or "upload",
        s3_key=s3_key,
        mime_type=mime_type,
        file_size_bytes=file_size,
        category=category,
    )
    db.add(doc)

    # ── Log to filing history ─────────────────────────────────────────────────
    history_svc.log_entry(
        db,
        business_id=business.id,
        deadline_id=deadline_id,
        action="document_uploaded",
        description=f"Document '{file.filename}' uploaded to Evidence Locker (category: {category}).",
        performed_by=current_user.email,
    )

    db.commit()
    db.refresh(doc)

    # ── Generate pre-signed URL for immediate access ──────────────────────────
    download_url = s3_svc.generate_presigned_url(doc.s3_key)

    return DocumentUploadResponse(
        **DocumentResponse.model_validate(doc).model_dump(),
        download_url=download_url,
        download_url_expires_in_seconds=s3_svc.PRESIGNED_URL_EXPIRY_SECONDS,
    )


@router.get("/{document_id}", response_model=PresignedDownloadResponse)
def get_document_download_url(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate a fresh pre-signed S3 URL for downloading a document.

    The URL expires after 15 minutes. The client should call this endpoint
    again when the URL expires rather than caching it long-term.

    Only the owning business can access its documents.
    """
    business = _get_business_or_404(db, owner_id=current_user.id)
    doc = _get_document_or_404(db, document_id=document_id, business_id=business.id)

    download_url = s3_svc.generate_presigned_url(doc.s3_key)
    return PresignedDownloadResponse(
        download_url=download_url,
        expires_in_seconds=s3_svc.PRESIGNED_URL_EXPIRY_SECONDS,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a document from the Evidence Locker.

    Deletes the S3 object first, then removes the database record.
    A filing history entry is created for the audit trail.

    If the S3 delete fails, the database record is kept intact so the
    user can retry. A 503 is returned in that case.
    """
    business = _get_business_or_404(db, owner_id=current_user.id)
    doc = _get_document_or_404(db, document_id=document_id, business_id=business.id)

    # Delete from S3 first — keep DB record if S3 fails
    s3_svc.delete_object(doc.s3_key)

    # Log before deleting (need deadline_id before it's gone)
    history_svc.log_entry(
        db,
        business_id=business.id,
        deadline_id=doc.deadline_id,
        action="document_deleted",
        description=f"Document '{doc.filename}' removed from Evidence Locker.",
        performed_by=current_user.email,
    )

    db.delete(doc)
    db.commit()
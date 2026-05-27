"""
Reports endpoints — Week 4 (BE-19 partial).

  GET  /reports/compliance-pdf   — generate and stream the compliance summary PDF
  POST /reports/evidence-pack    — merge selected documents into a single PDF

Both endpoints are scoped to the authenticated user's business profile.
"""
import io
import urllib.parse
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.business import BusinessProfile
from app.models.deadline import Deadline, DeadlineCategory, DeadlineStatus
from app.models.document import Document
from app.models.user import User
from app.services import s3 as s3_svc
from app.services.evidence_pack import build_evidence_pack
from app.services.pdf_report import build_compliance_report

router = APIRouter(prefix="/reports", tags=["reports"])


# ── Helpers ───────────────────────────────────────────────────────────────────

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
                "message": "No business profile found. Please complete profile setup first.",
            },
        )
    return profile


def _compute_health_score(deadlines: list[Deadline], today: date) -> float:
    """
    Replicate the health score logic from analytics.py so the PDF always
    shows a value consistent with the dashboard.  Kept local to avoid a
    circular import; if you extract it to a shared service later just
    replace this call.
    """
    WEIGHTS = {
        DeadlineCategory.BURS: 0.45,
        DeadlineCategory.CIPA: 0.25,
        DeadlineCategory.LABOUR: 0.20,
        DeadlineCategory.CUSTOM: 0.10,
    }
    if not deadlines:
        return 100.0

    weighted_sum = 0.0
    weight_total = 0.0
    for dl in deadlines:
        w = WEIGHTS.get(dl.category, 0.10)
        if dl.status == DeadlineStatus.COMPLETE:
            score = 100
        elif dl.status == DeadlineStatus.MISSED:
            score = 0
        elif dl.due_date < today:
            score = 0
        else:
            score = 75
        weighted_sum += score * w
        weight_total += w

    return round(weighted_sum / weight_total, 1) if weight_total else 100.0


def _period_label(period: str | None) -> str:
    """Return a human-readable period string from an optional YYYY-MM prefix."""
    if not period:
        now = datetime.now(timezone.utc)
        return f"January – {now.strftime('%B %Y')}"
    # Accept "2026" or "2026-05"
    parts = period.split("-")
    if len(parts) == 1:
        return f"Full Year {parts[0]}"
    months = [
        "", "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ]
    month_name = months[int(parts[1])] if 1 <= int(parts[1]) <= 12 else parts[1]
    return f"Up to {month_name} {parts[0]}"


# ── Endpoint 1: Compliance Summary PDF ───────────────────────────────────────

@router.get("/compliance-pdf")
def generate_compliance_pdf(
    period: str | None = Query(
        default=None,
        description="Optional period filter — YYYY or YYYY-MM (e.g. '2026' or '2026-05'). "
                    "Defaults to the full year-to-date.",
    ),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Generate and stream a compliance summary PDF for the authenticated
    user's business.

    The PDF is not stored — it is generated on demand and streamed
    directly to the client.

    Query params:
      period  — optional YYYY or YYYY-MM to label the report period.
                Does not filter deadlines (all are always included);
                it only affects the period label on the cover page.
    """
    business = _get_business_or_404(db, current_user.id)
    today = date.today()

    # Fetch all deadlines for this business
    deadlines = (
        db.query(Deadline)
        .filter(Deadline.business_id == business.id)
        .order_by(Deadline.due_date)
        .all()
    )

    # Fetch all documents
    documents = (
        db.query(Document)
        .filter(Document.business_id == business.id)
        .order_by(Document.uploaded_at.desc())
        .all()
    )

    overdue_count = sum(
        1 for dl in deadlines
        if dl.status == DeadlineStatus.PENDING and dl.due_date < today
    )
    health_score = _compute_health_score(deadlines, today)

    deadline_dicts = [
        {
            "name": dl.name,
            "category": dl.category.value,
            "status": dl.status.value,
            "due_date": dl.due_date,
        }
        for dl in deadlines
    ]
    document_dicts = [
        {
            "filename": doc.filename,
            "category": doc.category,
            "uploaded_at": doc.uploaded_at,
        }
        for doc in documents
    ]

    pdf_bytes = build_compliance_report(
        business_name=business.business_name,
        burs_tin=business.burs_tin,
        period_label=_period_label(period),
        health_score=health_score,
        overdue_count=overdue_count,
        deadlines=deadline_dicts,
        documents=document_dicts,
    )

    safe_name = urllib.parse.quote(
        f"CompliancePro_{business.business_name.replace(' ', '_')}_Report.pdf"
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}",
            "Content-Length": str(len(pdf_bytes)),
        },
    )


# ── Endpoint 2: Evidence Pack ─────────────────────────────────────────────────

class EvidencePackRequest(BaseModel):
    document_ids: list[int]


class EvidencePackResponse(BaseModel):
    document_count: int
    pdf_bytes_size: int
    filename: str
    # In prod you'd upload to S3 and return a pre-signed URL here.
    # For now the endpoint streams directly — same pattern as compliance PDF.


@router.post("/evidence-pack")
def generate_evidence_pack(
    body: EvidencePackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Merge selected uploaded documents into a single evidence pack PDF.

    The caller supplies a list of document IDs that belong to their
    business. Mixed types (PDF + images) are handled transparently:
    images are wrapped in a PDF page before merging.

    Request body:
      document_ids — list of document IDs to include (must all belong
                     to the authenticated user's business).

    Returns:
      A streaming PDF download response.
    """
    if not body.document_ids:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "VALIDATION_ERROR",
                "message": "document_ids must contain at least one ID.",
            },
        )

    business = _get_business_or_404(db, current_user.id)

    # Fetch and validate all requested documents
    docs = (
        db.query(Document)
        .filter(
            Document.id.in_(body.document_ids),
            Document.business_id == business.id,
        )
        .all()
    )

    found_ids = {doc.id for doc in docs}
    missing_ids = set(body.document_ids) - found_ids
    if missing_ids:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": f"Document IDs not found or not accessible: {sorted(missing_ids)}",
            },
        )

    doc_dicts = [
        {
            "filename": doc.filename,
            "category": doc.category,
            "mime_type": doc.mime_type,
            "s3_key": doc.s3_key,
            "uploaded_at": doc.uploaded_at,
        }
        for doc in docs
    ]

    def _fetch(s3_key: str) -> bytes:
        """Thin bridge to the S3 / local storage service."""
        return s3_svc.fetch_bytes(s3_key)

    pdf_bytes = build_evidence_pack(doc_dicts, _fetch)

    safe_name = urllib.parse.quote(
        f"EvidencePack_{business.business_name.replace(' ', '_')}.pdf"
    )
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{safe_name}",
            "Content-Length": str(len(pdf_bytes)),
        },
    )
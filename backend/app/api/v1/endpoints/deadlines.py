"""
Deadline management endpoints.

Week 2 deliverables (preserved):
  BE-07  GET /deadlines, GET /deadlines/{id}
  BE-08  PATCH /deadlines/{id}/status, PATCH /deadlines/{id}/checklist

Week 3 deliverables:
  BE-13  POST /deadlines/custom — create custom deadline
         DELETE /deadlines/{id} — delete custom deadline
         PATCH /deadlines/{id}/outstanding — update estimated outstanding BWP
  BE-14  Status changes now write to filing_history (audit trail)

All endpoints are scoped to the authenticated user's business profile.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.business import BusinessProfile
from app.models.deadline import Deadline, DeadlineCategory, DeadlineStatus
from app.models.user import User
from app.schemas.deadline import (
    DeadlineCreate,
    DeadlineOutstandingUpdate,
    DeadlineResponse,
    DeadlineStatusUpdate,
)
from app.services import history as history_svc

router = APIRouter(prefix="/deadlines", tags=["deadlines"])


def _get_business_or_404(db: Session, owner_id: int) -> BusinessProfile:
    """
    Resolve the business profile for the current user.
    Deadlines are always scoped to a business, not directly to a user.
    """
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


def _get_deadline_or_404(db: Session, deadline_id: int, business_id: int) -> Deadline:
    """
    Fetch a deadline by ID and verify it belongs to the current user's business.
    Prevents one business from accessing another business's deadlines.
    """
    dl = db.get(Deadline, deadline_id)
    if not dl or dl.business_id != business_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Deadline not found."},
        )
    return dl


@router.get("", response_model=list[DeadlineResponse])
def list_deadlines(
    category: DeadlineCategory | None = Query(default=None),
    status: DeadlineStatus | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all deadlines for the authenticated user's business.
    Optionally filter by category (BURS, CIPA, LABOUR, CUSTOM)
    and/or status (pending, complete, missed).
    Results are sorted ascending by due date, overdue items first.
    """
    business = _get_business_or_404(db, owner_id=current_user.id)

    q = db.query(Deadline).filter(Deadline.business_id == business.id)

    if category:
        q = q.filter(Deadline.category == category)
    if status:
        q = q.filter(Deadline.status == status)

    return q.order_by(Deadline.due_date.asc()).all()


@router.get("/{deadline_id}", response_model=DeadlineResponse)
def get_deadline(
    deadline_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a single deadline, scoped to the authenticated user's business."""
    business = _get_business_or_404(db, owner_id=current_user.id)
    return _get_deadline_or_404(db, deadline_id=deadline_id, business_id=business.id)


@router.patch("/{deadline_id}/status", response_model=DeadlineResponse)
def update_status(
    deadline_id: int,
    body: DeadlineStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the status of a deadline (pending → complete or missed).
    Only affects deadlines belonging to the authenticated user's business.

    A filing history entry is written automatically for the audit trail.
    """
    business = _get_business_or_404(db, owner_id=current_user.id)
    dl = _get_deadline_or_404(db, deadline_id=deadline_id, business_id=business.id)

    old_status = dl.status
    dl.status = body.status

    # ── Audit trail ───────────────────────────────────────────────────────────
    status_labels = {
        DeadlineStatus.COMPLETE: "marked complete ✓",
        DeadlineStatus.MISSED:   "marked missed ✗",
        DeadlineStatus.PENDING:  "reset to pending",
    }
    description = (
        f"'{dl.name}' {status_labels.get(body.status, body.status)} "
        f"(was: {old_status})."
    )
    history_svc.log_entry(
        db,
        business_id=business.id,
        deadline_id=dl.id,
        action=f"deadline_{body.status}",
        description=description,
        performed_by=current_user.email,
    )

    db.commit()
    db.refresh(dl)
    return dl


@router.patch("/{deadline_id}/outstanding", response_model=DeadlineResponse)
def update_outstanding_amount(
    deadline_id: int,
    body: DeadlineOutstandingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the estimated outstanding BWP amount for a deadline.

    This amount is used by the penalty exposure engine to calculate
    interest penalties. If not set, only the fixed penalty is shown.
    """
    business = _get_business_or_404(db, owner_id=current_user.id)
    dl = _get_deadline_or_404(db, deadline_id=deadline_id, business_id=business.id)

    dl.estimated_outstanding_bwp = body.estimated_outstanding_bwp

    amount_str = (
        f"BWP {body.estimated_outstanding_bwp:,.2f}"
        if body.estimated_outstanding_bwp is not None
        else "cleared"
    )
    history_svc.log_entry(
        db,
        business_id=business.id,
        deadline_id=dl.id,
        action="outstanding_amount_updated",
        description=f"Estimated outstanding amount for '{dl.name}' set to {amount_str}.",
        performed_by=current_user.email,
    )

    db.commit()
    db.refresh(dl)
    return dl


@router.post("/custom", response_model=DeadlineResponse, status_code=201)
def create_custom(
    body: DeadlineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a custom compliance deadline for the authenticated user's business.

    Custom deadlines allow businesses to track industry-specific obligations
    not included in the default Botswana regulatory calendar.
    A filing history entry is created for the audit trail.
    """
    business = _get_business_or_404(db, owner_id=current_user.id)

    dl = Deadline(
        **body.model_dump(),
        business_id=business.id,
        is_custom=True,
        category=DeadlineCategory.CUSTOM,
    )
    db.add(dl)

    # Flush to get the ID before logging
    db.flush()

    history_svc.log_entry(
        db,
        business_id=business.id,
        deadline_id=dl.id,
        action="custom_deadline_created",
        description=f"Custom deadline '{dl.name}' created (due: {dl.due_date}).",
        performed_by=current_user.email,
    )

    db.commit()
    db.refresh(dl)
    return dl


@router.delete("/{deadline_id}", status_code=204)
def delete_deadline(
    deadline_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delete a custom deadline. System-seeded deadlines (is_custom=False)
    cannot be deleted and will return 403.

    A filing history entry is created before deletion for the audit trail.
    """
    business = _get_business_or_404(db, owner_id=current_user.id)
    dl = _get_deadline_or_404(db, deadline_id=deadline_id, business_id=business.id)

    if not dl.is_custom:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "FORBIDDEN",
                "message": (
                    "System deadlines cannot be deleted. "
                    "Only custom deadlines can be removed."
                ),
            },
        )

    history_svc.log_entry(
        db,
        business_id=business.id,
        deadline_id=dl.id,
        action="custom_deadline_deleted",
        description=f"Custom deadline '{dl.name}' deleted.",
        performed_by=current_user.email,
    )

    db.delete(dl)
    db.commit()
"""
Filing History / Audit Trail endpoint.

Week 3 deliverable — BE-14:
  GET /history — paginated audit log for the authenticated business.

The audit trail records every state-changing action:
  - deadline status changes (pending → complete / missed)
  - document uploads and deletions
  - custom task creation and deletion

Results can be filtered by deadline_id to show the history for a
single deadline (used from the Deadline Detail screen).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.business import BusinessProfile
from app.models.history import FilingHistoryEntry
from app.models.user import User
from app.schemas.history import FilingHistoryResponse

router = APIRouter(prefix="/history", tags=["history"])


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
                "message": "No business profile found.",
            },
        )
    return profile


@router.get("", response_model=list[FilingHistoryResponse])
def get_filing_history(
    deadline_id: int | None = Query(
        default=None,
        description="Filter by deadline ID to see history for one deadline",
    ),
    limit: int = Query(default=50, ge=1, le=200, description="Maximum entries to return"),
    offset: int = Query(default=0, ge=0, description="Pagination offset"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the filing history / audit trail for the authenticated user's business.

    Results are sorted newest-first (created_at DESC).

    Optionally filter by `deadline_id` to show the history for a single
    deadline — used from the Deadline Detail screen to show all actions
    taken on that deadline.

    Pagination is supported via `limit` (max 200) and `offset`.
    """
    business = _get_business_or_404(db, owner_id=current_user.id)

    q = (
        db.query(FilingHistoryEntry)
        .filter(FilingHistoryEntry.business_id == business.id)
    )

    if deadline_id is not None:
        q = q.filter(FilingHistoryEntry.deadline_id == deadline_id)

    entries = (
        q.order_by(FilingHistoryEntry.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return entries
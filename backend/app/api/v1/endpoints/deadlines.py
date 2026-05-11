from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.business import BusinessProfile
from app.models.deadline import Deadline, DeadlineCategory, DeadlineStatus
from app.models.user import User
from app.schemas.deadline import DeadlineCreate, DeadlineResponse, DeadlineStatusUpdate

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
    Results are sorted ascending by due date.
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
    """
    business = _get_business_or_404(db, owner_id=current_user.id)
    dl = _get_deadline_or_404(db, deadline_id=deadline_id, business_id=business.id)

    dl.status = body.status
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
    The due_date must be in the future (validated in the schema).
    """
    business = _get_business_or_404(db, owner_id=current_user.id)

    dl = Deadline(
        **body.model_dump(),
        business_id=business.id,
        is_custom=True,
    )
    db.add(dl)
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

    db.delete(dl)
    db.commit()
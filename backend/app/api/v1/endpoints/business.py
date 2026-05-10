from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.database import get_db
from app.models.business import BusinessProfile
from app.models.user import User
from app.schemas.business import BusinessProfileCreate, BusinessProfileResponse

router = APIRouter(prefix="/business", tags=["business"])


def _get_or_404(db: Session, owner_id: int) -> BusinessProfile:
    """Fetch the business profile for a given owner, or raise 404."""
    profile = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.owner_id == owner_id)
        .first()
    )
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "NOT_FOUND", "message": "Business profile not found."},
        )
    return profile


@router.post("/profile", response_model=BusinessProfileResponse, status_code=201)
def create_profile(
    body: BusinessProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a business profile for the authenticated user.
    A user may only have one profile — returns 409 if one already exists.
    """
    existing = (
        db.query(BusinessProfile)
        .filter(BusinessProfile.owner_id == current_user.id)
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CONFLICT",
                "message": "A business profile already exists for this account.",
            },
        )

    profile = BusinessProfile(**body.model_dump(), owner_id=current_user.id)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profile", response_model=BusinessProfileResponse)
def get_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the authenticated user's business profile."""
    return _get_or_404(db, owner_id=current_user.id)


@router.patch("/profile", response_model=BusinessProfileResponse)
def update_profile(
    body: BusinessProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update the authenticated user's business profile.
    Only fields present in the request body are updated (partial update).
    """
    profile = _get_or_404(db, owner_id=current_user.id)
    for key, value in body.model_dump(exclude_unset=True).items():
        setattr(profile, key, value)
    db.commit()
    db.refresh(profile)
    return profile
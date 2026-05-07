from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.business import BusinessProfile
from app.schemas.business import BusinessProfileCreate, BusinessProfileResponse

router = APIRouter(prefix="/business", tags=["business"])


def _get_or_404(db: Session, owner_id: int) -> BusinessProfile:
    profile = db.query(BusinessProfile).filter(BusinessProfile.owner_id == owner_id).first()
    if not profile:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Business profile not found."},
        )
    return profile


@router.post("/profile", response_model=BusinessProfileResponse, status_code=201)
def create_profile(body: BusinessProfileCreate, db: Session = Depends(get_db)):
    # TODO: resolve owner_id from authenticated JWT (Week 1 task BE-03)
    profile = BusinessProfile(**body.model_dump(), owner_id=1)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/profile", response_model=BusinessProfileResponse)
def get_profile(db: Session = Depends(get_db)):
    return _get_or_404(db, owner_id=1)


@router.patch("/profile", response_model=BusinessProfileResponse)
def update_profile(body: BusinessProfileCreate, db: Session = Depends(get_db)):
    profile = _get_or_404(db, owner_id=1)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(profile, k, v)
    db.commit()
    db.refresh(profile)
    return profile

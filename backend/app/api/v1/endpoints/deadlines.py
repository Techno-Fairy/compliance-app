from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.deadline import Deadline, DeadlineCategory, DeadlineStatus
from app.schemas.deadline import DeadlineCreate, DeadlineResponse, DeadlineStatusUpdate

router = APIRouter(prefix="/deadlines", tags=["deadlines"])


@router.get("", response_model=list[DeadlineResponse])
def list_deadlines(
    category: DeadlineCategory | None = Query(default=None),
    status: DeadlineStatus | None = Query(default=None),
    db: Session = Depends(get_db),
):
    q = db.query(Deadline)
    if category:
        q = q.filter(Deadline.category == category)
    if status:
        q = q.filter(Deadline.status == status)
    return q.order_by(Deadline.due_date.asc()).all()


@router.get("/{deadline_id}", response_model=DeadlineResponse)
def get_deadline(deadline_id: int, db: Session = Depends(get_db)):
    dl = db.get(Deadline, deadline_id)
    if not dl:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Deadline not found."})
    return dl


@router.patch("/{deadline_id}/status", response_model=DeadlineResponse)
def update_status(
    deadline_id: int, body: DeadlineStatusUpdate, db: Session = Depends(get_db)
):
    dl = db.get(Deadline, deadline_id)
    if not dl:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Deadline not found."})
    dl.status = body.status
    db.commit()
    db.refresh(dl)
    return dl


@router.post("/custom", response_model=DeadlineResponse, status_code=201)
def create_custom(body: DeadlineCreate, db: Session = Depends(get_db)):
    # TODO: resolve business_id from authenticated user (Week 1 task BE-03)
    dl = Deadline(**body.model_dump(), business_id=1, is_custom=True)
    db.add(dl)
    db.commit()
    db.refresh(dl)
    return dl


@router.delete("/{deadline_id}", status_code=204)
def delete_deadline(deadline_id: int, db: Session = Depends(get_db)):
    dl = db.get(Deadline, deadline_id)
    if not dl or not dl.is_custom:
        raise HTTPException(404, {"code": "NOT_FOUND", "message": "Custom deadline not found."})
    db.delete(dl)
    db.commit()

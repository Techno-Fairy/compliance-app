from datetime import date

from pydantic import BaseModel, Field

from app.models.deadline import DeadlineCategory, DeadlineStatus


class DeadlineCreate(BaseModel):
    name: str
    category: DeadlineCategory
    due_date: date
    notes: str | None = Field(default=None, max_length=500)
    recurrence: str | None = None


class DeadlineStatusUpdate(BaseModel):
    status: DeadlineStatus


class DeadlineResponse(BaseModel):
    id: int
    name: str
    category: DeadlineCategory
    due_date: date
    status: DeadlineStatus
    is_custom: bool
    penalty_info: str | None
    notes: str | None
    recurrence: str | None

    model_config = {"from_attributes": True}

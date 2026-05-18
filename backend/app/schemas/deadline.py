from datetime import date

from pydantic import BaseModel, Field, computed_field

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

    @computed_field  # type: ignore[misc]
    @property
    def days_remaining(self) -> int:
        """
        Positive = days until due.
        Negative = days overdue.
        Zero     = due today.
        """
        return (self.due_date - date.today()).days

    model_config = {"from_attributes": True}
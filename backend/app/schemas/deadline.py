from datetime import date

from pydantic import BaseModel, Field, computed_field

from app.models.deadline import DeadlineCategory, DeadlineStatus


class DeadlineCreate(BaseModel):
    name: str = Field(..., max_length=255)
    category: DeadlineCategory
    due_date: date
    notes: str | None = Field(default=None, max_length=500)
    recurrence: str | None = None
    portal_url: str | None = Field(default=None, max_length=512)
    fixed_penalty_bwp: float | None = Field(default=None, ge=0)
    monthly_interest_rate: float | None = Field(default=None, ge=0, le=1)
    estimated_outstanding_bwp: float | None = Field(default=None, ge=0)


class DeadlineStatusUpdate(BaseModel):
    status: DeadlineStatus


class DeadlineOutstandingUpdate(BaseModel):
    """Allow users to set their estimated outstanding amount for penalty calc."""
    estimated_outstanding_bwp: float | None = Field(default=None, ge=0)


class DeadlineResponse(BaseModel):
    id: int
    name: str
    category: DeadlineCategory
    due_date: date
    status: DeadlineStatus
    is_custom: bool
    penalty_info: str | None
    portal_url: str | None
    notes: str | None
    recurrence: str | None
    fixed_penalty_bwp: float | None
    monthly_interest_rate: float | None
    estimated_outstanding_bwp: float | None

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
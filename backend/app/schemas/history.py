"""
Pydantic schemas for the Filing History / Audit Trail.
"""
from datetime import datetime

from pydantic import BaseModel


class FilingHistoryResponse(BaseModel):
    id: int
    business_id: int
    deadline_id: int | None
    action: str
    description: str
    performed_by: str | None
    created_at: datetime

    model_config = {"from_attributes": True}
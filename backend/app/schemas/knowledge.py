"""
Pydantic schemas for the Knowledge Base.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.models.knowledge import KBCategory


class KnowledgeArticleSummary(BaseModel):
    """Lightweight representation used in the list endpoint."""
    id: int
    title: str
    category: KBCategory
    summary: str
    tags: Optional[str] = None
    updated_at: datetime

    model_config = {"from_attributes": True}


class KnowledgeArticleDetail(KnowledgeArticleSummary):
    """Full article — returned by the detail endpoint."""
    body: str
    created_at: datetime
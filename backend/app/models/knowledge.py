"""
Knowledge Base SQLAlchemy model.

Stores plain-language compliance articles seeded with Botswana-specific
content (VAT, PAYE, CIT, WHT, CIPA, Labour Act).

Articles are public — no business_id scoping — so all authenticated users
share the same read-only knowledge base.
"""
import enum
from datetime import datetime, timezone

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class KBCategory(str, enum.Enum):
    VAT = "VAT"
    PAYE = "PAYE"
    CIT = "CIT"
    WHT = "WHT"
    CIPA = "CIPA"
    LABOUR = "LABOUR"
    GENERAL = "GENERAL"


class KnowledgeArticle(Base):
    __tablename__ = "knowledge_articles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    category: Mapped[KBCategory] = mapped_column(Enum(KBCategory), index=True)
    summary: Mapped[str] = mapped_column(String(512))
    body: Mapped[str] = mapped_column(Text)
    # Comma-separated tags for search, e.g. "vat,filing,monthly"
    tags: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
"""
Filing History / Audit Trail model.

Every state-changing action on a deadline is logged here automatically.
This provides an immutable audit trail for BURS inspections and tender
applications.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class FilingHistoryEntry(Base):
    __tablename__ = "filing_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("business_profiles.id"), index=True
    )
    deadline_id: Mapped[int | None] = mapped_column(
        ForeignKey("deadlines.id"), nullable=True, index=True
    )
    # e.g. "deadline_status_changed", "document_uploaded", "document_deleted"
    action: Mapped[str] = mapped_column(String(100))
    # Human-readable description shown in the UI audit trail
    description: Mapped[str] = mapped_column(Text)
    # Optional: who performed the action (user email)
    performed_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        index=True,
    )

    business: Mapped["BusinessProfile"] = relationship()  # noqa: F821
    deadline: Mapped["Deadline | None"] = relationship()  # noqa: F821
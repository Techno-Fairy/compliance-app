import enum
from datetime import date, datetime, timezone

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class DeadlineCategory(str, enum.Enum):
    BURS = "BURS"
    CIPA = "CIPA"
    LABOUR = "LABOUR"
    CUSTOM = "CUSTOM"


class DeadlineStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETE = "complete"
    MISSED = "missed"


class Deadline(Base):
    __tablename__ = "deadlines"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business_profiles.id"))
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[DeadlineCategory] = mapped_column(Enum(DeadlineCategory))
    due_date: Mapped[date] = mapped_column(Date, index=True)
    status: Mapped[DeadlineStatus] = mapped_column(
        Enum(DeadlineStatus), default=DeadlineStatus.PENDING
    )
    is_custom: Mapped[bool] = mapped_column(Boolean, default=False)
    penalty_info: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    recurrence: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # monthly | quarterly | annually
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    business: Mapped["BusinessProfile"] = relationship(back_populates="deadlines")  # noqa: F821

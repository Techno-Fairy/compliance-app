from datetime import date, datetime, timezone

from sqlalchemy import Date, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class Document(Base):
    __tablename__ = "documents"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(ForeignKey("business_profiles.id"))
    filename: Mapped[str] = mapped_column(String(512))
    s3_key: Mapped[str] = mapped_column(String(1024))
    category: Mapped[str] = mapped_column(String(100))
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    business: Mapped["BusinessProfile"] = relationship(back_populates="documents")  # noqa: F821

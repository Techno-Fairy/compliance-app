import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class CompanyType(str, enum.Enum):
    SOLE_TRADER = "sole_trader"
    PTY_LTD = "pty_ltd"
    PARTNERSHIP = "partnership"
    NGO = "ngo"


class BusinessProfile(Base):
    __tablename__ = "business_profiles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    business_name: Mapped[str] = mapped_column(String(255))
    company_type: Mapped[CompanyType] = mapped_column(Enum(CompanyType))
    cipa_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    burs_tin: Mapped[str | None] = mapped_column(String(20), nullable=True)
    vat_registered: Mapped[bool] = mapped_column(Boolean, default=False)
    vat_filing_monthly: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    owner: Mapped["User"] = relationship(back_populates="business_profile")  # noqa: F821
    deadlines: Mapped[list["Deadline"]] = relationship(  # noqa: F821
        back_populates="business", cascade="all, delete-orphan"
    )
    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        back_populates="business", cascade="all, delete-orphan"
    )

import enum
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, event
from sqlalchemy.orm import Mapped, mapped_column, relationship, Session

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
    # BE-24: gates dashboard vs. guide mode; auto-set true when all Phase 4 steps complete
    is_onboarding_complete: Mapped[bool] = mapped_column(Boolean, default=False)
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
    # BE-26: onboarding progress rows auto-seeded on profile creation (see listener below)
    onboarding_progress: Mapped[list["OnboardingProgress"]] = relationship(  # noqa: F821
        back_populates="business", cascade="all, delete-orphan"
    )


# ── BE-26: Auto-seed onboarding_progress rows ────────────────────────────────

@event.listens_for(BusinessProfile, "after_insert")
def _seed_onboarding_progress(mapper, connection, target: BusinessProfile) -> None:  # noqa: ANN001
    """
    After a new BusinessProfile is inserted, create one OnboardingProgress row
    per onboarding step so the frontend has a complete set of (step, completed=False)
    rows to render immediately — no lazy-creation needed.

    Uses a raw connection INSERT to avoid session entanglement during the
    after_insert flush cycle.
    """
    from app.models.onboarding import OnboardingProgress, OnboardingStep  # local import avoids circular

    # Fetch all step ids via the same connection (inside the active transaction)
    step_ids = connection.execute(
        OnboardingStep.__table__.select().with_only_columns(OnboardingStep.__table__.c.id)
    ).scalars().all()

    if not step_ids:
        return  # Guard: migration hasn't seeded steps yet (e.g. test DB bootstrap)

    rows = [
        {
            "business_id": target.id,
            "step_id": step_id,
            "completed": False,
            "completed_at": None,
            "completed_by": None,
        }
        for step_id in step_ids
    ]
    connection.execute(OnboardingProgress.__table__.insert(), rows)
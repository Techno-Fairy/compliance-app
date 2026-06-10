"""
Onboarding models — Week 6.

OnboardingStep     — BE-25: static seed table, never mutated by users.
OnboardingProgress — BE-26: per-business completion tracking, one row per
                     (business_id, step_id) pair. Auto-created for every new
                     BusinessProfile via a SQLAlchemy event listener.
"""
import json
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class OnboardingStep(Base):
    """
    One row per compliance setup step. Seeded at migration time.

    `documents` is a JSON-encoded list of strings stored in a TEXT column
    so the schema works on both SQLite (dev) and PostgreSQL (prod) without
    requiring the JSONB type.
    """

    __tablename__ = "onboarding_steps"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    phase: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    step_number: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    portal_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    documents: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    # FK to knowledge_articles exists in Supabase (defined in migration SQL).
    # Omitted here so the model works on SQLite in dev without knowledge_articles present.
    kb_article_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @property
    def documents_list(self) -> list[str]:
        """Deserialise the JSON documents column into a Python list."""
        try:
            return json.loads(self.documents)
        except (ValueError, TypeError):
            return []


class OnboardingProgress(Base):
    """
    Per-business completion record for each onboarding step.

    One row is created per (business_id, step_id) pair automatically
    when a BusinessProfile is created (see the after_insert event listener
    registered in business.py).  Users flip `completed` to True via
    PATCH /onboarding/steps/{step_id} (BE-28).
    """

    __tablename__ = "onboarding_progress"
    __table_args__ = (
        UniqueConstraint("business_id", "step_id", name="uq_onboarding_progress"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    business_id: Mapped[int] = mapped_column(
        ForeignKey("business_profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    step_id: Mapped[int] = mapped_column(
        ForeignKey("onboarding_steps.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    completed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Supports accountants marking steps on behalf of a client (BE-28 / Could-have)
    completed_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Relationships ────────────────────────────────────────────────────────
    business: Mapped["BusinessProfile"] = relationship(  # noqa: F821
        back_populates="onboarding_progress"
    )
    step: Mapped["OnboardingStep"] = relationship()
    completer: Mapped["User | None"] = relationship(  # noqa: F821
        foreign_keys=[completed_by]
    )
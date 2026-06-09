"""
Onboarding models — Week 6.

OnboardingStep  — BE-25: static seed table, never mutated by users.
OnboardingProgress — BE-26: added in next ticket.
"""
import json

from sqlalchemy import Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

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
# backend/app/models/team.py
# BE-21/22: Team membership — links an Accountant user to a BusinessProfile.
#
# Lifecycle:
#   pending  → Business Owner sends invite  (POST /team/invite)
#   active   → Accountant accepts           (POST /team/accept/{token})
#   revoked  → Owner removes member         (DELETE /team/{member_id})
#
# An accountant can belong to many businesses; a business can have many
# accountants.  The unique constraint prevents duplicate invites.

from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class TeamMembership(Base):
    __tablename__ = "team_memberships"
    __table_args__ = (
        UniqueConstraint("business_id", "accountant_id", name="uq_team_business_accountant"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, index=True)

    # The business that owns this invite
    business_id: Mapped[int] = mapped_column(
        ForeignKey("business_profiles.id", ondelete="CASCADE"), index=True
    )
    # The accountant being invited — NULL until they accept (invite by email)
    accountant_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Email the invite was sent to (used to match when the accountant registers)
    invited_email: Mapped[str] = mapped_column(String(255), index=True)

    # pending | active | revoked
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)

    # Opaque token sent in the invite email; single-use
    invite_token: Mapped[str | None] = mapped_column(String(128), nullable=True, unique=True)

    invited_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    # Relationships
    business: Mapped["BusinessProfile"] = relationship(foreign_keys=[business_id])   # noqa: F821
    accountant: Mapped["User | None"] = relationship(foreign_keys=[accountant_id])   # noqa: F821
    invited_by: Mapped["User"] = relationship(foreign_keys=[invited_by_id])          # noqa: F821
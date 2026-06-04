"""week5: team_memberships table + notification preference columns

Revision ID: d2e5f3c74a91
Revises: b5e8d1f23a67
Create Date: 2026-06-01 09:00:00.000000

Week 5 schema changes (BE-20/21/22):
  1. team_memberships — accountant ↔ business many-to-many with invite lifecycle
  2. users — notification preference columns (BE-16 companion)
  3. deadlines — last_notified_at for dedup (BE-15 companion)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d2e5f3c74a91"
down_revision: Union[str, None] = "b5e8d1f23a67"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. team_memberships ───────────────────────────────────────────────────
    op.create_table(
        "team_memberships",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("accountant_id", sa.Integer(), nullable=True),
        sa.Column("invited_email", sa.String(255), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("invite_token", sa.String(128), nullable=True),
        sa.Column("invited_by_id", sa.Integer(), nullable=False),
        sa.Column(
            "invited_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business_profiles.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["accountant_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["invited_by_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "business_id", "accountant_id", name="uq_team_business_accountant"
        ),
        sa.UniqueConstraint("invite_token"),
    )
    op.create_index("ix_team_memberships_business_id", "team_memberships", ["business_id"])
    op.create_index("ix_team_memberships_accountant_id", "team_memberships", ["accountant_id"])
    op.create_index("ix_team_memberships_invited_email", "team_memberships", ["invited_email"])
    op.create_index("ix_team_memberships_status", "team_memberships", ["status"])

    # ── 2. Notification preference columns on users ───────────────────────────
    with op.batch_alter_table("users") as batch_op:
        batch_op.add_column(
            sa.Column("notif_deadline_reminders", sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch_op.add_column(
            sa.Column("notif_reminder_days", sa.Integer(), nullable=False, server_default="7")
        )
        batch_op.add_column(
            sa.Column("notif_penalty_alerts", sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch_op.add_column(
            sa.Column("notif_document_expiry", sa.Boolean(), nullable=False, server_default=sa.true())
        )
        batch_op.add_column(
            sa.Column("notif_weekly_digest", sa.Boolean(), nullable=False, server_default=sa.false())
        )

    # ── 3. last_notified_at on deadlines ─────────────────────────────────────
    with op.batch_alter_table("deadlines") as batch_op:
        batch_op.add_column(
            sa.Column("last_notified_at", sa.DateTime(timezone=True), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("deadlines") as batch_op:
        batch_op.drop_column("last_notified_at")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("notif_weekly_digest")
        batch_op.drop_column("notif_document_expiry")
        batch_op.drop_column("notif_penalty_alerts")
        batch_op.drop_column("notif_reminder_days")
        batch_op.drop_column("notif_deadline_reminders")

    op.drop_index("ix_team_memberships_status", "team_memberships")
    op.drop_index("ix_team_memberships_invited_email", "team_memberships")
    op.drop_index("ix_team_memberships_accountant_id", "team_memberships")
    op.drop_index("ix_team_memberships_business_id", "team_memberships")
    op.drop_table("team_memberships")
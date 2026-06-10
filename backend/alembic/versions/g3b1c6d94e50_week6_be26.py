"""BE-26: create onboarding_progress table

One row per (business_id, step_id) pair.  Rows are auto-created by an
SQLAlchemy after_insert event listener on BusinessProfile (see business.py).
This migration only creates the schema; back-fill for existing profiles (if
any exist in staging/prod) is handled by the data-migration step at the bottom.

Revision ID: g3b1c6d94e50
Revises: f2a0b5c83d49
Create Date: 2026-06-09 10:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g3b1c6d94e50"
down_revision: Union[str, None] = "f2a0b5c83d49"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Create table ──────────────────────────────────────────────────────
    op.create_table(
        "onboarding_progress",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("step_id", sa.Integer(), nullable=False),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(
            ["business_id"], ["business_profiles.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["step_id"], ["onboarding_steps.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["completed_by"], ["users.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("business_id", "step_id", name="uq_onboarding_progress"),
    )
    op.create_index("ix_onboarding_progress_id", "onboarding_progress", ["id"])
    op.create_index(
        "ix_onboarding_progress_business_id", "onboarding_progress", ["business_id"]
    )
    op.create_index(
        "ix_onboarding_progress_step_id", "onboarding_progress", ["step_id"]
    )

    # ── 2. Back-fill existing business profiles ──────────────────────────────
    # If the DB already has BusinessProfile rows (e.g. staging), seed progress
    # rows for every (existing_business, step) combination that doesn't yet
    # have a row.  New businesses are handled by the SQLAlchemy event listener
    # going forward.
    conn = op.get_bind()
    business_ids = conn.execute(
        sa.text("SELECT id FROM business_profiles")
    ).scalars().all()

    step_ids = conn.execute(
        sa.text("SELECT id FROM onboarding_steps")
    ).scalars().all()

    if business_ids and step_ids:
        rows = [
            {
                "business_id": bid,
                "step_id": sid,
                "completed": False,
                "completed_at": None,
                "completed_by": None,
            }
            for bid in business_ids
            for sid in step_ids
        ]
        # Insert in batches to avoid parameter-limit issues on large data sets
        batch_size = 500
        progress_table = sa.table(
            "onboarding_progress",
            sa.column("business_id"),
            sa.column("step_id"),
            sa.column("completed"),
            sa.column("completed_at"),
            sa.column("completed_by"),
        )
        for i in range(0, len(rows), batch_size):
            conn.execute(progress_table.insert(), rows[i : i + batch_size])


def downgrade() -> None:
    op.drop_index("ix_onboarding_progress_step_id", table_name="onboarding_progress")
    op.drop_index(
        "ix_onboarding_progress_business_id", table_name="onboarding_progress"
    )
    op.drop_index("ix_onboarding_progress_id", table_name="onboarding_progress")
    op.drop_table("onboarding_progress")
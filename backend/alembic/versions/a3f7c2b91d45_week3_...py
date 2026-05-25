"""week3: documents, filing_history, deadline penalty fields

Revision ID: a3f7c2b91d45
Revises: 44693d36b53a
Create Date: 2026-05-25 09:00:00.000000

Week 3 schema changes:
  1. documents table — add deadline_id FK, mime_type, file_size_bytes columns
     (the table was created in the original model but may need the new columns)
  2. filing_history table — new audit trail table
  3. deadlines table — add penalty engine columns + portal_url
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a3f7c2b91d45"
down_revision: Union[str, None] = "44693d36b53a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── 1. Drop and recreate documents table with full schema ─────────────────
    # The original Week 1/2 migration left documents as a stub.
    # We recreate it with all required columns for Week 3.
    op.drop_table("documents")

    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("deadline_id", sa.Integer(), nullable=True),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("s3_key", sa.String(1024), nullable=False, unique=True),
        sa.Column("mime_type", sa.String(128), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column(
            "uploaded_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deadline_id"], ["deadlines.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_documents_id", "documents", ["id"])
    op.create_index("ix_documents_business_id", "documents", ["business_id"])
    op.create_index("ix_documents_deadline_id", "documents", ["deadline_id"])
    op.create_index("ix_documents_uploaded_at", "documents", ["uploaded_at"])

    # ── 2. Filing history / audit trail ───────────────────────────────────────
    op.create_table(
        "filing_history",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("deadline_id", sa.Integer(), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("performed_by", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["deadline_id"], ["deadlines.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_filing_history_id", "filing_history", ["id"])
    op.create_index("ix_filing_history_business_id", "filing_history", ["business_id"])
    op.create_index("ix_filing_history_deadline_id", "filing_history", ["deadline_id"])
    op.create_index("ix_filing_history_created_at", "filing_history", ["created_at"])

    # ── 3. Penalty engine columns on deadlines ────────────────────────────────
    op.add_column("deadlines", sa.Column("fixed_penalty_bwp", sa.Float(), nullable=True))
    op.add_column("deadlines", sa.Column("monthly_interest_rate", sa.Float(), nullable=True))
    op.add_column("deadlines", sa.Column("estimated_outstanding_bwp", sa.Float(), nullable=True))
    op.add_column("deadlines", sa.Column("portal_url", sa.String(512), nullable=True))

    # ── 4. Add indexes on deadlines for faster filtering ──────────────────────
    # These may already exist — use IF NOT EXISTS via try/except at runtime,
    # but Alembic handles duplication gracefully with checkfirst.
    op.create_index(
        "ix_deadlines_category", "deadlines", ["category"], if_not_exists=True
    )
    op.create_index(
        "ix_deadlines_status", "deadlines", ["status"], if_not_exists=True
    )
    op.create_index(
        "ix_deadlines_business_id", "deadlines", ["business_id"], if_not_exists=True
    )


def downgrade() -> None:
    # Remove penalty columns from deadlines
    op.drop_column("deadlines", "portal_url")
    op.drop_column("deadlines", "estimated_outstanding_bwp")
    op.drop_column("deadlines", "monthly_interest_rate")
    op.drop_column("deadlines", "fixed_penalty_bwp")

    # Remove filing_history table
    op.drop_index("ix_filing_history_created_at", table_name="filing_history")
    op.drop_index("ix_filing_history_deadline_id", table_name="filing_history")
    op.drop_index("ix_filing_history_business_id", table_name="filing_history")
    op.drop_index("ix_filing_history_id", table_name="filing_history")
    op.drop_table("filing_history")

    # Restore minimal documents table (Week 1/2 schema)
    op.drop_table("documents")
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("business_id", sa.Integer(), nullable=False),
        sa.Column("filename", sa.String(512), nullable=False),
        sa.Column("s3_key", sa.String(1024), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("expiry_date", sa.Date(), nullable=True),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["business_id"], ["business_profiles.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_documents_id", "documents", ["id"])
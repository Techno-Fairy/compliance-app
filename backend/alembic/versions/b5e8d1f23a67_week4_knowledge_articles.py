"""week4: knowledge_articles table

Revision ID: b5e8d1f23a67
Revises: a3f7c2b91d45
Create Date: 2026-05-27 08:00:00.000000

Week 4 schema changes:
  1. knowledge_articles — static knowledge base content seeded at app start
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b5e8d1f23a67"
down_revision: Union[str, None] = "a3f7c2b91d45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "knowledge_articles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column(
            "category",
            sa.Enum("VAT", "PAYE", "CIT", "WHT", "CIPA", "LABOUR", "GENERAL",
                    name="kbcategory"),
            nullable=False,
        ),
        sa.Column("summary", sa.String(512), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("tags", sa.String(512), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_knowledge_articles_id", "knowledge_articles", ["id"])
    op.create_index("ix_knowledge_articles_title", "knowledge_articles", ["title"])
    op.create_index("ix_knowledge_articles_category", "knowledge_articles", ["category"])


def downgrade() -> None:
    op.drop_index("ix_knowledge_articles_category", table_name="knowledge_articles")
    op.drop_index("ix_knowledge_articles_title", table_name="knowledge_articles")
    op.drop_index("ix_knowledge_articles_id", table_name="knowledge_articles")
    op.drop_table("knowledge_articles")
    op.execute("DROP TYPE IF EXISTS kbcategory")
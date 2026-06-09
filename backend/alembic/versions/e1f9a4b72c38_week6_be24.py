"""BE-24: add is_onboarding_complete to business_profiles

Revision ID: e1f9a4b72c38
Revises: d2e5f3c74a91
Create Date: 2026-06-09 08:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1f9a4b72c38"
down_revision: Union[str, None] = "d2e5f3c74a91"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("business_profiles") as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_onboarding_complete",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )


def downgrade() -> None:
    with op.batch_alter_table("business_profiles") as batch_op:
        batch_op.drop_column("is_onboarding_complete")
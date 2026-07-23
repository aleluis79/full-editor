"""create custom_words table

Revision ID: 9a3b2c1d0e5f
Revises: 0bf72c64935e
Create Date: 2026-07-23 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9a3b2c1d0e5f'
down_revision: Union[str, Sequence[str], None] = '0bf72c64935e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema — create custom_words table."""
    op.create_table('custom_words',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('user_id', sa.String(length=255), nullable=False),
        sa.Column('word', sa.String(length=255), nullable=False),
        sa.Column('lang', sa.String(length=10), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_custom_words_user_id'), 'custom_words', ['user_id'], unique=False
    )


def downgrade() -> None:
    """Downgrade schema — drop custom_words table."""
    op.drop_index(op.f('ix_custom_words_user_id'), table_name='custom_words')
    op.drop_table('custom_words')

"""add investor_password_encrypted to trading_accounts

Revision ID: v2_add_investor_password
Revises: v1_initial_schema
Create Date: 2026-03-09

"""
from alembic import op
import sqlalchemy as sa

revision = 'v2_add_investor_password'
down_revision = 'v1_initial_schema'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'trading_accounts',
        sa.Column('investor_password_encrypted', sa.Text(), nullable=True),
    )
    # Mark direct-connection accounts with connection_type
    op.add_column(
        'trading_accounts',
        sa.Column('connection_type', sa.String(20), server_default='PASSIVE', nullable=False),
    )


def downgrade() -> None:
    op.drop_column('trading_accounts', 'connection_type')
    op.drop_column('trading_accounts', 'investor_password_encrypted')

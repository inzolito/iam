"""initial_schema

Revision ID: v1_initial_schema
Revises: 
Create Date: 2026-03-06 23:58:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'v1_initial_schema'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Catalog Tables
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    op.create_table(
        'instruments',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('ticker', sa.String(), nullable=False),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('asset_class', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_instruments_ticker', 'instruments', ['ticker'])

    op.create_table(
        'strategy_tags',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('color_hex', sa.String(length=7), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 2. Connection Tables
    op.create_table(
        'trading_accounts',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('platform', sa.String(), nullable=False),
        sa.Column('connection_details', postgresql.JSONB(), nullable=True),
        sa.Column('currency', sa.String(length=3), server_default='USD', nullable=False),
        sa.Column('balance_initial', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # 3. Core Operational Table (Agnostic)
    op.create_table(
        'trades',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('trading_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('instrument_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('instruments.id'), nullable=False),
        sa.Column('external_ticket_id', sa.String(), nullable=False),
        sa.Column('strategy_magic_number', sa.String(), nullable=True),
        sa.Column('side', sa.String(), nullable=False),
        sa.Column('volume', sa.Numeric(precision=18, scale=8), nullable=False),
        sa.Column('open_price', sa.Numeric(precision=18, scale=8), nullable=False),
        sa.Column('close_price', sa.Numeric(precision=18, scale=8), nullable=False),
        sa.Column('sl_price', sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column('tp_price', sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column('open_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('close_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False),
        sa.Column('close_reason', sa.String(), nullable=True),
        sa.Column('commission', sa.Numeric(precision=18, scale=4), server_default='0', nullable=False),
        sa.Column('swap', sa.Numeric(precision=18, scale=4), server_default='0', nullable=False),
        sa.Column('gross_profit', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('net_profit', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('mae_price', sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column('mfe_price', sa.Numeric(precision=18, scale=8), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint('uq_account_ticket', 'trades', ['account_id', 'external_ticket_id'])
    op.create_index('ix_trades_account_close_time', 'trades', ['account_id', 'close_time'])

    # 4. Pivot and Cache Tables
    op.create_table(
        'trade_tags_rel',
        sa.Column('trade_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('trades.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('tag_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('strategy_tags.id', ondelete='CASCADE'), primary_key=True),
    )

    op.create_table(
        'daily_snapshots',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('account_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('trading_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('balance_end', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('daily_pl', sa.Numeric(precision=18, scale=2), nullable=False),
        sa.Column('trades_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_unique_constraint('uq_account_date', 'daily_snapshots', ['account_id', 'date'])
    op.create_index('ix_snapshots_account_date', 'daily_snapshots', ['account_id', 'date'])


def downgrade() -> None:
    op.drop_table('daily_snapshots')
    op.drop_table('trade_tags_rel')
    op.drop_table('trades')
    op.drop_table('trading_accounts')
    op.drop_table('strategy_tags')
    op.drop_table('instruments')
    op.drop_table('users')

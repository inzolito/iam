from uuid import uuid4
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Integer, Text, Date, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Instrument(Base):
    __tablename__ = "instruments"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    ticker = Column(String, index=True, nullable=False)
    full_name = Column(String, nullable=True)
    asset_class = Column(String, nullable=False) # FOREX, CRYPTO
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class TradingAccount(Base):
    __tablename__ = "trading_accounts"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    platform = Column(String, nullable=False) # MT5, BINANCE
    connection_details = Column(JSONB, nullable=True)
    currency = Column(String(3), server_default="USD", nullable=False)
    balance_initial = Column(Numeric(18, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Trade(Base):
    __tablename__ = "trades"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False)
    instrument_id = Column(UUID(as_uuid=True), ForeignKey("instruments.id"), nullable=False)
    
    external_ticket_id = Column(String, nullable=False)
    strategy_magic_number = Column(String, nullable=True)
    
    side = Column(String, nullable=False) # BUY, SELL
    volume = Column(Numeric(18, 8), nullable=False)
    
    open_price = Column(Numeric(18, 8), nullable=False)
    close_price = Column(Numeric(18, 8), nullable=False)
    sl_price = Column(Numeric(18, 8), nullable=True)
    tp_price = Column(Numeric(18, 8), nullable=True)
    
    open_time = Column(DateTime(timezone=True), nullable=False)
    close_time = Column(DateTime(timezone=True), nullable=False)
    duration_seconds = Column(Integer, nullable=False)
    
    close_reason = Column(String, nullable=True)
    commission = Column(Numeric(18, 4), server_default="0", nullable=False)
    swap = Column(Numeric(18, 4), server_default="0", nullable=False)
    gross_profit = Column(Numeric(18, 4), nullable=False)
    net_profit = Column(Numeric(18, 4), nullable=False)
    
    mae_price = Column(Numeric(18, 8), nullable=True)
    mfe_price = Column(Numeric(18, 8), nullable=True)
    comment = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("account_id", "external_ticket_id", name="uq_account_ticket"),
    )

class StrategyTag(Base):
    __tablename__ = "strategy_tags"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    color_hex = Column(String(7), nullable=True)

class DailySnapshot(Base):
    __tablename__ = "daily_snapshots"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    account_id = Column(UUID(as_uuid=True), ForeignKey("trading_accounts.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    balance_end = Column(Numeric(18, 2), nullable=False)
    daily_pl = Column(Numeric(18, 2), nullable=False)
    trades_count = Column(Integer, nullable=False)
    
    __table_args__ = (
        UniqueConstraint("account_id", "date", name="uq_account_date"),
    )

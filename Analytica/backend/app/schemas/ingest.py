from pydantic import BaseModel, Field, UUID4
from datetime import datetime
from typing import List, Optional
from decimal import Decimal

class TradeIngestSchema(BaseModel):
    ticket: str
    symbol: str
    order_type: str = Field(..., description="BUY or SELL")
    lots: Decimal
    open_price: Decimal
    close_price: Decimal
    open_time: datetime
    close_time: datetime
    sl: Optional[Decimal] = None
    tp: Optional[Decimal] = None
    profit_gross: Decimal
    commission: Decimal = Decimal("0.0")
    swap: Decimal = Decimal("0.0")
    magic_number: Optional[str] = None
    comment: Optional[str] = None
    close_reason: Optional[str] = None
    max_adverse_excursion_price: Optional[Decimal] = None
    max_favorable_excursion_price: Optional[Decimal] = None

class IngestRequest(BaseModel):
    account_id: UUID4
    trades: List[TradeIngestSchema]

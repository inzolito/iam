from pydantic import BaseModel
from typing import List, Optional


class AccountStatsResponse(BaseModel):
    total_trades: int
    net_profit: float
    win_rate: Optional[float]

    avg_win: Optional[float]
    avg_loss: Optional[float]
    rr_ratio: Optional[float]

    tp_count: int
    sl_count: int
    manual_count: int
    unknown_count: int
    tp_rate: Optional[float]

    total_volume_lots: Optional[float]

    manual_rate: Optional[float]


class EquityCurvePoint(BaseModel):
    date: str
    balance: float
    daily_pl: float
    trades_count: int


class SymbolStatsRow(BaseModel):
    ticker: str
    asset_class: str
    total_trades: int
    total_pnl: Optional[float]
    avg_pnl: Optional[float]
    win_rate: Optional[float]

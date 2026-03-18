from pydantic import BaseModel
from typing import List, Optional


class AccountStatsResponse(BaseModel):
    current_balance: Optional[float] = None
    # Phase 1
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
    # Phase 2
    profit_factor: Optional[float]
    max_drawdown_pct: Optional[float]
    max_drawdown_usd: Optional[float]
    max_win_streak: int
    max_loss_streak: int
    current_streak: int
    current_streak_type: Optional[str]
    expected_payoff: Optional[float]
    avg_duration_seconds: Optional[float]
    avg_duration_human: Optional[str]
    total_commission: float
    total_swap: float
    cost_impact_pct: Optional[float]
    gross_profit: float
    gross_loss: float
    # Phase 3
    z_score: Optional[float]
    z_interpretation: Optional[str]
    # Phase 4
    sharpe_ratio: Optional[float]
    sqn: Optional[float]
    sqn_rating: Optional[str]
    recovery_factor: Optional[float]


class EquityCurvePoint(BaseModel):
    date: str
    balance: float
    daily_pl: float
    trades_count: int
    intraday: bool = False


class SymbolStatsRow(BaseModel):
    ticker: str
    total_trades: int
    winning_trades: int
    losing_trades: int
    total_pnl: Optional[float]
    avg_pnl: Optional[float]
    win_rate: Optional[float]


class SessionStatsRow(BaseModel):
    session: str
    total_pnl: float
    avg_pnl: float
    win_rate: float
    trades: int


class HeatmapCell(BaseModel):
    day: int
    hour: int
    avg_pnl: float
    count: int


class TradeRow(BaseModel):
    id: str
    ticker: str
    duration_hours: float
    net_profit: float
    volume: float
    close_reason: Optional[str]
    mae_price: Optional[float]
    mfe_price: Optional[float]
    side: str = "BUY"


class CalendarDay(BaseModel):
    date: str
    daily_pl: float
    trades_count: int
    balance_end: float


class MonteCarloResult(BaseModel):
    simulations: int
    forward_trades: int
    percentile_5: float
    percentile_50: float
    percentile_95: float
    ruin_probability: float
    sample_paths: List[List[float]]

class AIAnalysisResponse(BaseModel):
    summary: str
    negative_trades_root_cause: str
    positive_trades_success_factors: str
    suggestions: List[str]
    session_comparison: dict
    heatmap_insights: dict

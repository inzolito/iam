from uuid import UUID
from typing import Optional
from decimal import Decimal
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_
from app.models.database import Trade, Instrument, DailySnapshot, TradingAccount


class StatsService:
    @staticmethod
    def _date_filters(date_from: Optional[date], date_to: Optional[date]):
        """Returns SQLAlchemy filter clauses for date range on Trade.close_time."""
        filters = []
        if date_from:
            filters.append(Trade.close_time >= date_from)
        if date_to:
            filters.append(Trade.close_time <= date_to)
        return filters

    @staticmethod
    async def get_account_stats(
        db: AsyncSession,
        account_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        date_filters = StatsService._date_filters(date_from, date_to)
        base_where = [Trade.account_id == account_id] + date_filters

        result = await db.execute(
            select(
                func.count(Trade.id).label("total_trades"),
                func.sum(Trade.net_profit).label("net_profit"),
                func.count(case((Trade.net_profit > 0, 1))).label("winning_trades"),
                func.avg(case((Trade.net_profit > 0, Trade.net_profit))).label("avg_win"),
                func.avg(case((Trade.net_profit < 0, Trade.net_profit))).label("avg_loss"),
                func.sum(Trade.volume).label("total_volume"),
                func.count(case((Trade.close_reason == "TP", 1))).label("tp_count"),
                func.count(case((Trade.close_reason == "SL", 1))).label("sl_count"),
                func.count(case((Trade.close_reason == "MANUAL", 1))).label("manual_count"),
                func.count(case((Trade.close_reason == "UNKNOWN", 1))).label("unknown_count"),
            ).where(and_(*base_where))
        )
        row = result.one()

        total = row.total_trades or 0
        winning = row.winning_trades or 0
        win_rate = (Decimal(winning) / Decimal(total) * 100) if total > 0 else None

        avg_win = Decimal(str(row.avg_win)) if row.avg_win is not None else None
        avg_loss = Decimal(str(row.avg_loss)) if row.avg_loss is not None else None
        rr_ratio = (
            abs(avg_win / avg_loss)
            if avg_win and avg_loss and avg_loss != 0
            else None
        )

        tp_count = row.tp_count or 0
        tp_rate = (Decimal(tp_count) / Decimal(total) * 100) if total > 0 else None
        manual_count = row.manual_count or 0
        manual_rate = (Decimal(manual_count) / Decimal(total) * 100) if total > 0 else None

        return {
            "total_trades": total,
            "net_profit": Decimal(str(row.net_profit)) if row.net_profit is not None else Decimal("0"),
            "win_rate": win_rate,
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "rr_ratio": rr_ratio,
            "tp_count": tp_count,
            "sl_count": row.sl_count or 0,
            "manual_count": manual_count,
            "unknown_count": row.unknown_count or 0,
            "tp_rate": tp_rate,
            "total_volume_lots": Decimal(str(row.total_volume)) if row.total_volume is not None else None,
            "manual_rate": manual_rate,
        }

    @staticmethod
    async def get_equity_curve(
        db: AsyncSession,
        account_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list:
        filters = [DailySnapshot.account_id == account_id]
        if date_from:
            filters.append(DailySnapshot.date >= date_from)
        if date_to:
            filters.append(DailySnapshot.date <= date_to)

        result = await db.execute(
            select(DailySnapshot)
            .where(and_(*filters))
            .order_by(DailySnapshot.date.asc())
        )
        snapshots = result.scalars().all()

        return [
            {
                "date": str(s.date),
                "balance": Decimal(str(s.balance_end)),
                "daily_pl": Decimal(str(s.daily_pl)),
                "trades_count": s.trades_count,
            }
            for s in snapshots
        ]

    @staticmethod
    async def get_by_symbol(
        db: AsyncSession,
        account_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list:
        date_filters = StatsService._date_filters(date_from, date_to)
        base_where = [Trade.account_id == account_id] + date_filters

        result = await db.execute(
            select(
                Instrument.ticker,
                Instrument.asset_class,
                func.count(Trade.id).label("total_trades"),
                func.sum(Trade.net_profit).label("total_pnl"),
                func.avg(Trade.net_profit).label("avg_pnl"),
                func.count(case((Trade.net_profit > 0, 1))).label("winning_trades"),
            )
            .join(Instrument, Trade.instrument_id == Instrument.id)
            .where(and_(*base_where))
            .group_by(Instrument.ticker, Instrument.asset_class)
            .order_by(func.sum(Trade.net_profit).desc())
        )
        rows = result.all()

        output = []
        for row in rows:
            total = row.total_trades or 0
            win_rate = (
                Decimal(row.winning_trades) / Decimal(total) * 100
                if total > 0
                else None
            )
            output.append(
                {
                    "ticker": row.ticker,
                    "asset_class": row.asset_class,
                    "total_trades": total,
                    "total_pnl": Decimal(str(row.total_pnl)) if row.total_pnl is not None else Decimal("0"),
                    "avg_pnl": Decimal(str(row.avg_pnl)) if row.avg_pnl is not None else None,
                    "win_rate": win_rate,
                }
            )
        return output

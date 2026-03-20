import statistics
import random
from uuid import UUID
from typing import Optional
from decimal import Decimal
from datetime import date, datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case, and_, extract, cast, Date
from app.models.database import Trade, Instrument, DailySnapshot


def _human_duration(seconds: float) -> str:
    h = int(seconds // 3600)
    m = int((seconds % 3600) // 60)
    return f"{h}h {m:02d}m"


def _compute_streaks(net_profits: list[float]) -> dict:
    max_win = max_loss = cur = 0
    streak_type = None
    cur_w = cur_l = 0
    for pnl in net_profits:
        if pnl > 0:
            cur_w += 1; cur_l = 0
            max_win = max(max_win, cur_w)
        else:
            cur_l += 1; cur_w = 0
            max_loss = max(max_loss, cur_l)
    # current streak from the end
    if net_profits:
        if net_profits[-1] > 0:
            streak_type = "WIN"
            for pnl in reversed(net_profits):
                if pnl > 0: cur += 1
                else: break
        else:
            streak_type = "LOSS"
            for pnl in reversed(net_profits):
                if pnl <= 0: cur += 1
                else: break
    return {
        "max_win_streak": max_win,
        "max_loss_streak": max_loss,
        "current_streak": cur,
        "current_streak_type": streak_type,
    }


def _compute_max_drawdown(balances: list[float]) -> tuple[float, float]:
    if not balances:
        return 0.0, 0.0
    peak = balances[0]
    max_dd_usd = max_dd_pct = 0.0
    for b in balances:
        if b > peak:
            peak = b
        dd_usd = peak - b
        dd_pct = (dd_usd / peak * 100) if peak > 0 else 0.0
        if dd_usd > max_dd_usd:
            max_dd_usd = dd_usd
            max_dd_pct = dd_pct
    return max_dd_usd, max_dd_pct


def _compute_sharpe(daily_pls: list[float]) -> Optional[float]:
    if len(daily_pls) < 2:
        return None
    avg = statistics.mean(daily_pls)
    std = statistics.stdev(daily_pls)
    if std == 0:
        return None
    return (avg / std) * (252 ** 0.5)


def _compute_sqn(net_profits: list[float]) -> tuple[Optional[float], Optional[str]]:
    if len(net_profits) < 2:
        return None, None
    avg = statistics.mean(net_profits)
    std = statistics.stdev(net_profits)
    if std == 0:
        return None, None
    sqn = (avg / std) * (len(net_profits) ** 0.5)
    if sqn < 1.6:   rating = "Pobre"
    elif sqn < 2.0: rating = "Por debajo del promedio"
    elif sqn < 2.5: rating = "Promedio"
    elif sqn < 3.0: rating = "Bueno"
    elif sqn < 5.0: rating = "Excelente"
    else:           rating = "Santo Grial"
    return sqn, rating


def _z_score(net_profits: list[float]) -> Optional[float]:
    if len(net_profits) < 5:
        return None
    n = len(net_profits)
    w = sum(1 for p in net_profits if p > 0)
    if w == 0 or w == n:
        return None
    # Count runs (streaks)
    r = 1
    for i in range(1, n):
        prev = net_profits[i - 1] > 0
        curr = net_profits[i] > 0
        if curr != prev:
            r += 1
    denom = (w * (n - w) / n) ** 0.5
    if denom == 0:
        return None
    return (r - (2 * w * (n - w) / n + 1)) / denom


def _sqn_interpretation(z: Optional[float]) -> Optional[str]:
    if z is None:
        return None
    if z < -1.96:
        return "Dependencia (rachas correlacionadas)"
    if z > 1.96:
        return "Alternancia (W/L se alternan)"
    return "Independiente (sin dependencia estadística)"


class StatsService:

    @staticmethod
    def _date_filters(date_from: Optional[date], date_to: Optional[date]):
        filters = []
        if date_from:
            # CAST(close_time AS DATE) is the correct PostgreSQL way to strip time before comparing
            filters.append(cast(Trade.close_time, Date) >= date_from)
        if date_to:
            filters.append(cast(Trade.close_time, Date) <= date_to)
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

        # ── Main aggregate query ───────────────────────────────────────────────
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
                # Phase 2
                func.sum(case((Trade.net_profit > 0, Trade.net_profit))).label("gross_profit"),
                func.sum(case((Trade.net_profit < 0, Trade.net_profit))).label("gross_loss"),
                func.sum(Trade.commission).label("total_commission"),
                func.sum(Trade.swap).label("total_swap"),
                func.avg(Trade.duration_seconds).label("avg_duration"),
                func.sum(Trade.gross_profit).label("sum_gross_profit"),
            ).where(and_(*base_where))
        )
        row = result.one()

        total    = row.total_trades or 0
        winning  = row.winning_trades or 0
        win_rate = (winning / total * 100) if total > 0 else None

        avg_win  = float(row.avg_win)  if row.avg_win  is not None else None
        avg_loss = float(row.avg_loss) if row.avg_loss is not None else None
        rr_ratio = (abs(avg_win / avg_loss) if avg_win and avg_loss and avg_loss != 0 else None)

        tp_count     = row.tp_count or 0
        sl_count     = row.sl_count or 0
        manual_count = row.manual_count or 0
        unknown_count = row.unknown_count or 0
        tp_rate      = (tp_count / total * 100) if total > 0 else None
        manual_rate  = (manual_count / total * 100) if total > 0 else None

        net_profit_val  = float(row.net_profit or 0)
        gross_profit_v  = float(row.gross_profit or 0)
        gross_loss_v    = float(row.gross_loss or 0)
        total_comm      = float(row.total_commission or 0)
        total_swap_v    = float(row.total_swap or 0)

        profit_factor = (
            gross_profit_v / abs(gross_loss_v)
            if gross_loss_v and gross_loss_v != 0 else None
        )
        expected_payoff = None
        if win_rate is not None and avg_win is not None and avg_loss is not None:
            wr = win_rate / 100
            expected_payoff = (wr * avg_win) + ((1 - wr) * avg_loss)

        avg_dur_s = float(row.avg_duration) if row.avg_duration is not None else None
        avg_dur_human = _human_duration(avg_dur_s) if avg_dur_s else None

        total_costs = total_comm + total_swap_v
        cost_impact_pct = (
            abs(total_costs) / gross_profit_v * 100
            if gross_profit_v > 0 else None
        )

        # ── Ordered trade list for streaks + Z-score ──────────────────────────
        pnl_result = await db.execute(
            select(Trade.net_profit)
            .where(and_(*base_where))
            .order_by(Trade.close_time.asc())
        )
        net_profits = [float(r[0]) for r in pnl_result.all() if r[0] is not None]
        streaks = _compute_streaks(net_profits)
        z = _z_score(net_profits)
        sqn_val, sqn_rating = _compute_sqn(net_profits)

        # ── Daily snapshots for max drawdown + sharpe (respects date filter) ──
        snap_filters = [DailySnapshot.account_id == account_id]
        if date_from:
            snap_filters.append(DailySnapshot.date >= date_from)
        if date_to:
            snap_filters.append(DailySnapshot.date <= date_to)
        snap_result = await db.execute(
            select(DailySnapshot.balance_end, DailySnapshot.daily_pl)
            .where(and_(*snap_filters))
            .order_by(DailySnapshot.date.asc())
        )
        snap_rows = snap_result.all()
        balances  = [float(r[0]) for r in snap_rows if r[0] is not None]
        daily_pls = [float(r[1]) for r in snap_rows if r[1] is not None]

        # Latest balance from DB (ignores date filter — always current)
        latest_snap = await db.execute(
            select(DailySnapshot.balance_end)
            .where(DailySnapshot.account_id == account_id)
            .order_by(DailySnapshot.date.desc())
            .limit(1)
        )
        current_balance = latest_snap.scalar()
        current_balance = float(current_balance) if current_balance is not None else None

        # Drawdown from snapshot series only (no hardcoded initial balance)
        max_dd_usd, max_dd_pct = _compute_max_drawdown(balances)
        max_drawdown_usd = max_dd_usd if max_dd_usd > 0 else None
        max_drawdown_pct = max_dd_pct if max_dd_pct > 0 else None

        sharpe = _compute_sharpe(daily_pls)
        recovery_factor = (
            net_profit_val / max_dd_usd
            if max_dd_usd and max_dd_usd > 0 else None
        )

        return {
            "current_balance": current_balance,
            # Phase 1
            "total_trades": total,
            "net_profit": net_profit_val,
            "win_rate": win_rate,
            "avg_win": avg_win,
            "avg_loss": avg_loss,
            "rr_ratio": rr_ratio,
            "tp_count": tp_count,
            "sl_count": sl_count,
            "manual_count": manual_count,
            "unknown_count": unknown_count,
            "tp_rate": tp_rate,
            "total_volume_lots": float(row.total_volume) if row.total_volume is not None else None,
            "manual_rate": manual_rate,
            # Phase 2
            "profit_factor": profit_factor,
            "max_drawdown_pct": max_drawdown_pct,
            "max_drawdown_usd": max_drawdown_usd,
            "max_win_streak": streaks["max_win_streak"],
            "max_loss_streak": streaks["max_loss_streak"],
            "current_streak": streaks["current_streak"],
            "current_streak_type": streaks["current_streak_type"],
            "expected_payoff": expected_payoff,
            "avg_duration_seconds": avg_dur_s,
            "avg_duration_human": avg_dur_human,
            "total_commission": total_comm,
            "total_swap": total_swap_v,
            "cost_impact_pct": cost_impact_pct,
            "gross_profit": gross_profit_v,
            "gross_loss": gross_loss_v,
            # Phase 3 (Z-score)
            "z_score": z,
            "z_interpretation": _sqn_interpretation(z),
            # Phase 4
            "sharpe_ratio": sharpe,
            "sqn": sqn_val,
            "sqn_rating": sqn_rating,
            "recovery_factor": recovery_factor,
        }

    # ── Equity Curve ───────────────────────────────────────────────────────────
    @staticmethod
    async def _get_intraday_curve(
        db: AsyncSession,
        account_id: UUID,
        day: date,
    ) -> list:
        """Intraday equity curve: one point per closed trade, showing running balance."""
        # Balance at start of day = previous day's snapshot
        prev = await db.execute(
            select(DailySnapshot.balance_end)
            .where(
                and_(
                    DailySnapshot.account_id == account_id,
                    DailySnapshot.date < day,
                )
            )
            .order_by(DailySnapshot.date.desc())
            .limit(1)
        )
        start_balance = float(prev.scalar() or 0)

        result = await db.execute(
            select(Trade.close_time, Trade.net_profit)
            .where(
                and_(
                    Trade.account_id == account_id,
                    cast(Trade.close_time, Date) == day,
                )
            )
            .order_by(Trade.close_time.asc())
        )
        rows = result.all()
        if not rows:
            return []

        points = []
        running = start_balance
        for close_time, net_profit in rows:
            running += float(net_profit or 0)
            points.append({
                "date": close_time.isoformat(),   # full ISO datetime — detected by frontend
                "balance": round(running, 2),
                "daily_pl": float(net_profit or 0),
                "trades_count": 1,
                "intraday": True,
            })
        return points

    @staticmethod
    async def get_equity_curve(
        db: AsyncSession,
        account_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list:
        # Single-day filter → intraday per-trade curve
        if date_from and date_to and date_from == date_to:
            return await StatsService._get_intraday_curve(db, account_id, date_from)

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
        return [
            {
                "date": str(s.date),
                "balance": float(s.balance_end),
                "daily_pl": float(s.daily_pl),
                "trades_count": s.trades_count,
            }
            for s in result.scalars().all()
        ]

    # ── By Symbol ─────────────────────────────────────────────────────────────
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
                func.count(Trade.id).label("total_trades"),
                func.sum(Trade.net_profit).label("total_pnl"),
                func.avg(Trade.net_profit).label("avg_pnl"),
                func.count(case((Trade.net_profit > 0, 1))).label("winning_trades"),
                func.count(case((Trade.net_profit < 0, 1))).label("losing_trades"),
            )
            .join(Instrument, Trade.instrument_id == Instrument.id)
            .where(and_(*base_where))
            .group_by(Instrument.ticker)
            .order_by(func.sum(Trade.net_profit).desc())
        )
        output = []
        for row in result.all():
            total = row.total_trades or 0
            winning = row.winning_trades or 0
            losing = row.losing_trades or 0
            wr = (winning / total * 100) if total > 0 else None
            output.append({
                "ticker": row.ticker,
                "total_trades": total,
                "winning_trades": winning,
                "losing_trades": losing,
                "total_pnl": float(row.total_pnl or 0),
                "avg_pnl": float(row.avg_pnl) if row.avg_pnl is not None else None,
                "win_rate": wr,
            })
        return output

    # ── Phase 3: By Session ────────────────────────────────────────────────────
    @staticmethod
    async def get_by_session(
        db: AsyncSession,
        account_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list:
        date_filters = StatsService._date_filters(date_from, date_to)
        base_where = [Trade.account_id == account_id] + date_filters

        result = await db.execute(
            select(
                extract("hour", Trade.open_time).label("hour"),
                Trade.net_profit,
            ).where(and_(*base_where))
        )
        rows = result.all()

        def _session(hour: float) -> str:
            h = int(hour)
            if 0 <= h < 8:   return "Asia"
            if 8 <= h < 13:  return "Londres"
            if 13 <= h < 17: return "London/NY"
            if 17 <= h < 22: return "Nueva York"
            return "Fuera de sesión"

        session_data: dict[str, list[float]] = {}
        for row in rows:
            s = _session(row.hour or 0)
            if s not in session_data:
                session_data[s] = []
            session_data[s].append(float(row.net_profit or 0))

        SESSION_ORDER = ["Asia", "Londres", "London/NY", "Nueva York", "Fuera de sesión"]
        output = []
        for sess in SESSION_ORDER:
            pnls = session_data.get(sess, [])
            if not pnls:
                continue
            wins = sum(1 for p in pnls if p > 0)
            output.append({
                "session": sess,
                "total_pnl": sum(pnls),
                "avg_pnl": sum(pnls) / len(pnls),
                "win_rate": wins / len(pnls) * 100,
                "trades": len(pnls),
            })
        return output

    # ── Phase 3: Heatmap ───────────────────────────────────────────────────────
    @staticmethod
    async def get_heatmap(
        db: AsyncSession,
        account_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list:
        date_filters = StatsService._date_filters(date_from, date_to)
        base_where = [Trade.account_id == account_id] + date_filters

        result = await db.execute(
            select(
                extract("dow", Trade.close_time).label("dow"),
                extract("hour", Trade.close_time).label("hour"),
                func.avg(Trade.net_profit).label("avg_pnl"),
                func.count(Trade.id).label("count"),
            )
            .where(and_(*base_where))
            .group_by("dow", "hour")
        )
        return [
            {
                "day": int(row.dow or 0),    # 0=Sunday in PostgreSQL
                "hour": int(row.hour or 0),
                "avg_pnl": float(row.avg_pnl or 0),
                "count": row.count,
            }
            for row in result.all()
        ]

    # ── Phase 3: Trade List (scatter plots) ────────────────────────────────────
    @staticmethod
    async def get_trades_list(
        db: AsyncSession,
        account_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> list:
        date_filters = StatsService._date_filters(date_from, date_to)
        base_where = [Trade.account_id == account_id] + date_filters

        result = await db.execute(
            select(
                Trade.id,
                Trade.duration_seconds,
                Trade.net_profit,
                Trade.gross_profit,
                Trade.volume,
                Trade.close_reason,
                Trade.open_time,
                Trade.close_time,
                Trade.mae_price,
                Trade.mfe_price,
                Trade.open_price,
                Trade.close_price,
                Trade.side,
                Instrument.ticker,
            )
            .join(Instrument, Trade.instrument_id == Instrument.id)
            .where(and_(*base_where))
            .order_by(Trade.close_time.desc())
            .limit(500)
        )
        return [
            {
                "id": str(row.id),
                "ticker": row.ticker,
                "duration_hours": round(float(row.duration_seconds or 0) / 3600, 2),
                "net_profit": float(row.net_profit or 0),
                "volume": float(row.volume or 0),
                "close_reason": row.close_reason,
                "mae_price": float(row.mae_price) if row.mae_price is not None else None,
                "mfe_price": float(row.mfe_price) if row.mfe_price is not None else None,
                "side": row.side or "BUY",
            }
            for row in result.all()
        ]

    # ── Phase 4: Calendar ──────────────────────────────────────────────────────
    @staticmethod
    async def get_calendar(
        db: AsyncSession,
        account_id: UUID,
        year: int,
        month: int,
    ) -> list:
        result = await db.execute(
            select(DailySnapshot)
            .where(
                and_(
                    DailySnapshot.account_id == account_id,
                    extract("year", DailySnapshot.date) == year,
                    extract("month", DailySnapshot.date) == month,
                )
            )
            .order_by(DailySnapshot.date.asc())
        )
        return [
            {
                "date": str(s.date),
                "daily_pl": float(s.daily_pl),
                "trades_count": s.trades_count,
                "balance_end": float(s.balance_end),
            }
            for s in result.scalars().all()
        ]

    # ── Feature 4.5: Portfolio Correlation ────────────────────────────────────
    @staticmethod
    async def get_correlation(
        db: AsyncSession,
        account_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> dict:
        """
        Compute daily PnL correlation matrix between traded symbols.
        Returns {"symbols": [...], "matrix": [{symbol_a, symbol_b, correlation, trades_overlap}]}
        """
        import statistics as _stats

        date_filters = StatsService._date_filters(date_from, date_to)
        base_where = [Trade.account_id == account_id] + date_filters

        result = await db.execute(
            select(
                cast(Trade.close_time, Date).label("day"),
                Instrument.ticker,
                func.sum(Trade.net_profit).label("pnl"),
                func.count(Trade.id).label("cnt"),
            )
            .join(Instrument, Trade.instrument_id == Instrument.id)
            .where(and_(*base_where))
            .group_by(cast(Trade.close_time, Date), Instrument.ticker)
            .order_by(cast(Trade.close_time, Date))
        )
        rows = result.all()

        # Build {symbol: {date_str: pnl}}
        symbol_days: dict[str, dict[str, float]] = {}
        symbol_counts: dict[str, int] = {}
        for row in rows:
            sym = row.ticker
            if sym not in symbol_days:
                symbol_days[sym] = {}
                symbol_counts[sym] = 0
            symbol_days[sym][str(row.day)] = float(row.pnl or 0)
            symbol_counts[sym] += row.cnt

        symbols = sorted(symbol_days.keys())
        if len(symbols) < 2:
            return {"symbols": symbols, "matrix": []}

        all_dates = sorted({d for s in symbol_days.values() for d in s.keys()})

        # Build aligned series (fill missing days with 0)
        series = {s: [symbol_days[s].get(d, 0.0) for d in all_dates] for s in symbols}

        def pearson(xs: list[float], ys: list[float]) -> Optional[float]:
            n = len(xs)
            if n < 3:
                return None
            mx = sum(xs) / n
            my = sum(ys) / n
            try:
                sx = _stats.stdev(xs)
                sy = _stats.stdev(ys)
            except Exception:
                return None
            if sx == 0 or sy == 0:
                return None
            cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / (n - 1)
            return cov / (sx * sy)

        matrix = []
        for i, a in enumerate(symbols):
            for b in symbols[i + 1:]:
                corr = pearson(series[a], series[b])
                if corr is not None:
                    matrix.append({
                        "symbol_a": a,
                        "symbol_b": b,
                        "correlation": round(corr, 3),
                        "trades_a": symbol_counts[a],
                        "trades_b": symbol_counts[b],
                    })

        # Sort by abs correlation descending
        matrix.sort(key=lambda x: abs(x["correlation"]), reverse=True)
        return {"symbols": symbols, "matrix": matrix}

    # ── Trade History (full detail, paginated) ─────────────────────────────────
    @staticmethod
    async def get_trade_history(
        db: AsyncSession,
        account_id: UUID,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
        page: int = 1,
        page_size: int = 50,
        sort_by: str = "close_time",
        sort_dir: str = "desc",
    ) -> dict:
        date_filters = StatsService._date_filters(date_from, date_to)
        base_where = [Trade.account_id == account_id] + date_filters

        count_result = await db.execute(
            select(func.count(Trade.id)).where(and_(*base_where))
        )
        total = count_result.scalar() or 0

        sort_cols = {
            "open_time":   Trade.open_time,
            "close_time":  Trade.close_time,
            "side":        Trade.side,
            "volume":      Trade.volume,
            "open_price":  Trade.open_price,
            "close_price": Trade.close_price,
            "net_profit":  Trade.net_profit,
        }
        col   = sort_cols.get(sort_by, Trade.close_time)
        order = col.desc() if sort_dir == "desc" else col.asc()

        result = await db.execute(
            select(
                Trade.id,
                Trade.external_ticket_id,
                Trade.open_time,
                Trade.close_time,
                Trade.side,
                Trade.volume,
                Trade.open_price,
                Trade.close_price,
                Trade.sl_price,
                Trade.tp_price,
                Trade.net_profit,
                Trade.commission,
                Trade.swap,
                Trade.comment,
                Trade.close_reason,
                Trade.duration_seconds,
                Instrument.ticker,
            )
            .join(Instrument, Trade.instrument_id == Instrument.id)
            .where(and_(*base_where))
            .order_by(order)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )

        trades = []
        for row in result.all():
            trades.append({
                "id":               str(row.id),
                "ticket":           row.external_ticket_id or "",
                "ticker":           row.ticker,
                "open_time":        row.open_time.isoformat() if row.open_time else None,
                "close_time":       row.close_time.isoformat() if row.close_time else None,
                "side":             row.side or "BUY",
                "volume":           float(row.volume or 0),
                "open_price":       float(row.open_price or 0),
                "close_price":      float(row.close_price or 0),
                "sl":               float(row.sl_price) if row.sl_price else None,
                "tp":               float(row.tp_price) if row.tp_price else None,
                "net_profit":       float(row.net_profit or 0),
                "commission":       float(row.commission or 0),
                "swap":             float(row.swap or 0),
                "comment":          row.comment or "",
                "close_reason":     row.close_reason or "",
                "duration_seconds": int(row.duration_seconds or 0),
            })

        return {
            "total":     total,
            "page":      page,
            "page_size": page_size,
            "pages":     max(1, (total + page_size - 1) // page_size),
            "trades":    trades,
        }

    # ── Phase 4: Monte Carlo ───────────────────────────────────────────────────
    @staticmethod
    async def run_monte_carlo(
        db: AsyncSession,
        account_id: UUID,
        simulations: int = 1000,
        forward_trades: int = 100,
    ) -> dict:
        result = await db.execute(
            select(Trade.net_profit)
            .where(Trade.account_id == account_id)
            .order_by(Trade.close_time.asc())
        )
        pnls = [float(r[0]) for r in result.all() if r[0] is not None]
        if not pnls:
            return {"error": "Sin trades suficientes para simular."}

        n = min(forward_trades, len(pnls))
        final_balances: list[float] = []
        ruin_count = 0
        sample_paths: list[list[float]] = []

        random.seed()
        for i in range(simulations):
            sample = random.choices(pnls, k=n)
            path: list[float] = []
            cum = 0.0
            ruined = False
            for pnl in sample:
                cum += pnl
                path.append(round(cum, 2))
                if cum < -abs(sum(pnls)):
                    ruined = True
            final_balances.append(cum)
            if ruined:
                ruin_count += 1
            if i < 100:  # only store 100 sample paths for the chart
                sample_paths.append(path)

        final_balances.sort()
        p5  = final_balances[int(simulations * 0.05)]
        p50 = final_balances[int(simulations * 0.50)]
        p95 = final_balances[int(simulations * 0.95)]

        return {
            "simulations": simulations,
            "forward_trades": n,
            "percentile_5": round(p5, 2),
            "percentile_50": round(p50, 2),
            "percentile_95": round(p95, 2),
            "ruin_probability": round(ruin_count / simulations * 100, 2),
            "sample_paths": sample_paths,
        }

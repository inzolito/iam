import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from typing import List, Optional
from datetime import date
from uuid import UUID

from app.core.db import get_db
from app.core.security import decode_token_email
from app.schemas.stats import (
    AccountStatsResponse, EquityCurvePoint, SymbolStatsRow,
    SessionStatsRow, HeatmapCell, TradeRow, CalendarDay, MonteCarloResult,
    AIAnalysisResponse,
)
from app.services.stats_service import StatsService
from app.services.ai_analytic_service import AIAnalyticService
from app.models.database import TradingAccount, Trade
from sqlalchemy.future import select

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/trading", tags=["Trading Stats"])


async def _verify_account(db: AsyncSession, account_id: UUID) -> None:
    result = await db.execute(select(TradingAccount).where(TradingAccount.id == account_id))
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Cuenta no encontrada.")


@router.get("/stats/{account_id}", response_model=AccountStatsResponse)
async def get_stats(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    symbol: Optional[str] = Query(None),
    asset_class: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_account_stats(db, account_id, date_from, date_to, symbol, asset_class, tz)


@router.get("/equity-curve/{account_id}", response_model=List[EquityCurvePoint])
async def get_equity_curve(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    tz: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_equity_curve(db, account_id, date_from, date_to, tz)


@router.get("/by-symbol/{account_id}", response_model=List[SymbolStatsRow])
async def get_by_symbol(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    symbol: Optional[str] = Query(None),
    asset_class: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_by_symbol(db, account_id, date_from, date_to, symbol, asset_class, tz)


@router.get("/by-session/{account_id}", response_model=List[SessionStatsRow])
async def get_by_session(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    symbol: Optional[str] = Query(None),
    asset_class: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_by_session(db, account_id, date_from, date_to, symbol, asset_class, tz)


@router.get("/heatmap/{account_id}", response_model=List[HeatmapCell])
async def get_heatmap(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    symbol: Optional[str] = Query(None),
    asset_class: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_heatmap(db, account_id, date_from, date_to, symbol, asset_class, tz)


@router.get("/correlation/{account_id}")
async def get_correlation(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    symbol: Optional[str] = Query(None),
    asset_class: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_correlation(db, account_id, date_from, date_to, symbol, asset_class, tz)


@router.get("/trades/{account_id}", response_model=List[TradeRow])
async def get_trades_list(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    symbol: Optional[str] = Query(None),
    asset_class: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_trades_list(db, account_id, date_from, date_to, symbol, asset_class, tz)


@router.get("/symbols/{account_id}")
async def get_symbols(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_symbols_list(db, account_id)


@router.get("/calendar/{account_id}", response_model=List[CalendarDay])
async def get_calendar(
    account_id: UUID,
    year: int = Query(...),
    month: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_calendar(db, account_id, year, month)


@router.post("/monte-carlo/{account_id}", response_model=MonteCarloResult)
async def run_monte_carlo(
    account_id: UUID,
    simulations: int = Query(1000, ge=100, le=5000),
    forward_trades: int = Query(100, ge=10, le=500),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    result = await StatsService.run_monte_carlo(db, account_id, simulations, forward_trades)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/analyze-performance/{account_id}")
async def analyze_performance(
    account_id: UUID,
    analysis_type: str = Query("symbols"),  # symbols | sessions | heatmap
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    service = AIAnalyticService()
    if analysis_type == "sessions":
        result = await service.analyze_sessions(db, account_id, date_from, date_to)
    elif analysis_type == "heatmap":
        result = await service.analyze_heatmap(db, account_id, date_from, date_to)
    else:
        result = await service.analyze_symbols(db, account_id, date_from, date_to)
    if "error" in result:
        raise HTTPException(status_code=500, detail=result["error"])
    return result


@router.get("/history/{account_id}")
async def get_trade_history(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort_by: str = Query("close_time"),
    sort_dir: str = Query("desc"),
    symbol: Optional[str] = Query(None),
    asset_class: Optional[str] = Query(None),
    tz: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_trade_history(
        db, account_id, date_from, date_to, page, page_size, sort_by, sort_dir, symbol, asset_class, tz
    )


@router.get("/live/{account_id}")
async def get_live_positions(
    account_id: UUID,
    token: str = Query(...),
):
    """REST endpoint polled every few seconds for live equity + open positions."""
    email = decode_token_email(token)
    if not email:
        raise HTTPException(status_code=401, detail="Token inválido")

    from app.core.db import async_session as make_session
    from app.services.metaapi_sync import fetch_live_data
    from app.models.database import TradingAccount

    async with make_session() as db:
        row = (await db.execute(
            select(TradingAccount).where(TradingAccount.id == account_id)
        )).scalar_one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="Cuenta no encontrada")
        meta_id = (row.connection_details or {}).get("metaapi_account_id")

    if not meta_id:
        return {"equity": None, "positions": []}

    live = await fetch_live_data(meta_id, None)
    return {"equity": live.get("equity"), "positions": live.get("positions", [])}


# ── SSE real-time stream ───────────────────────────────────────────────────────

@router.get("/stream/{account_id}")
async def stream_account(
    account_id: UUID,
    token: str = Query(...),
):
    """
    Server-Sent Events stream for real-time dashboard updates.

    Tick rate: 5 seconds.
    - Every tick  : 'live' event — equity + open positions from MetaAPI (if CONNECTED)
    - Every 30s   : 'stats' event — emitted only when closed trade count changes in DB
    - Every 5 min : triggers incremental MetaAPI sync in background

    Auth: JWT as ?token= query param (EventSource cannot set custom headers).
    """
    email = decode_token_email(token)
    if not email:
        raise HTTPException(status_code=401, detail="Token inválido")

    async def generator():
        from app.core.db import async_session as make_session
        from app.services.metaapi_sync import (
            run_incremental_sync, fetch_live_data
        )

        last_count: Optional[int] = None
        tick = 0
        meta_id: Optional[str] = None
        region: Optional[str] = None  # cached — refreshed by fetch_live_data on disconnect

        # ── Bootstrap: load MetaAPI account ID from DB once ─────────────────
        try:
            async with make_session() as db:
                row = (await db.execute(
                    select(TradingAccount).where(TradingAccount.id == account_id)
                )).scalar_one_or_none()
                if row:
                    meta_id = (row.connection_details or {}).get("metaapi_account_id")
        except Exception:
            pass

        # ── Stream loop ──────────────────────────────────────────────────────
        while True:
            try:
                yield ": heartbeat\n\n"

                # ── Live: equity + positions every 5s ────────────────────────
                if meta_id:
                    live = await fetch_live_data(meta_id, region)
                    region = live.get("region")  # update cached region
                    if live.get("equity") is not None or live.get("positions"):
                        payload = json.dumps({
                            "equity": live["equity"],
                            "positions": live["positions"],
                        })
                        yield f"event: live\ndata: {payload}\n\n"

                # ── Stats: check DB for new closed trades every 30s ──────────
                if tick % 6 == 0:
                    try:
                        async with make_session() as db:
                            count = (await db.execute(
                                select(func.count(Trade.id))
                                .where(Trade.account_id == account_id)
                            )).scalar() or 0

                            if last_count is None:
                                last_count = count
                            elif count != last_count:
                                stats = await StatsService.get_account_stats(db, account_id)
                                equity_curve = await StatsService.get_equity_curve(db, account_id)
                                yield f"event: stats\ndata: {json.dumps({'stats': stats, 'equity_curve': equity_curve})}\n\n"
                                last_count = count
                    except Exception as e:
                        logger.warning(f"[SSE DB] {account_id}: {e}")

                # ── Incremental sync every 60s (12 × 5s) ────────────────────
                tick += 1
                if tick % 12 == 0:
                    asyncio.create_task(run_incremental_sync(account_id))

            except (asyncio.CancelledError, GeneratorExit):
                break
            except Exception as e:
                logger.warning(f"[SSE] stream/{account_id}: {e}")

            await asyncio.sleep(5)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

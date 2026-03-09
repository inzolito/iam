from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date
from uuid import UUID

from app.core.db import get_db
from app.schemas.stats import (
    AccountStatsResponse, EquityCurvePoint, SymbolStatsRow,
    SessionStatsRow, HeatmapCell, TradeRow, CalendarDay, MonteCarloResult,
)
from app.services.stats_service import StatsService
from app.models.database import TradingAccount
from sqlalchemy.future import select

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
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_account_stats(db, account_id, date_from, date_to)


@router.get("/equity-curve/{account_id}", response_model=List[EquityCurvePoint])
async def get_equity_curve(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_equity_curve(db, account_id, date_from, date_to)


@router.get("/by-symbol/{account_id}", response_model=List[SymbolStatsRow])
async def get_by_symbol(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_by_symbol(db, account_id, date_from, date_to)


@router.get("/by-session/{account_id}", response_model=List[SessionStatsRow])
async def get_by_session(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_by_session(db, account_id, date_from, date_to)


@router.get("/heatmap/{account_id}", response_model=List[HeatmapCell])
async def get_heatmap(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_heatmap(db, account_id, date_from, date_to)


@router.get("/trades/{account_id}", response_model=List[TradeRow])
async def get_trades_list(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    await _verify_account(db, account_id)
    return await StatsService.get_trades_list(db, account_id, date_from, date_to)


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

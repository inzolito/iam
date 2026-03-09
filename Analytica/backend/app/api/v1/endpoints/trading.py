from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional
from datetime import date
from uuid import UUID

from app.core.db import get_db
from app.schemas.stats import AccountStatsResponse, EquityCurvePoint, SymbolStatsRow
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
    date_from: Optional[date] = Query(None, description="Fecha inicio (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Fecha fin (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
):
    """
    KPIs principales de la cuenta: Net Profit, Win Rate, Avg Win/Loss,
    TP/SL counts, Volumen total, Ciernes manuales.
    """
    await _verify_account(db, account_id)
    return await StatsService.get_account_stats(db, account_id, date_from, date_to)


@router.get("/equity-curve/{account_id}", response_model=List[EquityCurvePoint])
async def get_equity_curve(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Serie temporal del balance para la curva de equity.
    Se popula automáticamente durante la ingesta de trades.
    """
    await _verify_account(db, account_id)
    return await StatsService.get_equity_curve(db, account_id, date_from, date_to)


@router.get("/by-symbol/{account_id}", response_model=List[SymbolStatsRow])
async def get_by_symbol(
    account_id: UUID,
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """
    Rendimiento desglosado por símbolo (par de divisas, activo, etc.).
    """
    await _verify_account(db, account_id)
    return await StatsService.get_by_symbol(db, account_id, date_from, date_to)

import uuid
from typing import List
from datetime import date
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.dialects.postgresql import insert
from app.models.database import Trade, Instrument, TradingAccount, DailySnapshot
from app.schemas.ingest import TradeIngestSchema
from decimal import Decimal

class IngestionService:
    @staticmethod
    async def get_or_create_instrument(db: AsyncSession, ticker: str) -> uuid.UUID:
        # Check if exists
        result = await db.execute(select(Instrument).where(Instrument.ticker == ticker))
        instrument = result.scalar_one_or_none()
        
        if not instrument:
            instrument = Instrument(
                id=uuid.uuid4(),
                ticker=ticker,
                asset_class="FOREX" # Default for MT5
            )
            db.add(instrument)
            await db.commit()
            await db.refresh(instrument)
        
        return instrument.id

    @staticmethod
    async def process_trades(db: AsyncSession, account_id: uuid.UUID, trades_data: List[TradeIngestSchema]):
        # Verify account exists
        acc_result = await db.execute(select(TradingAccount).where(TradingAccount.id == account_id))
        if not acc_result.scalar_one_or_none():
            return None # Or raise exception

        upserted_count = 0
        for trade_dto in trades_data:
            instrument_id = await IngestionService.get_or_create_instrument(db, trade_dto.symbol)
            
            # Calculate Net Profit
            net_profit = trade_dto.profit_gross + trade_dto.commission + trade_dto.swap
            
            # Calculate Duration
            duration = int((trade_dto.close_time - trade_dto.open_time).total_seconds())

            # UPSERT logic using PostgreSQL dialect
            stmt = insert(Trade).values(
                id=uuid.uuid4(),
                account_id=account_id,
                instrument_id=instrument_id,
                external_ticket_id=trade_dto.ticket,
                strategy_magic_number=trade_dto.magic_number,
                side=trade_dto.order_type,
                volume=trade_dto.lots,
                open_price=trade_dto.open_price,
                close_price=trade_dto.close_price,
                sl_price=trade_dto.sl,
                tp_price=trade_dto.tp,
                open_time=trade_dto.open_time,
                close_time=trade_dto.close_time,
                duration_seconds=duration,
                close_reason=trade_dto.close_reason,
                commission=trade_dto.commission,
                swap=trade_dto.swap,
                gross_profit=trade_dto.profit_gross,
                net_profit=net_profit,
                mae_price=trade_dto.max_adverse_excursion_price,
                mfe_price=trade_dto.max_favorable_excursion_price,
                comment=trade_dto.comment
            )

            # Define updates if conflict
            update_stmt = stmt.on_conflict_do_update(
                constraint="uq_account_ticket",
                set_={
                    "close_price": stmt.excluded.close_price,
                    "close_time": stmt.excluded.close_time,
                    "net_profit": stmt.excluded.net_profit,
                    "close_reason": stmt.excluded.close_reason,
                    "mae_price": stmt.excluded.mae_price,
                    "mfe_price": stmt.excluded.mfe_price,
                    "comment": stmt.excluded.comment,
                    "duration_seconds": stmt.excluded.duration_seconds
                }
            )

            await db.execute(update_stmt)
            upserted_count += 1
        
        await db.commit()

        # Update daily snapshots for affected dates
        affected_dates = {
            trade_dto.close_time.date() for trade_dto in trades_data
        }
        await IngestionService.update_daily_snapshots(db, account_id, affected_dates)

        return upserted_count

    @staticmethod
    async def update_daily_snapshots(
        db: AsyncSession,
        account_id: uuid.UUID,
        affected_dates: set,
    ) -> None:
        """Recalculates and upserts daily_snapshots for each affected date."""
        # Get account initial balance
        acc_result = await db.execute(
            select(TradingAccount.balance_initial).where(TradingAccount.id == account_id)
        )
        balance_initial = acc_result.scalar_one_or_none() or Decimal("0")

        for snapshot_date in sorted(affected_dates):
            # Daily PL = SUM of net_profit for trades closed on this date
            day_result = await db.execute(
                select(
                    func.sum(Trade.net_profit).label("daily_pl"),
                    func.count(Trade.id).label("trades_count"),
                ).where(
                    and_(
                        Trade.account_id == account_id,
                        func.date(Trade.close_time) == snapshot_date,
                    )
                )
            )
            day_row = day_result.one()
            daily_pl = Decimal(str(day_row.daily_pl)) if day_row.daily_pl else Decimal("0")
            trades_count = day_row.trades_count or 0

            # Cumulative PL up to and including this date
            cumulative_result = await db.execute(
                select(func.sum(Trade.net_profit)).where(
                    and_(
                        Trade.account_id == account_id,
                        func.date(Trade.close_time) <= snapshot_date,
                    )
                )
            )
            cumulative_pl = Decimal(str(cumulative_result.scalar() or 0))
            balance_end = Decimal(str(balance_initial)) + cumulative_pl

            stmt = insert(DailySnapshot).values(
                id=uuid.uuid4(),
                account_id=account_id,
                date=snapshot_date,
                balance_end=balance_end,
                daily_pl=daily_pl,
                trades_count=trades_count,
            ).on_conflict_do_update(
                constraint="uq_account_date",
                set_={
                    "balance_end": balance_end,
                    "daily_pl": daily_pl,
                    "trades_count": trades_count,
                }
            )
            await db.execute(stmt)

        await db.commit()

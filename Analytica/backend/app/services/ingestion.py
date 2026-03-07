import uuid
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert
from app.models.database import Trade, Instrument, TradingAccount
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
        return upserted_count

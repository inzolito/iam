import asyncio
from uuid import UUID
from datetime import date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import sys
import os

# Add current dir to path to import app
sys.path.append(os.getcwd())

from app.services.stats_service import StatsService

DATABASE_URL = 'postgresql+asyncpg://postgres:AnalyticaRootPW123!@34.55.159.178:5432/analytica'
engine = create_async_engine(DATABASE_URL)
async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

async def check():
    async with async_session() as db:
        aid = UUID('fa8f54c2-f0b3-4c01-9202-46859e517327')
        # HOY = 2026-03-10
        d = date(2026, 3, 10)
        stats = await StatsService.get_account_stats(db, aid, d, d)
        print('Stats for 2026-03-10:')
        print('  Net Profit:', stats["net_profit"])
        print('  Win Rate:', stats["win_rate"])
        print('  Avg Win:', stats["avg_win"])
        print('  Total Trades:', stats["total_trades"])
        
        # Test 2026-03-11 just in case
        d11 = date(2026, 3, 11)
        stats11 = await StatsService.get_account_stats(db, aid, d11, d11)
        print('\nStats for 2026-03-11:')
        print('  Net Profit:', stats11["net_profit"])
        print('  Total Trades:', stats11["total_trades"])

asyncio.run(check())

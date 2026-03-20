import os
import logging
from sqlalchemy import text
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.asyncio import AsyncIOScheduler

logger = logging.getLogger(__name__)

app = FastAPI(
    title="Analytica API",
    description="Institutional Trading Analytics Dashboard Backend",
    version="1.0.0"
)

scheduler = AsyncIOScheduler(timezone="UTC")


@app.on_event("startup")
async def startup_event():
    # Sync DB schema
    from app.core.db import engine
    from app.models.database import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Idempotent column migrations for columns added after initial deploy
        migrations = [
            "ALTER TABLE trades ADD COLUMN IF NOT EXISTS comment TEXT",
            "ALTER TABLE trades ADD COLUMN IF NOT EXISTS mae_price NUMERIC(18,8)",
            "ALTER TABLE trades ADD COLUMN IF NOT EXISTS mfe_price NUMERIC(18,8)",
        ]
        for stmt in migrations:
            await conn.execute(text(stmt))
    logger.info("Base de datos sincronizada en el arranque.")

    # Start MetaAPI scheduler only when token is present
    if os.getenv("METAAPI_TOKEN"):
        from app.services.metaapi_sync import sync_all_direct_accounts
        # Job 1: MetaAPI
        scheduler.add_job(
            sync_all_direct_accounts,
            trigger="interval",
            hours=6,
            id="metaapi_sync",
            replace_existing=True,
            misfire_grace_time=300,
        )
        
        # Job 2: Macro News
        from app.services.macro_service import MacroService
        from app.core.db import async_session
        
        async def macro_job():
            async with async_session() as session:
                await MacroService.fetch_and_store_news(session)

        scheduler.add_job(
            macro_job,
            trigger="interval",
            minutes=30,
            id="macro_news_sync",
            replace_existing=True,
        )

        scheduler.start()
        logger.info("Scheduler started: MetaAPI (6h) and Macro News (30m).")
    else:
        logger.warning("METAAPI_TOKEN not set — MetaAPI sync scheduler disabled.")


@app.on_event("shutdown")
async def shutdown_event():
    if scheduler.running:
        scheduler.shutdown(wait=False)


# CORS
origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
from app.api.v1.endpoints import ingest, auth, accounts, trading

app.include_router(ingest.router,    prefix="/api/v1")
app.include_router(auth.router,      prefix="/api/v1/auth",     tags=["Authentication"])
app.include_router(accounts.router,  prefix="/api/v1/accounts", tags=["Accounts"])
app.include_router(trading.router,   prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "Analytica API is online", "docs": "/docs"}

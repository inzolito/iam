import feedparser
import hashlib
import json
import logging
import os
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.database import MacroEvent

logger = logging.getLogger(__name__)

# RSS Feeds from Investing.com (Spanish)
RSS_FEEDS = [
    "https://es.investing.com/rss/news_1.rss",   # Noticias Generales
    "https://es.investing.com/rss/news_25.rss",  # Commodities
    "https://es.investing.com/rss/news_4.rss",   # Forex
    "https://es.investing.com/rss/news_95.rss",  # Economía
    "https://es.investing.com/rss/news_11.rss",  # Bancos Centrales
    "https://es.investing.com/rss/market_overview.rss", # Resumen
]

# Keywords for mechanical filter (from user provided bot)
KEYWORDS = [
    "FED", "JEROME POWELL", "INFLACION", "CPI", "IPC", "RATE CUT", "INTEREST RATE",
    "PETROLEO", "OIL", "ARAMCO", "SAUDI", "IRAN", "GUERRA", "ATAQUE", "MISIL",
    "XAU", "GOLD", "ORO", "RECESION", "PMI", "NFP", "UNEMPLOYMENT", "VIX",
    "NVIDIA", "TESLA", "APPLE", "NASDAQ", "SP500", "US30", "US500", "USTEC",
    "LAGARDE", "ECB", "BCE", "BITCOIN", "BTC", "BINANCE", "CRIPTO", "CHINA",
    "TAIWAN", "RUSSIA", "PUTIN", "TRUMP", "BIDEN", "ELECCIONES"
]

class MacroService:
    @staticmethod
    async def fetch_and_store_news(db: AsyncSession):
        """Patrols RSS feeds and stores relevant news as MacroEvents."""
        logger.info("Starting macro news patrol...")
        events_added = 0
        
        for url in RSS_FEEDS:
            try:
                # feedparser is synchronous, but it's okay for a background task or we can wrap it
                feed = feedparser.parse(url)
                for entry in feed.entries:
                    if await MacroService._process_entry(db, entry):
                        events_added += 1
            except Exception as e:
                logger.error(f"Error processing feed {url}: {e}")
        
        await db.commit()
        logger.info(f"Macro news patrol finished. Added {events_added} new events.")
        return events_added

    @staticmethod
    async def _process_entry(db: AsyncSession, entry) -> bool:
        title = getattr(entry, 'title', 'Sin título')
        # Simple mechanical filter
        if not any(k.upper() in title.upper() for k in KEYWORDS):
            return False

        # Extract timestamp
        pub_parsed = getattr(entry, 'published_parsed', None)
        if pub_parsed:
            dt_pub = datetime(pub_parsed[0], pub_parsed[1], pub_parsed[2], 
                              pub_parsed[3], pub_parsed[4], pub_parsed[5], 
                              tzinfo=timezone.utc)
        else:
            dt_pub = datetime.now(timezone.utc)

        # Use title and timestamp to prevent duplicates (rudimentary check)
        # In a real scenario, we might use a hash in the database
        # For now, let's check if an event with same name and timestamp exists
        existing = await db.execute(
            select(MacroEvent).where(
                MacroEvent.event_name == title,
                MacroEvent.timestamp == dt_pub
            )
        )
        if existing.scalar_one_or_none():
            return False

        # Build MacroEvent
        # Note: RSS feeds don't give impact directly, we'll mark as 'MEDIUM' by default
        # and let the AI Analysis service refine it if needed, or use Gemini here.
        new_event = MacroEvent(
            timestamp=dt_pub,
            event_name=title,
            currency=MacroService._detect_currency(title),
            impact="MEDIUM", # Default
        )
        db.add(new_event)
        return True

    @staticmethod
    def _detect_currency(title: str) -> Optional[str]:
        title_upper = title.upper()
        if any(w in title_upper for w in ["FED", "USD", "EEUU", "USA", "SEC", "POWELL", "BIDEN", "TRUMP"]):
            return "USD"
        if any(w in title_upper for w in ["BCE", "ECB", "EURO", "LAGARDE", "ALEMANIA", "FRANCIA"]):
            return "EUR"
        if any(w in title_upper for w in ["LONDRES", "GBP", "LIBRA", "BOE", "REINO UNIDO"]):
            return "GBP"
        if any(w in title_upper for w in ["ORO", "GOLD", "XAU"]):
            return "XAU"
        return None

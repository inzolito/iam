"""
MetaAPI synchronization service — REST-only implementation.

Uses MetaAPI REST APIs directly (no WebSocket / no SDK streaming):
  - Provisioning API: create/deploy accounts, get region
  - Client REST API:  fetch closed deal + order history

This approach is reliable in Cloud Run (stateless, no persistent sockets)
and avoids the SDK's regional WebSocket routing issues.
"""

import asyncio
import logging
import os
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Optional

import aiohttp
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.core.encryption import decrypt_field
from app.models.database import TradingAccount
from app.schemas.ingest import TradeIngestSchema
from app.services.ingestion import IngestionService

logger = logging.getLogger(__name__)

METAAPI_TOKEN: str = os.getenv("METAAPI_TOKEN", "")
HISTORY_DAYS: int = int(os.getenv("METAAPI_HISTORY_DAYS", "90"))

PROVISIONING_API = "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai"
CONNECT_POLL_INTERVAL = 15   # seconds between state polls
CONNECT_TIMEOUT_S = 600      # max seconds to wait for broker connection


# ── Helpers ──────────────────────────────────────────────────────────────────

def _close_reason(reason: str) -> str:
    return {
        "DEAL_REASON_TP":     "TP",
        "DEAL_REASON_SL":     "SL",
        "DEAL_REASON_CLIENT": "MANUAL",
    }.get(reason, "UNKNOWN")


def _to_decimal(value) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        d = Decimal(str(value))
        return d if d != 0 else None
    except Exception:
        return None


def _pair_deals(deals: list, orders_by_id: dict) -> list:
    """
    Pair EXIT deals with ENTRY deals by positionId → TradeIngestSchema list.
    """
    entry_by_pos: dict = {}
    for d in deals:
        if d.get("entryType") in ("DEAL_ENTRY_IN", "DEAL_ENTRY_INOUT"):
            pos = d.get("positionId")
            if pos and pos not in entry_by_pos:
                entry_by_pos[pos] = d

    trades: list[TradeIngestSchema] = []

    for deal in deals:
        if deal.get("entryType") not in ("DEAL_ENTRY_OUT", "DEAL_ENTRY_INOUT"):
            continue
        if deal.get("type") == "DEAL_TYPE_BALANCE":
            continue

        pos_id = deal.get("positionId")
        entry  = entry_by_pos.get(pos_id)

        close_price = _to_decimal(deal.get("price")) or Decimal("0")
        close_time  = deal.get("time")
        if not close_time:
            continue
        if isinstance(close_time, str):
            close_time = datetime.fromisoformat(close_time.replace("Z", "+00:00"))

        if entry:
            open_price = _to_decimal(entry.get("price")) or close_price
            open_time  = entry.get("time") or close_time
            if isinstance(open_time, str):
                open_time = datetime.fromisoformat(open_time.replace("Z", "+00:00"))
            side       = "BUY" if "BUY" in entry.get("type", "DEAL_TYPE_BUY") else "SELL"
            entry_order_id = str(entry.get("orderId", ""))
        else:
            open_price = close_price
            open_time  = close_time
            side       = "BUY" if "BUY" in deal.get("type", "DEAL_TYPE_BUY") else "SELL"
            entry_order_id = ""

        if open_time >= close_time:
            continue

        sl: Optional[Decimal] = None
        tp: Optional[Decimal] = None
        if entry_order_id and entry_order_id in orders_by_id:
            order = orders_by_id[entry_order_id]
            sl = _to_decimal(order.get("stopLoss"))
            tp = _to_decimal(order.get("takeProfit"))

        magic     = deal.get("magic", 0)
        magic_str = str(magic) if magic else None
        volume    = _to_decimal(deal.get("volume")) or Decimal("0")

        trades.append(TradeIngestSchema(
            ticket       = str(deal.get("id", "")),
            symbol       = deal.get("symbol", ""),
            order_type   = side,
            lots         = volume,
            open_price   = open_price,
            close_price  = close_price,
            open_time    = open_time,
            close_time   = close_time,
            sl           = sl,
            tp           = tp,
            profit_gross = Decimal(str(deal.get("profit", 0))),
            commission   = Decimal(str(deal.get("commission", 0))),
            swap         = Decimal(str(deal.get("swap", 0))),
            magic_number = magic_str,
            comment      = deal.get("comment") or "",
            close_reason = _close_reason(deal.get("reason", "")),
        ))

    return trades


# ── REST helpers ──────────────────────────────────────────────────────────────

async def _get_account(session: aiohttp.ClientSession, account_id: str) -> dict:
    async with session.get(
        f"{PROVISIONING_API}/users/current/accounts/{account_id}",
        headers={"auth-token": METAAPI_TOKEN},
    ) as r:
        r.raise_for_status()
        return await r.json()


async def _find_account(session: aiohttp.ClientSession, login: str, server: str) -> Optional[dict]:
    """Find existing MetaAPI account by login + server."""
    async with session.get(
        f"{PROVISIONING_API}/users/current/accounts",
        headers={"auth-token": METAAPI_TOKEN},
        params={"query": login, "limit": 50},
    ) as r:
        if r.status != 200:
            return None
        accounts = await r.json()
        for a in accounts:
            if str(a.get("login")) == str(login) and a.get("server") == server:
                return a
    return None


async def _create_account(
    session: aiohttp.ClientSession,
    name: str,
    login: str,
    password: str,
    server: str,
) -> dict:
    payload = {
        "name":     name,
        "type":     "cloud",
        "login":    login,
        "password": password,
        "server":   server,
        "platform": "mt5",
        "magic":    0,
    }
    async with session.post(
        f"{PROVISIONING_API}/users/current/accounts",
        headers={"auth-token": METAAPI_TOKEN, "Content-Type": "application/json"},
        json=payload,
    ) as r:
        r.raise_for_status()
        return await r.json()


async def _deploy(session: aiohttp.ClientSession, account_id: str) -> None:
    async with session.post(
        f"{PROVISIONING_API}/users/current/accounts/{account_id}/deploy",
        headers={"auth-token": METAAPI_TOKEN},
    ) as r:
        if r.status not in (200, 204):
            text = await r.text()
            raise RuntimeError(f"Deploy failed ({r.status}): {text}")


async def _wait_connected(session: aiohttp.ClientSession, account_id: str) -> str:
    """Poll until connectionStatus == CONNECTED or timeout. Returns region."""
    deadline = asyncio.get_event_loop().time() + CONNECT_TIMEOUT_S
    while asyncio.get_event_loop().time() < deadline:
        info = await _get_account(session, account_id)
        state  = info.get("state", "")
        status = info.get("connectionStatus", "")
        region = info.get("region", "")
        logger.info(f"[MetaAPI] Account {account_id} state={state} connectionStatus={status} region={region}")

        if status == "CONNECTED":
            return region

        if state == "ERROR":
            # Force redeploy
            logger.warning(f"[MetaAPI] Account {account_id} in ERROR, redeploying...")
            try:
                async with session.post(
                    f"{PROVISIONING_API}/users/current/accounts/{account_id}/undeploy",
                    headers={"auth-token": METAAPI_TOKEN},
                ) as _:
                    pass
                await asyncio.sleep(5)
            except Exception:
                pass
            await _deploy(session, account_id)

        elif state not in ("DEPLOYED", "DEPLOYING"):
            await _deploy(session, account_id)

        await asyncio.sleep(CONNECT_POLL_INTERVAL)

    raise RuntimeError(
        f"Timed out waiting for account {account_id} to connect to the broker. "
        f"Verifica que el servidor del broker y la contraseña de inversor sean correctos."
    )


async def _fetch_history(
    session: aiohttp.ClientSession,
    region: str,
    account_id: str,
    start: datetime,
    end: datetime,
) -> tuple[list, list]:
    """Fetch deals and history orders via REST client API."""
    base = f"https://mt-client-api-v1.{region}.agiliumtrade.ai"
    fmt  = "%Y-%m-%dT%H:%M:%S.000Z"
    s    = start.strftime(fmt)
    e    = end.strftime(fmt)
    hdrs = {"auth-token": METAAPI_TOKEN}

    async with session.get(f"{base}/users/current/accounts/{account_id}/history-deals/time/{s}/{e}", headers=hdrs) as r:
        r.raise_for_status()
        deals = await r.json()

    async with session.get(f"{base}/users/current/accounts/{account_id}/history-orders/time/{s}/{e}", headers=hdrs) as r:
        r.raise_for_status()
        orders = await r.json()

    return deals, orders


# ── Core sync function ────────────────────────────────────────────────────────

async def sync_account(db: AsyncSession, account: TradingAccount) -> dict:
    """
    Sync a single DIRECT account using MetaAPI REST APIs.
    Returns: {'synced': int, 'error': str | None}
    """
    if not METAAPI_TOKEN:
        return {"synced": 0, "error": "METAAPI_TOKEN no configurado."}
    if not account.investor_password_encrypted:
        return {"synced": 0, "error": "Cuenta sin contraseña de inversor."}

    mt_login      = str(account.connection_details.get("mt5_login", ""))
    broker_server = str(account.connection_details.get("broker_server", ""))
    investor_pw   = decrypt_field(account.investor_password_encrypted)

    timeout = aiohttp.ClientTimeout(total=30)

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:

            # 1. Find or create MetaAPI cloud account ──────────────────────────
            stored_meta_id = account.connection_details.get("metaapi_account_id")
            meta_account   = None

            if stored_meta_id:
                try:
                    meta_account = await _get_account(session, stored_meta_id)
                except Exception:
                    meta_account = None

            if not meta_account:
                meta_account = await _find_account(session, mt_login, broker_server)

            if not meta_account:
                logger.info(f"[MetaAPI] Creating account login={mt_login} server={broker_server}")
                meta_account = await _create_account(
                    session,
                    name     = f"Analytica-{account.id}",
                    login    = mt_login,
                    password = investor_pw,
                    server   = broker_server,
                )

            meta_id = meta_account["_id"]

            # 2. Persist MetaAPI account ID ────────────────────────────────────
            if not account.connection_details.get("metaapi_account_id"):
                new_details = dict(account.connection_details)
                new_details["metaapi_account_id"] = meta_id
                account.connection_details = new_details
                flag_modified(account, "connection_details")
                await db.commit()

            # 3. Deploy if needed + wait for broker connection ─────────────────
            if meta_account.get("state") not in ("DEPLOYED", "DEPLOYING"):
                await _deploy(session, meta_id)

            # Quick check — maybe already connected
            if meta_account.get("connectionStatus") != "CONNECTED":
                region = await _wait_connected(session, meta_id)
            else:
                region = meta_account.get("region", "")
                logger.info(f"[MetaAPI] Account {meta_id} already connected, region={region}")

            if not region:
                # Fallback: re-fetch to get region
                info   = await _get_account(session, meta_id)
                region = info.get("region", "")

            # 4. Fetch history via REST ─────────────────────────────────────────
            start_dt = datetime.now(timezone.utc) - timedelta(days=HISTORY_DAYS)
            end_dt   = datetime.now(timezone.utc)

            deals, orders = await _fetch_history(session, region, meta_id, start_dt, end_dt)
            orders_by_id  = {str(o["id"]): o for o in orders if "id" in o}

            # 5. Pair and ingest ────────────────────────────────────────────────
            trade_schemas = _pair_deals(deals, orders_by_id)
            upserted = 0
            if trade_schemas:
                upserted = await IngestionService.process_trades(db, account.id, trade_schemas)

            logger.info(f"[MetaAPI] Account {account.id} synced {upserted}/{len(trade_schemas)} trades.")
            return {"synced": upserted or 0, "error": None}

    except Exception as exc:
        logger.error(f"[MetaAPI] Account {account.id} sync error: {exc}")
        return {"synced": 0, "error": str(exc)}


# ── Scheduler job ─────────────────────────────────────────────────────────────

async def sync_all_direct_accounts():
    """APScheduler job: iterate all DIRECT accounts and sync each one."""
    from app.core.db import async_session

    logger.info("[MetaAPI Scheduler] Starting scheduled sync...")
    try:
        async with async_session() as db:
            result = await db.execute(
                select(TradingAccount).where(TradingAccount.connection_type == "DIRECT")
            )
            accounts = result.scalars().all()
            logger.info(f"[MetaAPI Scheduler] {len(accounts)} DIRECT account(s) to sync.")
            for acct in accounts:
                r = await sync_account(db, acct)
                logger.info(f"[MetaAPI Scheduler] {acct.id} → {r}")
    except Exception as exc:
        logger.error(f"[MetaAPI Scheduler] Unexpected error: {exc}")

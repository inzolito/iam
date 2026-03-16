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

from sqlalchemy import func, cast, Date

from app.core.encryption import decrypt_field
from app.models.database import TradingAccount, Trade
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


async def _fetch_account_info(
    session: aiohttp.ClientSession,
    region: str,
    account_id: str,
) -> dict:
    """Fetch live account information (balance, equity, etc.) from MetaAPI."""
    base = f"https://mt-client-api-v1.{region}.agiliumtrade.ai"
    hdrs = {"auth-token": METAAPI_TOKEN}
    async with session.get(
        f"{base}/users/current/accounts/{account_id}/account-information",
        headers=hdrs,
    ) as r:
        r.raise_for_status()
        return await r.json()


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

            # 4. Fetch live balance + history via REST ────────────────────────
            start_dt = datetime.now(timezone.utc) - timedelta(days=HISTORY_DAYS)
            end_dt   = datetime.now(timezone.utc)

            # Fetch account-information and history in parallel
            account_info_task = asyncio.create_task(
                _fetch_account_info(session, region, meta_id)
            )
            history_task = asyncio.create_task(
                _fetch_history(session, region, meta_id, start_dt, end_dt)
            )
            account_info, (deals, orders) = await asyncio.gather(
                account_info_task, history_task
            )

            broker_balance = float(account_info.get("balance", 0))
            logger.info(f"[MetaAPI] Account {account.id} broker balance={broker_balance}")

            orders_by_id = {str(o["id"]): o for o in orders if "id" in o}

            # 5. Pair and ingest ────────────────────────────────────────────────
            trade_schemas = _pair_deals(deals, orders_by_id)
            upserted = 0
            if trade_schemas:
                upserted = await IngestionService.process_trades(db, account.id, trade_schemas)

            # 6. Derive and store correct balance_initial ───────────────────────
            # balance_initial = broker_balance - sum(all imported trade net_profit)
            # This is stable regardless of history window size.
            if broker_balance > 0:
                net_result = await db.execute(
                    select(func.sum(Trade.net_profit)).where(Trade.account_id == account.id)
                )
                total_net = float(net_result.scalar() or 0)
                derived_initial = round(broker_balance - total_net, 2)

                if derived_initial > 0:
                    account.balance_initial = Decimal(str(derived_initial))
                    flag_modified(account, "balance_initial")
                    await db.commit()

                    # Recalculate ALL daily snapshots with the corrected balance_initial
                    date_result = await db.execute(
                        select(cast(Trade.close_time, Date).label("d"))
                        .where(Trade.account_id == account.id)
                        .distinct()
                    )
                    all_dates = {r.d for r in date_result.fetchall() if r.d}
                    if all_dates:
                        await IngestionService.update_daily_snapshots(db, account.id, all_dates)
                    logger.info(
                        f"[MetaAPI] Account {account.id} balance_initial set to "
                        f"{derived_initial} (broker={broker_balance}, net={total_net})"
                    )

            logger.info(f"[MetaAPI] Account {account.id} synced {upserted}/{len(trade_schemas)} trades.")
            return {"synced": upserted or 0, "error": None}

    except Exception as exc:
        logger.error(f"[MetaAPI] Account {account.id} sync error: {exc}")
        return {"synced": 0, "error": str(exc)}


# ── Incremental sync (for SSE) ────────────────────────────────────────────────

async def run_incremental_sync(account_id) -> int:
    """
    Lightweight incremental sync triggered by the SSE stream.
    Only runs if the MetaAPI account is already CONNECTED (no broker wait).
    Returns the number of new trades ingested (0 if nothing new or not connected).
    """
    from app.core.db import async_session
    from app.models.database import Trade

    try:
        async with async_session() as db:
            result = await db.execute(
                select(TradingAccount).where(TradingAccount.id == account_id)
            )
            account = result.scalar_one_or_none()
            if not account or not account.investor_password_encrypted:
                return 0

            meta_id = (account.connection_details or {}).get("metaapi_account_id")
            if not meta_id:
                return 0

            timeout = aiohttp.ClientTimeout(total=12)
            async with aiohttp.ClientSession(timeout=timeout) as session:
                try:
                    info = await _get_account(session, meta_id)
                except Exception:
                    return 0

                if info.get("connectionStatus") != "CONNECTED":
                    return 0

                region = info.get("region", "")
                if not region:
                    return 0

                # Get latest close_time from DB to avoid re-ingesting known trades
                last_result = await db.execute(
                    select(func.max(Trade.close_time)).where(Trade.account_id == account_id)
                )
                last_close = last_result.scalar()
                if not last_close:
                    return 0

                # Ensure UTC-aware
                if last_close.tzinfo is None:
                    last_close = last_close.replace(tzinfo=timezone.utc)

                start = last_close + timedelta(seconds=1)
                end = datetime.now(timezone.utc)
                if start >= end:
                    return 0

                deals, orders = await _fetch_history(session, region, meta_id, start, end)
                if not deals:
                    return 0

                orders_by_id = {str(o["id"]): o for o in orders if "id" in o}
                trade_schemas = _pair_deals(deals, orders_by_id)
                if not trade_schemas:
                    return 0

                ingested = await IngestionService.process_trades(db, account_id, trade_schemas)
                logger.info(f"[SSE Incremental] {account_id}: {ingested} new trades ingested")
                return ingested or 0

    except Exception as e:
        logger.warning(f"[SSE Incremental] {account_id}: {e}")
        return 0


async def _http_get(session: aiohttp.ClientSession, url: str, headers: dict):
    """GET helper returning parsed JSON or None."""
    async with session.get(url, headers=headers) as r:
        if r.status == 200:
            return await r.json()
        return None


async def fetch_live_data(meta_id: str, region: Optional[str]) -> dict:
    """
    Fetch real-time equity and open positions from MetaAPI client API.
    If region is None, resolves it first via provisioning API.
    Returns {"equity": float|None, "positions": [...], "region": str|None}
    """
    if not METAAPI_TOKEN or not meta_id:
        return {"equity": None, "positions": [], "region": region}

    timeout = aiohttp.ClientTimeout(total=8)
    resolved_region = region

    try:
        async with aiohttp.ClientSession(timeout=timeout) as session:
            # Resolve region if needed (first call or after disconnect)
            if not resolved_region:
                info = await _get_account(session, meta_id)
                if info.get("connectionStatus") != "CONNECTED":
                    return {"equity": None, "positions": [], "region": None}
                resolved_region = info.get("region") or None

            if not resolved_region:
                return {"equity": None, "positions": [], "region": None}

            base = f"https://mt-client-api-v1.{resolved_region}.agiliumtrade.ai"
            hdrs = {"auth-token": METAAPI_TOKEN}

            acct_info, raw_pos = await asyncio.gather(
                _http_get(session, f"{base}/users/current/accounts/{meta_id}/account-information", hdrs),
                _http_get(session, f"{base}/users/current/accounts/{meta_id}/positions", hdrs),
            )

            if acct_info is None:
                # Connection lost — clear region so next call re-resolves it
                return {"equity": None, "positions": [], "region": None}

            equity = float(acct_info.get("equity") or acct_info.get("balance") or 0) or None

            now_utc = datetime.now(timezone.utc)
            positions = []
            for p in (raw_pos or []):
                try:
                    t_str = p.get("time") or p.get("openTime") or ""
                    t = datetime.fromisoformat(t_str.replace("Z", "+00:00"))
                    secs = int((now_utc - t).total_seconds())
                    h, m = secs // 3600, (secs % 3600) // 60
                    dur = f"{h}h {m}m" if h else f"{m}m"
                except Exception:
                    dur = "—"

                pos_type = p.get("type", "")
                positions.append({
                    "id": str(p.get("id", "")),
                    "symbol": p.get("symbol", ""),
                    "direction": "BUY" if "BUY" in pos_type else "SELL",
                    "volume": float(p.get("volume") or 0),
                    "open_price": float(p.get("openPrice") or 0),
                    "current_price": float(p.get("currentPrice") or 0),
                    "pnl": float(p.get("profit") or 0),
                    "duration": dur,
                })

            return {"equity": equity, "positions": positions, "region": resolved_region}

    except Exception as e:
        logger.debug(f"[Live Data] {meta_id}: {e}")
        return {"equity": None, "positions": [], "region": region}


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

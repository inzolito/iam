import os
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.db import get_db
from app.core.security import get_current_user_email
from app.core.encryption import encrypt_field
from app.models.database import TradingAccount, User, ApiKey
from app.schemas.trading import (
    TradingAccountCreate,
    TradingAccountSchema,
    TradingAccountLinkResponse,
    TradingAccountLinkDirectRequest,
    TradingAccountLinkDirectResponse,
    SetInvestorPasswordRequest,
)
from app.services.api_key_service import create_api_key
from typing import List

router = APIRouter()

# Curated list of the most common MT5 broker servers
_KNOWN_SERVERS: list[str] = [
    "Exness-MT5Real", "Exness-MT5Real2", "Exness-MT5Real3", "Exness-MT5Real4",
    "Exness-MT5Trial", "Exness-MT5Trial2",
    "ICMarkets-Demo", "ICMarkets-Demo02", "ICMarkets-Live01", "ICMarkets-Live02",
    "ICMarkets-Live03", "ICMarkets-Live04", "ICMarkets-Live05",
    "Weltrade-Demo", "Weltrade-Live",
    "Darwinex-Demo", "Darwinex-Live",
    "Pepperstone-MT5-Demo", "Pepperstone-MT5-Live",
    "FxPro-MT5", "FxPro-MT5-Real2", "FxPro-MT5-Real3", "FxPro-MT5Demo",
    "FTMO-Demo", "FTMO-Server", "FTMO-Server2", "FTMO-Server3",
    "TheFundedTraderProgram-Demo", "TheFundedTraderProgram-Live",
    "MFF-Demo", "MFF-Live",
    "OctaFX-Demo", "OctaFX-Real", "OctaFX-Real2",
    "Tickmill-Demo", "Tickmill-Live", "Tickmill-Pro",
    "XMGlobal-Demo", "XMGlobal-MT5 2", "XMGlobal-MT5 3", "XMGlobal-Real",
    "HFMarkets-Demo", "HFMarkets-Live",
    "Axi-Demo", "Axi-Live",
    "FPMarkets-Demo", "FPMarkets-Live",
    "FusionMarkets-Demo", "FusionMarkets-Live",
    "RoboForex-Demo", "RoboForex-ECN", "RoboForex-Pro",
    "Vantage-Demo", "Vantage-Live",
    "BlackBull-Demo", "BlackBull-Live",
    "EasyMarkets-MT5-Demo", "EasyMarkets-MT5-Live",
    "AdmiralMarkets-Demo", "AdmiralMarkets-Live",
    "ThinkMarkets-Demo", "ThinkMarkets-Live",
    "LiteFinance-Demo", "LiteFinance-Real",
    "FXCM-USDDemo01", "FXCM-USDReal01",
    "Alpari-MT5-Demo", "Alpari-MT5-ECN-Demo",
    "RoyalMT5-Demo", "RoyalMT5-Live",
]


@router.get("/broker-servers")
async def get_broker_servers(
    query: str = Query("", min_length=0),
    current_user_email: str = Depends(get_current_user_email),
):
    """
    Returns broker server names matching the query string.
    Combines a curated list of popular MT5 servers with any servers
    previously used in the user's MetaAPI account history.
    """
    import aiohttp

    servers: set[str] = set(_KNOWN_SERVERS)

    # Enrich with servers from user's existing MetaAPI accounts
    token = os.getenv("METAAPI_TOKEN", "")
    if token:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    "https://mt-provisioning-api-v1.agiliumtrade.agiliumtrade.ai/users/current/accounts",
                    headers={"auth-token": token},
                    timeout=aiohttp.ClientTimeout(total=5),
                ) as resp:
                    if resp.status == 200:
                        accounts = await resp.json()
                        for acc in accounts:
                            srv = acc.get("server") or acc.get("serverName")
                            if srv:
                                servers.add(srv)
        except Exception:
            pass  # Enrichment is best-effort; curated list is the fallback

    q = query.strip().lower()
    if q:
        matched = [s for s in sorted(servers) if q in s.lower()]
    else:
        matched = sorted(servers)

    return matched[:20]


async def _get_user(db: AsyncSession, email: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return user


@router.post("/link", response_model=TradingAccountLinkResponse)
async def link_trading_account(
    account_data: TradingAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user_email: str = Depends(get_current_user_email),
):
    user = await _get_user(db, current_user_email)

    new_account = TradingAccount(
        user_id=user.id,
        name=account_data.name,
        platform=account_data.platform,
        currency=account_data.currency,
        balance_initial=account_data.balance_initial,
        connection_details={
            "broker_server": account_data.broker_server,
            "mt5_login": account_data.mt5_login,
        },
    )

    db.add(new_account)
    await db.flush()

    client_id, client_secret = await create_api_key(db, new_account.id)

    await db.commit()
    await db.refresh(new_account)

    return {
        "account": new_account,
        "client_id": client_id,
        "client_secret": client_secret,
    }


@router.get("/", response_model=List[TradingAccountSchema])
async def get_accounts(
    db: AsyncSession = Depends(get_db),
    current_user_email: str = Depends(get_current_user_email),
):
    user = await _get_user(db, current_user_email)
    result = await db.execute(
        select(TradingAccount).where(TradingAccount.user_id == user.id)
    )
    db_accounts = result.scalars().all()

    accounts: List[TradingAccountSchema] = []
    for acc in db_accounts:
        details = acc.connection_details or {}
        accounts.append(
            TradingAccountSchema(
                id=acc.id,
                user_id=acc.user_id,
                name=acc.name,
                platform=acc.platform,
                currency=acc.currency,
                balance_initial=float(acc.balance_initial),
                connection_type=acc.connection_type,
                created_at=acc.created_at,
                broker_server=details.get("broker_server"),
                mt5_login=details.get("mt5_login"),
                sync_error=details.get("sync_error"),
            )
        )
    return accounts


@router.post("/link-direct", response_model=TradingAccountLinkDirectResponse, status_code=status.HTTP_201_CREATED)
async def link_trading_account_direct(
    payload: TradingAccountLinkDirectRequest,
    db: AsyncSession = Depends(get_db),
    current_user_email: str = Depends(get_current_user_email),
):
    """
    Vincula una cuenta MT5 usando la contraseña de inversor (solo lectura).
    La contraseña NUNCA se retorna en ninguna respuesta — solo se almacena cifrada con AES-256-GCM.
    """
    user = await _get_user(db, current_user_email)

    encrypted_pw = encrypt_field(payload.investor_password)

    account = TradingAccount(
        user_id=user.id,
        name=f"MT5-{payload.account_number}",
        platform="MT5",
        connection_type="DIRECT",
        currency=payload.currency,
        balance_initial=payload.balance_initial,
        connection_details={
            "broker_server": payload.broker_server,
            "mt5_login": payload.account_number,
        },
        investor_password_encrypted=encrypted_pw,
    )
    db.add(account)
    await db.commit()
    await db.refresh(account)

    # NOTE: investor_password is intentionally NOT included in the response.
    return TradingAccountLinkDirectResponse(account=account)


@router.post("/{account_id}/regenerate-key")
async def regenerate_api_key(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user_email: str = Depends(get_current_user_email),
):
    """Regenera las credenciales de ingesta de una cuenta. El secret anterior queda inválido."""
    user = await _get_user(db, current_user_email)

    # Verify the account belongs to this user
    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada.")

    # Delete old key
    old = await db.execute(select(ApiKey).where(ApiKey.account_id == account_id))
    old_key = old.scalar_one_or_none()
    if old_key:
        await db.delete(old_key)
        await db.flush()

    # Create new key
    client_id, client_secret = await create_api_key(db, account_id)
    await db.commit()

    ingest_url = os.getenv(
        "INGEST_URL",
        "https://analytica-backend-419965139801.us-central1.run.app/api/v1/ingest/mt5",
    )
    return {
        "client_id": client_id,
        "client_secret": client_secret,
        "ingest_url": ingest_url,
    }


@router.post("/sync/{account_id}", status_code=202)
async def sync_account_endpoint(
    account_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user_email: str = Depends(get_current_user_email),
):
    """
    Dispara sincronización MetaAPI en background (no bloquea la petición HTTP).
    La conexión al broker puede tardar 5-10 minutos la primera vez.
    Consulta GET /api/v1/trading/stats/{account_id} periódicamente para detectar
    cuando los trades hayan llegado.
    """
    import asyncio
    from app.services.metaapi_sync import sync_account
    from app.core.db import async_session

    user = await _get_user(db, current_user_email)

    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada.")
    if account.connection_type != "DIRECT":
        raise HTTPException(status_code=400, detail="Solo cuentas con Conexión Directa pueden sincronizarse via MetaAPI.")

    async def _background_sync():
        async with async_session() as bg_db:
            bg_result = await bg_db.execute(
                select(TradingAccount).where(TradingAccount.id == account_id)
            )
            bg_account = bg_result.scalar_one_or_none()
            if bg_account:
                await sync_account(bg_db, bg_account)

    asyncio.create_task(_background_sync())

    return {"status": "started", "message": "Sincronización en curso. Puede tardar varios minutos la primera vez."}


@router.patch("/{account_id}/investor-password", status_code=200)
async def set_investor_password(
    account_id: UUID,
    payload: SetInvestorPasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user_email: str = Depends(get_current_user_email),
):
    """Establece o actualiza la contraseña de inversor de una cuenta existente."""
    user = await _get_user(db, current_user_email)

    result = await db.execute(
        select(TradingAccount).where(
            TradingAccount.id == account_id,
            TradingAccount.user_id == user.id,
        )
    )
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada.")

    account.investor_password_encrypted = encrypt_field(payload.investor_password)
    account.connection_type = "DIRECT"
    await db.commit()
    return {"message": "Contraseña de inversor actualizada."}

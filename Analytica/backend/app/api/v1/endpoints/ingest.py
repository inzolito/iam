from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.schemas.ingest import IngestRequest
from app.services.ingestion import IngestionService
from app.services.api_key_service import verify_api_key
from app.models.database import ApiKey
from sqlalchemy.future import select

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

@router.post("/mt5", status_code=status.HTTP_200_OK)
async def ingest_mt5_data(
    request: IngestRequest, 
    db: AsyncSession = Depends(get_db),
    x_api_key: str = Header(..., description="API Key con formato client_id:client_secret")
):
    """
    Ingests trades from MT5 platform using an API Key.
    Format of x_api_key: 'AN-XXXX:XXXX'
    """
    if ":" not in x_api_key:
        raise HTTPException(status_code=401, detail="Formato de API Key inválido. Use client_id:secret.")
    
    client_id, secret = x_api_key.split(":", 1)
    
    # Verificar API Key
    from app.services.api_key_service import hash_secret
    result = await db.execute(
        select(ApiKey).where(ApiKey.client_id == client_id)
    )
    api_key_record = result.scalars().first()
    
    if not api_key_record or api_key_record.hashed_secret != hash_secret(secret):
        raise HTTPException(status_code=401, detail="API Key inválida o expirada.")

    # Usamos la account_id vinculada a la API Key ignorando la que venga en el body por seguridad
    upserted = await IngestionService.process_trades(db, api_key_record.account_id, request.trades)
    
    return {
        "status": "success",
        "account_id": api_key_record.account_id,
        "received": len(request.trades),
        "upserted": upserted
    }

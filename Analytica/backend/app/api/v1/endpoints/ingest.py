from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.schemas.ingest import IngestRequest
from app.services.ingestion import IngestionService

router = APIRouter(prefix="/ingest", tags=["Ingestion"])

@router.post("/mt5", status_code=status.HTTP_200_OK)
async def ingest_mt5_data(request: IngestRequest, db: AsyncSession = Depends(get_db)):
    """
    Ingests trades from MT5 platform.
    Performs UPSERT on account_id and external_ticket_id.
    """
    upserted = await IngestionService.process_trades(db, request.account_id, request.trades)
    
    if upserted is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trading account {request.account_id} not found."
        )
    
    return {
        "status": "success",
        "received": len(request.trades),
        "upserted": upserted
    }

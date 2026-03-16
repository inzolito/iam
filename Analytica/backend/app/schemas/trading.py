from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


class TradingAccountBase(BaseModel):
    name: str = Field(..., example="Mi Cuenta Principal")
    platform: str = Field("MT5", example="MT5")
    currency: str = Field("USD", example="USD")
    balance_initial: float = Field(0.0, example=1000.0)


class TradingAccountCreate(TradingAccountBase):
    broker_server: str = Field(..., example="ICMarkets-Demo")
    mt5_login: str = Field(..., example="8472910")


class TradingAccountSchema(TradingAccountBase):
    id: UUID
    user_id: UUID
    connection_type: str = "PASSIVE"
    created_at: datetime
    broker_server: Optional[str] = None
    mt5_login: Optional[str] = None

    class Config:
        from_attributes = True


class SetInvestorPasswordRequest(BaseModel):
    investor_password: str


class TradingAccountLinkResponse(BaseModel):
    account: TradingAccountSchema
    client_id: str
    client_secret: str  # Solo se muestra una vez al crear
    ingest_url: str = (
        "https://analytica-backend-419965139801.us-central1.run.app/api/v1/ingest/mt5"
    )


class TradingAccountLinkDirectRequest(BaseModel):
    account_number: str = Field(..., example="8472910")
    broker_server: str = Field(..., example="ICMarkets-Demo")
    investor_password: str = Field(..., example="inv_pass_123")
    currency: str = Field("USD", example="USD")
    balance_initial: float = Field(0.0, example=10000.0)


class TradingAccountLinkDirectResponse(BaseModel):
    account: TradingAccountSchema
    message: str = (
        "Cuenta vinculada. La contraseña de inversor fue cifrada y almacenada de forma segura."
    )

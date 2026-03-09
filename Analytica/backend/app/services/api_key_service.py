import secrets
import hashlib
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.database import ApiKey

def generate_client_id() -> str:
    """Genera un Client ID público con prefijo AN-."""
    return f"AN-{secrets.token_hex(8).upper()}"

def generate_client_secret() -> str:
    """Genera un Client Secret (API Key) aleatorio."""
    return secrets.token_urlsafe(32)

def hash_secret(secret: str) -> str:
    """Hashea el secret para guardarlo en la DB."""
    return hashlib.sha256(secret.encode()).hexdigest()

async def create_api_key(db: AsyncSession, account_id: UUID):
    """Crea una nueva API Key para la cuenta y devuelve el secret en texto plano (una sola vez)."""
    client_id = generate_client_id()
    secret = generate_client_secret()
    hashed_secret = hash_secret(secret)
    
    new_key = ApiKey(
        account_id=account_id,
        client_id=client_id,
        hashed_secret=hashed_secret
    )
    
    db.add(new_key)
    # El commit se manejará en el router de la cuenta
    return client_id, secret

async def verify_api_key(db: AsyncSession, client_id: str, secret: str) -> bool:
    """Verifica si el par client_id/secret es válido."""
    from sqlalchemy.future import select
    result = await db.execute(select(ApiKey).where(ApiKey.client_id == client_id))
    api_key = result.scalars().first()
    
    if not api_key:
        return False
        
    return api_key.hashed_secret == hash_secret(secret)

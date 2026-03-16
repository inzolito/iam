from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

# Cargar .env si existe (busca en la raíz del backend)
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
load_dotenv(env_path)

# Obtener URL desde variable de entorno o construirla
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    user = os.getenv("DB_USER", "postgres")
    pw = os.getenv("DB_PASSWORD", "postgres")
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    db = os.getenv("DB_NAME", "analytica")
    
    # Soporte para Sockets Unix (Cloud Run -> Cloud SQL)
    if host.startswith("/"):
        DATABASE_URL = f"postgresql+asyncpg://{user}:{pw}@/{db}?host={host}"
    else:
        DATABASE_URL = f"postgresql+asyncpg://{user}:{pw}@{host}:{port}/{db}"

engine = create_async_engine(DATABASE_URL, echo=True)
async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    async with async_session() as session:
        yield session

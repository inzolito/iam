import asyncio
from app.core.db import engine
from app.models.database import Base

async def init_db():
    async with engine.begin() as conn:
        # Crea las tablas si no existen
        await conn.run_sync(Base.metadata.create_all)
    print("Base de datos sincronizada con éxito.")

if __name__ == "__main__":
    asyncio.run(init_db())

import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

# Try to load .env
load_dotenv(r"c:\www\Analytica\backend\.env")

async def test_conn():
    user = os.getenv("DB_USER")
    pw = os.getenv("DB_PASSWORD")
    host = os.getenv("DB_HOST")
    port = os.getenv("DB_PORT")
    db = os.getenv("DB_NAME")
    
    url = f"postgresql+asyncpg://{user}:{pw}@{host}:{port}/{db}"
    print(f"Connecting to: {host}:{port}...")
    
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print("Connection SUCCESS:", result.scalar())
    except Exception as e:
        print("Connection FAILED:", e)
    finally:
        await engine.dispose()

if __name__ == "__main__":
    asyncio.run(test_conn())

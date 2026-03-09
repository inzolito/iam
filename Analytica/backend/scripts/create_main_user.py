import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add the project root to sys.path to import our app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.models.database import User
from app.core.security import get_password_hash

load_dotenv()

# We use the synchronous driver for this standalone script to avoid greenlet/asyncio issues on Windows
# DATABASE_URL in .env has asyncpg, so we manually override here for sync access
SYNC_DATABASE_URL = "postgresql://postgres:AnalyticaRootPW123!@34.55.159.178:5432/analytica"

engine = create_engine(SYNC_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def create_main_user():
    email = "maikol.salas.m@gmail.com"
    password = "Singluten2!"
    password_hash = get_password_hash(password)

    db = SessionLocal()
    try:
        # Check if user already exists
        existing_user = db.query(User).filter(User.email == email).first()
        
        if existing_user:
            print(f"Usuario {email} ya existe en la base de datos.")
            return

        new_user = User(
            email=email,
            password_hash=password_hash
        )
        db.add(new_user)
        db.commit()
        print(f"Usuario msalas creado con éxito en Cloud SQL")
    except Exception as e:
        db.rollback()
        print(f"Error al crear usuario: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_main_user()

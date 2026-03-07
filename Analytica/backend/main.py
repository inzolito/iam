from fastapi import FastAPI
from app.api.v1.endpoints import ingest, auth

app = FastAPI(
    title="Analytica API",
    description="Institutional Trading Analytics Dashboard Backend",
    version="1.0.0"
)

# Include Routers
app.include_router(ingest.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])

@app.get("/")
async def root():
    return {"message": "Analytica API is online", "docs": "/docs"}

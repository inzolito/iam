# Analytica Versioning

## Current Version: v0.1.0 (Alpha) - "The Cloud Core & Auth"

### Snapshot of Built Components
- **Frontend (v0.1.0):**
    - Next.js 14+ / Tailwind CSS v3.
    - Glassmorphism Landing & Login Page.
    - Interactive Constellation Background (Canvas API).
    - Responsive layout for Institutional Dashboard.
    - Deployed on Google Compute Engine (IP: 136.112.172.165).
- **Backend (v0.1.0):**
    - FastAPI Framework.
    - Secure Auth System: Native Bcrypt hashing + JWT Sessons.
    - Database Engine: SQLAlchemy (Async for App, Sync for Scripts).
    - MT5 Ingest Endpoint (Validated schema).
    - Deployed on Google Cloud Run.
- **Infrastructure & Data:**
    - Google Cloud SQL: PostgreSQL 15 Instance (`analytica-db`).
    - Alembic Migrations: Fully applied agnostic schema.
    - Master User: `msalas` successfully injected.
- **Environment:**
    - Unified `.env` management.
    - Automated deployment scripts for VM environments.

---
*Roadmap: Alpha versions (0.x) will continue until full trading logic integration. Version 1.0 will mark the functional Institutional Launch.*

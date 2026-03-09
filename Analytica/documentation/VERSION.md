# Analytica Versioning

## Current Version: v0.4.0 — "MetaAPI Sync Engine"

### Changelog v0.4.0 (2026-03-09)
- **Sincronización MetaAPI completa**:
    - Nuevo servicio `metaapi_sync.py`: descifra contraseña de inversor, conecta a MetaAPI Cloud, descarga historial de deals de los últimos 90 días, empareja ENTRY/EXIT por `positionId` (mismo algoritmo que el EA), inserta en tabla `trades` via upsert en `external_ticket_id`.
    - APScheduler integrado en FastAPI: job `sync_all_direct_accounts` cada 6 horas automático.
    - Endpoint `POST /api/v1/accounts/sync/{account_id}` para sincronización manual.
    - MetaAPI account ID persiste en `connection_details.metaapi_account_id` para reutilizar en syncs futuros.
    - `METAAPI_TOKEN` configurado como env var en Cloud Run.
- **Dashboard UX**:
    - Estado DIRECT+0 trades: botón "Sincronizar ahora" en lugar de spinner estático; muestra resultado y recarga métricas automáticamente tras sync exitoso.
- **Dependencias**: `metaapi-cloud-sdk`, `apscheduler` añadidos a `requirements.txt`.

---

## v0.3.0 — "Conexión Directa MT5"

### Changelog v0.3.0 (2026-03-09)
- **Conexión Directa MT5 (COMPLETO)**:
    - Backend: campo `investor_password_encrypted` (AES-256-GCM) en `trading_accounts`; Alembic migration v2 aplicada.
    - Backend: `POST /api/v1/accounts/link-direct` — cifra y guarda la contraseña, nunca la retorna.
    - Frontend `/connect`: tab switcher "Ingesta Pasiva / Conexión Directa"; formulario con número de cuenta, servidor y contraseña de inversor (input password con ojo show/hide); disclaimer de solo lectura; success state con mensaje de seguridad.
    - Deploy: backend (Cloud Run) + frontend (VM) actualizados.

---

## v0.2.0 — "Dashboard MVP: Stats Core"

### Changelog v0.2.0 (2026-03-09)
- **1.3 Profit vs Loss Promedio (COMPLETO)**:
    - Backend: `avg_win`, `avg_loss`, `rr_ratio` calculados en `StatsService.get_account_stats()`.
    - Schema `AccountStatsResponse` actualizado con todos los campos de Fase 1.
    - Frontend: KpiCards "Ganancia Prom." (verde) y "Pérdida Prom." (rojo) con badge R:R en el dashboard.
- **Bug fixes (login + dashboard auth)**:
    - Login page: redirect automático a `/dashboard` si ya existe token JWT válido.
    - Dashboard: todos los fetch calls envían `Authorization: Bearer` header; 401 redirige a login.

---

## v0.1.0 (Alpha) — "The Cloud Core & Auth" (2026-03-08)

### Snapshot of Built Components
- **Frontend (v0.1.0):**
    - Next.js 14+ / Tailwind CSS v3.
    - Glassmorphism Landing & Login Page.
    - Interactive Constellation Background (Canvas API).
    - Responsive layout for Institutional Dashboard.
    - Deployed on Google Compute Engine (IP: 136.112.172.165).
- **Backend (v0.1.0):**
    - FastAPI Framework.
    - Secure Auth System: Native Bcrypt hashing + JWT Sessions.
    - Database Engine: SQLAlchemy (Async for App, Sync for Scripts).
    - MT5 Ingest Endpoint (Validated schema).
    - Deployed on Google Cloud Run.
- **Infrastructure & Data:**
    - Google Cloud SQL: PostgreSQL 15 Instance (`analytica-db`).
    - Alembic Migrations: Fully applied agnostic schema.
    - Master User: `maikol.salas.m@gmail.com` successfully injected.
- **Environment:**
    - Unified `.env` management.
    - Automated deployment scripts for VM environments.

---
*Roadmap: Alpha versions (0.x) will continue until full trading logic integration. Version 1.0 will mark the functional Institutional Launch.*

# Historial de Versiones — Analytica

> Formato de versión: `MAJOR.MINOR.PATCH`
> - **MAJOR**: Refactorizaciones completas o cambios de arquitectura
> - **MINOR**: Nuevas funcionalidades o secciones del dashboard
> - **PATCH**: Fixes, ajustes de prompts, mejoras menores

---

## v0.6.1 — 2026-03-17 — IA: Análisis profundo + botón persistente

### Cambios
- **`backend/app/services/ai_analytic_service.py`** — Prompts completamente reescritos con análisis cuantitativo profundo:
  - Pre-calcula métricas no visibles en el dashboard antes de llamar a Gemini:
    - `duration_bias` por par: detecta si el sistema corta ganadores antes que perdedores (`avg_win_duration_h` vs `avg_loss_duration_h`)
    - `side_bias` por par: detecta si BUY supera a SELL o viceversa (`avg_buy_pnl` vs `avg_sell_pnl`)
    - `loss_clusters`: rachas de 3+ pérdidas consecutivas (señal de régimen adverso)
    - `close_reason` por símbolo: distingue si el problema es entrada o gestión
  - Análisis de sesiones detecta: degradación silenciosa (delta win_rate y avg_pnl vs histórico), trampa de volumen (sobreoperación con baja calidad)
  - Análisis de heatmap filtra slots con `reliable: false` (< 4 trades = ruido estadístico), identifica `consistently_bad_in_both` (slots malos en período E histórico)
  - Instrucción explícita al modelo: "NO repitas lo visible en los datos — encuentra patrones ocultos"
- **`frontend/src/components/dashboard/AIAnalysisAudit.tsx`**:
  - Botón ahora siempre visible (nunca desaparece tras generar análisis)
  - Al cambiar temporalidad o cuenta se resetea automáticamente el resultado (via `useEffect`)
  - Botón muestra "↺ Re-analizar" cuando ya hay un resultado previo
  - Eliminado botón "Cerrar" redundante
- **Infraestructura**: modelo Gemini actualizado a `gemini-2.5-flash` (más capaz, disponible en proyecto con billing)

---

## v0.6.0 — 2026-03-16 — IA: Activación en producción

### Contexto
La feature de IA estaba implementada localmente pero no funcionaba en producción por dos bloqueos:
1. API key de AI Studio con `limit: 0` en free tier (proyecto con billing previamente activado/desactivado)
2. API `generativelanguage.googleapis.com` deshabilitada en el proyecto GCP `maikbottrade`

### Resolución
- Creada nueva API key desde Google Cloud Console (proyecto `maikbottrade`, ID `419965139801`)
- Habilitada la API `Generative Language API` en el proyecto
- Actualizada variable de entorno `GEMINI_API_KEY` en Cloud Run
- Modelo cambiado de `gemini-2.0-flash-lite` (no disponible para nuevos usuarios) a `gemini-2.5-flash`

### Archivos
- **`backend/app/services/ai_analytic_service.py`**: modelo `gemini-2.5-flash`
- **Cloud Run**: `analytica-backend` con nueva `GEMINI_API_KEY`

---

## v0.5.4 — 2026-03-16 — IA: 3 análisis diferenciados

### Cambios
- **`backend/app/services/ai_analytic_service.py`** — Reescritura completa con 3 métodos distintos:
  - `analyze_symbols`: análisis de entradas por par, correlación con noticias macro, pares a favorecer/evitar
  - `analyze_sessions`: período actual vs histórico completo — mejores/peores sesiones, recomendación de activación del bot
  - `analyze_heatmap`: horas doradas, horas a evitar, patrón semanal, horario concreto recomendado para el bot
  - Helper `_get_macro()`: obtiene eventos macro del período con filtro condicional (evita error SQLAlchemy con `None`)
  - Helper `_heatmap_summary()`: ordena y formatea top/bottom slots del heatmap
- **`backend/app/api/v1/endpoints/trading.py`**: endpoint `POST /analyze-performance/{account_id}` con query param `analysis_type` (symbols | sessions | heatmap)
- **`frontend/src/components/dashboard/AIAnalysisAudit.tsx`** — Componente nuevo completo:
  - Interfaces tipadas: `SymbolsResult`, `SessionsResult`, `HeatmapResult`
  - Renderers por tipo: `SymbolsReport`, `SessionsReport`, `HeatmapReport`
  - Sub-componentes compartidos: `SummaryCard`, `InfoCard`, `TagList`, `SuggestionsList`
- **`frontend/src/app/dashboard/page.tsx`**: 3 botones de IA colocados en sus secciones:
  - Análisis de Símbolos → `analysisType="symbols"`
  - Dinámica de Sesiones → `analysisType="sessions"`
  - Mapa de Calor → `analysisType="heatmap"`

---

## v0.5.3 — 2026-03-16 — Fix: SQLAlchemy None-date + modelo Gemini

### Problemas resueltos
- **SQLAlchemy `ArgumentError`**: filtros `>= None` lanzaban error cuando dateFrom/dateTo eran null (filtro "todo el tiempo"). Corregido con construcción condicional de filtros:
  ```python
  filters = []
  if date_from: filters.append(func.date(...) >= date_from)
  if date_to:   filters.append(func.date(...) <= date_to)
  ```
- **Modelo deprecado**: `gemini-2.0-flash-lite-preview-02-05` → `gemini-2.0-flash` → `gemini-2.0-flash-lite` (iteraciones hasta encontrar modelo disponible en free tier)

---

## v0.5.2 — 2026-03-16 — Feat: AI Audit inicial (Gemini)

### Nuevos archivos
- **`backend/app/services/ai_analytic_service.py`**: servicio `AIAnalyticService` con llamada a Gemini API
- **`backend/app/services/macro_service.py`**: ingestión de eventos macro desde RSS (Investing.com), scheduler cada 30 min
- **`backend/app/models/database.py`**: tablas `MacroEvent` y `AIAnalysisReport`
- **`backend/alembic/versions/36df710865ae_add_ai_analysis_fields_and_report_table.py`**: migración aplicada en producción
- **`backend/alembic/versions/921a65135c87_add_macro_events_table.py`**: migración tabla macro events
- **`frontend/src/components/dashboard/AIAnalysisAudit.tsx`**: componente botón de análisis IA (versión inicial)
- **`frontend/src/components/dashboard/CollapsibleSection.tsx`**: secciones colapsables en dashboard
- **`frontend/src/components/dashboard/DateFilterBar.tsx`**: barra de filtro de fechas
- **`frontend/src/components/dashboard/OpenPositions.tsx`**: posiciones abiertas en tiempo real
- **`frontend/src/contexts/`**: contexto `DateFilterContext` para filtro de período global
- **`frontend/src/config.ts`**: `API_BASE` centralizado (`NEXT_PUBLIC_API_URL` o Cloud Run URL por defecto)

### Infraestructura
- Backend: Google Cloud Run (`analytica-backend-419965139801.us-central1.run.app`)
- Frontend: Docker en VM `analytica-frontend-vm` (us-central1-a), accesible en `http://136.112.172.165`
- Builds: `gcloud builds submit` (sin Docker local)

---

## v0.5.1 — 2026-03-15 — Fix: BalanceHero + 6 bugs dashboard

### Cambios
- **`frontend/src/components/dashboard/BalanceHero.tsx`**: balance actual prominente como primera vista
- **Fix `balance_initial`**: derivado correctamente desde broker MetaAPI (no desde DB)
- **6 bugs corregidos**: header status incorrecto, duplicados en lista de cuentas, scroll bloqueado, balance incorrecto, rutas rotas, responsive en móvil

---

## v0.5.0 — 2026-03-14 — Phase 2-4: Analytics completo

### Nuevas secciones del dashboard
- **Phase 2 Metrics**: Profit Factor, Max Drawdown (USD + %), Rachas (win/loss streak + activa), Expected Payoff, duración promedio, impacto de costos (comisiones + swaps), gross profit/loss
- **Phase 3**: Z-Score (aleatoriedad de trades), Sharpe Ratio, SQN con rating
- **Phase 4**: Monte Carlo (1000 simulaciones, percentiles 5/50/95, probabilidad de ruina), Recovery Factor
- **SessionChart**: PnL por sesión Asia/Londres/NY/Overlap con barras
- **HeatmapChart**: mapa de calor 7×24 (día/hora) con intensidad de color
- **HoldingTimeScatter**: dispersión duración vs PnL
- **CalendarView**: vista mensual de PnL diario
- **CorrelationMatrix**: correlación entre pares operados
- **AssetRanking**: Top 5 / Bottom 5 por PnL con barras proporcionales

---

## v0.4.0 — 2026-03-10 — MetaAPI sync + Dashboard MVP

### Hitos
- Sincronización de historial de trades via MetaAPI
- Dashboard MVP completo con métricas Phase 1
- Conexión directa MT5 (broker server + login)
- SSE (Server-Sent Events) para equity en tiempo real y posiciones abiertas
- Autenticación JWT completa

---

## v0.3.0 — 2026-03-05 — Cloud Core & Auth

### Hitos
- Despliegue inicial en Google Cloud Run (backend FastAPI)
- Sistema de autenticación seguro (JWT + bcrypt)
- Base de datos PostgreSQL en Cloud SQL
- Frontend Next.js 14 en VM con Docker

---

## v0.1.0 — Estructura inicial

- Estructura base del proyecto (FastAPI + Next.js + SQLAlchemy async)
- Configuración de entornos y variables de entorno
- Modelos iniciales: `User`, `TradingAccount`, `Trade`

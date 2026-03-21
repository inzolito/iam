# Analytica — Changelog

## v1.2.0 — Dashboard inteligente y correcciones críticas
> Sesión de trabajo: 20–21 Mar 2026

### Correcciones de dashboard
- **Pantalla de sync bloqueante** — El dashboard se quedaba atascado mostrando "Sincroniza tu historial" cuando el filtro era "Hoy" y no había trades cerrados ese día. Se separó la lógica: `totalTradesEver` consulta stats sin filtro de fecha para saber si la cuenta tiene historial real, independiente del período seleccionado.
- **Fallback a datos históricos** — Cuando el período filtrado no tiene trades cerrados, `fetchStats` detecta `total_trades === 0` y reintenta automáticamente sin filtro, mostrando siempre el historial completo.
- **PnL en BalanceHero** — Mostraba 0 cuando el filtro "Hoy" no tenía trades. Ahora calcula `liveEquity − balanceGeneral` para mostrar el PnL flotante real de posiciones abiertas.
- **Posiciones abiertas** — Se sacaron del bloque condicional de trades cerrados. Ahora siempre se renderizan independientemente del filtro de fecha.
- **Disco lleno en VM** — El pull de Docker fallaba por falta de espacio. Se limpió con `docker system prune -af` (liberó ~5 GB). Se instaló nginx como proxy reverso (puerto 80 → 3000) con inicio automático.

---

## v1.1.0 — Features principales del dashboard
> Sesión de trabajo: 18–19 Mar 2026

### Infraestructura y deploy
- **Script `deploy.ps1`** — Automatiza git commit + push → Cloud Build backend → Cloud Run deploy → Cloud Build frontend → VM update. Compatible con PowerShell 5.x (sin `&&`).
- **ENCRYPTION_KEY en Cloud Run** — Faltaba la variable de entorno, causando error 500 en todas las vinculaciones de cuenta. Configurada vía `gcloud run services update`.
- **METAAPI_TOKEN en Cloud Run** — Variable vacía deshabilitaba el scheduler de sync y el enriquecimiento de broker servers.

### Cuentas
- **Alias al crear cuenta** — Campo `alias` en el formulario `/connect`. Se guarda como nombre de la cuenta en lugar de `MT5-{número}`.
- **Renombrar cuentas** — Ícono de lápiz en hover dentro de `/dashboard/accounts`. Edición inline con Enter/Escape. Endpoint `PATCH /api/v1/accounts/{id}/rename`.
- **Cuenta predeterminada** — Botón de estrella en `/dashboard/accounts`. Persiste en `localStorage` como `analytica_default_account`.

### Navbar y selector de cuentas
- **AccountContext** — Contexto React compartido entre Navbar y Dashboard. Carga cuentas una sola vez, mantiene `selectedAccount` y `setSelectedAccount`.
- **Selector en navbar** — Muestra nombre y plataforma de la cuenta activa. Dropdown con lista de cuentas si hay más de una. Reemplaza los tabs del dashboard.

### Dashboard principal
- **Filtro por defecto "Hoy"** — `DateFilterContext` inicializa con `period = "today"` en lugar de `"all"`.
- **Sesiones de mercado** (`MarketSessions.tsx`) — Widget con las 4 sesiones principales (Tokyo, Londres, NY, Sydney) basado en UTC. Muestra estado abierto/cerrado, countdown hasta apertura o cierre, y detección de fin de semana. Actualización cada segundo.
- **Posiciones abiertas** (`OpenPositions.tsx`) — Tabla con polling en vivo cada 3 segundos al endpoint `GET /api/v1/trading/live/{account_id}`. Incluye dirección (COMPRA/VENTA), lote, precio entrada, precio actual, SL, TP, PnL en USD y %.
- **Barra SL/TP proporcional** — Componente `PriceBar` dentro de `OpenPositions`. Muestra el progreso del precio actual entre SL y TP como barra horizontal. Verde si PnL ≥ 0, rojo si PnL < 0. Marcador de entrada (línea delgada) y marcador actual (punto) con `transition-all duration-1000`.
- **Stats compactas** — 4 cards en una fila (`grid-cols-4`): Win Rate, Profit Factor, R:R, Max Drawdown. Estilo `bg-white/5` minimalista, reemplaza la lista desplegable anterior.
- **BalanceHero más compacto** — Padding reducido (`p-4 md:p-5`), tipografía más pequeña (`text-2xl md:text-3xl`). Muestra equity en vivo con badge "En vivo" cuando MetaAPI responde.
- **Historial de operaciones** (`TradeHistory.tsx`) — Tabla paginada (50 por página) con filtros de fecha propios, columnas ordenables, filas expandibles (ticket, comisión, swap, comentario) y totales en pie de tabla. Colapsable, cerrado por defecto.
- **Polling de posiciones** — `setInterval` de 3 segundos en `page.tsx` al endpoint `/live/{account_id}?token=...`. Actualiza equity y posiciones sin recargar la página.

### Backend
- **`GET /api/v1/trading/live/{account_id}`** — Endpoint REST para polling. Autentica por query param `token`, retorna `{ equity, positions }` desde MetaAPI en tiempo real.
- **SL/TP en posiciones** — `fetch_live_data` en `metaapi_sync.py` ahora incluye `sl` y `tp` en cada posición.
- **`GET /api/v1/trading/history/{account_id}`** — Historial paginado con soporte de filtros `date_from`, `date_to`, `sort_by`, `sort_dir`, `page`, `page_size`.

---

## v1.0.0 — Base del proyecto
> Sesión inicial

### Stack
- **Backend**: FastAPI + SQLAlchemy async + PostgreSQL (Cloud SQL) + MetaAPI SDK
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS + Framer Motion
- **Infraestructura**: Google Cloud Run (backend) + Compute Engine VM con Docker + nginx (frontend)
- **Auth**: JWT con `python-jose`, contraseñas de investor cifradas con AES-256-GCM

### Features base
- Registro y login de usuarios
- Vinculación de cuentas MT5 vía MetaAPI (DIRECT) o API Key (PASSIVE)
- Sincronización de historial de trades
- Dashboard con: curva de equity, estadísticas generales, análisis por símbolo, análisis por sesión, mapa de calor, métricas de riesgo (Sharpe, Z-Score, SQN, drawdown), Monte Carlo, calendario de resultados, análisis IA con Gemini
- Correlación entre símbolos
- Modo claro/oscuro
- Soporte multi-cuenta

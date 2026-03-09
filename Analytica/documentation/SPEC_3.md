# Analytica: Plan Detallado de Implementación (SPEC)

> **Versión del documento**: 1.0  
> **Basado en**: PROJECT_REPORT, BACKLOG, DATABASE, API_REFERENCE, METRICS_DICTIONARY, INFRASTRUCTURE, MT5_CONFIG_GUIDE  
> **Estado actual del proyecto**: v0.1.0 Alpha — Auth + Ingesta Pasiva + Layout Dashboard  

---

## 0. Contexto y Estado Actual

### Lo que ya está construido
| Componente | Estado | Tecnología |
|---|---|---|
| Auth (Login/JWT) | ✅ Completo | FastAPI + Bcrypt + JWT |
| Landing Page | ✅ Completo | Next.js 14 + Tailwind |
| Dashboard Layout | ✅ Completo | Next.js 14 (institucional) |
| Ingesta Pasiva MT5 | ✅ Completo | API Key + MQL5 Script |
| Base de datos | ✅ Completo | PostgreSQL 15 en Cloud SQL |
| Despliegue GCP | ✅ Completo | Cloud Run + VM + Cloud SQL |
| Net Profit / Win Rate | ✅ Completo | Endpoint `/stats/{account_id}` |

### Lo que falta construir (todo el SPEC)
26 features distribuidas en 4 niveles de madurez del producto.

---

## FASE 1 — Completar el MVP (Nivel 1)

**Objetivo**: Cerrar el tablero de mandos básico. El usuario debe ver una foto completa de su cuenta al entrar al dashboard.  
**Estimación total**: ~2 semanas de desarrollo.

---

### 1.3 — Profit vs Loss Promedio

**Qué es**: Dos KPIs lado a lado: ganancia promedio por trade ganador y pérdida promedio por trade perdedor.  
**Por qué importa**: Revela el ratio R:R real ejecutado. Un Win Rate del 40% puede ser rentable si el promedio ganador es 3x el perdedor.

#### Backend
- **Endpoint a modificar**: `GET /api/v1/trading/stats/{account_id}`
- **Lógica a agregar** en el servicio de estadísticas:
  ```python
  avg_win = AVG(net_profit) WHERE net_profit > 0
  avg_loss = AVG(net_profit) WHERE net_profit < 0
  rr_ratio = abs(avg_win / avg_loss)  # Ratio R:R ejecutado
  ```
- **Campos nuevos en la respuesta JSON**:
  ```json
  {
    "avg_win": 45.30,
    "avg_loss": -22.10,
    "rr_ratio": 2.05
  }
  ```

#### Frontend
- **Componente**: Dos tarjetas KPI en el dashboard principal.
  - Tarjeta verde: "Ganancia Promedio" con ícono de flecha arriba.
  - Tarjeta roja: "Pérdida Promedio" con ícono de flecha abajo.
  - Ratio R:R como badge entre las dos tarjetas.
- **Ubicación en el layout**: Fila de KPIs superior, junto a Net Profit y Win Rate.

---

### 1.4 — Cantidad de TP y SL

**Qué es**: Conteo de cuántas operaciones cerraron por Take Profit vs Stop Loss vs cierre manual.  
**Por qué importa**: Indica disciplina operativa. Un trader disciplinado cierra la mayoría por TP o SL, no manualmente.

#### Base de datos
- **Problema**: La tabla `trades` actual no tiene un campo `close_reason`.
- **Migración Alembic requerida**:
  ```sql
  ALTER TABLE trades ADD COLUMN close_reason VARCHAR(20);
  -- Valores posibles: 'TP', 'SL', 'MANUAL', 'UNKNOWN'
  ```
- **Script de backfill**: Los trades existentes quedan como `'UNKNOWN'`.

#### Ingesta MT5 (MQL5)
- El script `Analytica_Ingest.ex5` debe capturar el campo `reason` del historial de MT5:
  - `DEAL_REASON_TP` → `'TP'`
  - `DEAL_REASON_SL` → `'SL'`
  - `DEAL_REASON_CLIENT` → `'MANUAL'`
- **Payload de ingesta actualizado**:
  ```json
  { "ticket": 12345, "close_reason": "TP", ... }
  ```

#### Backend
- Agregar a `GET /stats/{account_id}`:
  ```json
  {
    "tp_count": 34,
    "sl_count": 18,
    "manual_count": 12,
    "tp_rate": 53.1
  }
  ```

#### Frontend
- **Componente**: Gráfico de dona (Donut Chart) con tres segmentos: TP / SL / Manual.
- **Librería sugerida**: Recharts (`PieChart` con `innerRadius`).

---

### 1.5 — Tabla de Pares (Básico)

**Qué es**: Tabla que desglosa el rendimiento por símbolo operado (XAUUSD, EURUSD, BTCUSDT, etc.).  
**Por qué importa**: Identifica qué activos generan dinero real y cuáles drenan el capital.

#### Backend
- **Endpoint nuevo**: `GET /api/v1/trading/by-symbol/{account_id}`
- **Query SQL**:
  ```sql
  SELECT 
    i.ticker,
    i.asset_class,
    COUNT(t.id) AS total_trades,
    SUM(t.net_profit) AS total_pnl,
    AVG(t.net_profit) AS avg_pnl,
    (COUNT(CASE WHEN t.net_profit > 0 THEN 1 END) * 100.0 / COUNT(*)) AS winrate
  FROM trades t
  JOIN instruments i ON t.instrument_id = i.id
  WHERE t.account_id = :account_id
  GROUP BY i.ticker, i.asset_class
  ORDER BY total_pnl DESC;
  ```

#### Frontend
- **Componente**: Tabla con columnas: Símbolo | Clase | # Trades | PnL Total | PnL Promedio | Win Rate.
- Fila coloreada: verde si PnL total > 0, roja si < 0.
- Ordenable por columna (click en header).
- **Ubicación**: Sección propia en el dashboard, debajo de los KPIs.

---

### 1.6 — Volumen Total

**Qué es**: Suma de lotes operados en el período seleccionado.  
**Por qué importa**: Indica la exposición total al mercado y permite calcular el costo por lote.

#### Backend
- Agregar a `GET /stats/{account_id}`:
  ```python
  total_volume = SUM(trades.volume)  # En lotes
  ```
- **Respuesta**:
  ```json
  { "total_volume_lots": 142.30 }
  ```

#### Frontend
- **Componente**: Tarjeta KPI simple. Mostrar en lotes con 2 decimales.
- Posición: Fila de KPIs principal.

---

### 1.7 — Equity Curve (Curva de Capital)

**Qué es**: Gráfico de línea que muestra la evolución del balance a lo largo del tiempo.  
**Por qué importa**: Es la métrica visual más importante. Una curva ascendente y suave indica consistencia.

#### Base de datos
- La tabla `daily_snapshots` ya existe con `balance_end` y `daily_pl`.
- **Problema**: No hay lógica que la pueble automáticamente.

#### Backend — Worker de Snapshots
- **Tarea**: Crear un proceso (puede ser un endpoint interno o un cron job en Cloud Run Jobs) que:
  1. Al recibir nuevos trades vía ingesta, calcula el balance del día.
  2. Inserta o actualiza el `daily_snapshot` del día actual.
  - `balance_end = balance_initial + SUM(net_profit hasta esa fecha)`
  - `daily_pl = SUM(net_profit WHERE date = today)`

- **Endpoint ya existente**: `GET /api/v1/trading/equity-curve/{account_id}`
- **Respuesta esperada**:
  ```json
  [
    { "date": "2025-01-01", "balance": 10000.00 },
    { "date": "2025-01-02", "balance": 10245.50 },
    ...
  ]
  ```

#### Frontend
- **Componente**: Gráfico de área (`AreaChart` de Recharts) con gradiente de color.
  - Eje X: Fechas.
  - Eje Y: Balance en divisa de la cuenta.
  - Tooltip con fecha + balance + PnL del día.
  - Línea de referencia horizontal: balance inicial (`balance_initial`).
- **Tamaño**: Componente grande, ocupa el ancho completo del dashboard.

---

### 1.8 — Trades Cerrados Manuales

**Qué es**: Conteo de operaciones cerradas manualmente por el trader (no por TP ni SL).  
**Por qué importa**: Alta cantidad de cierres manuales puede indicar falta de disciplina o miedo.

> **Nota**: Este dato se obtiene directamente del campo `close_reason = 'MANUAL'` implementado en el ítem 1.4. No requiere trabajo adicional de backend si 1.4 está completo.

#### Frontend
- **Componente**: Badge numérico dentro de la tarjeta de TP/SL (ítem 1.4), o KPI independiente.
- Mostrar porcentaje de cierres manuales sobre el total como indicador de alerta (>40% = naranja, >60% = rojo).

---

## FASE 2 — Beta 1: Eficiencia y Riesgo (Nivel 2)

**Objetivo**: Medir la calidad y sostenibilidad del sistema de trading.  
**Pre-requisito**: Fase 1 completamente implementada.  
**Estimación total**: ~3 semanas de desarrollo.

---

### 2.1 — Profit Factor

**Fórmula**: `Gross Profit / |Gross Loss|`

#### Backend
- Agregar a `GET /stats/{account_id}`:
  ```python
  gross_profit = SUM(net_profit) WHERE net_profit > 0
  gross_loss = ABS(SUM(net_profit) WHERE net_profit < 0)
  profit_factor = gross_profit / gross_loss  # Evitar división por 0
  ```
- Respuesta: `{ "profit_factor": 1.87 }`

#### Frontend
- KPI con semáforo de color:
  - Rojo: `< 1.0` (sistema perdedor)
  - Amarillo: `1.0 - 1.5` (marginal)
  - Verde: `> 1.5` (saludable)

---

### 2.2 — Max Drawdown

**Fórmula**: Mayor caída porcentual desde un pico de equity hasta el siguiente valle.

#### Backend
- **Lógica** (calcular sobre la serie de `daily_snapshots`):
  ```python
  peak = balance_inicial
  max_dd = 0
  for snapshot in snapshots_ordenados_por_fecha:
      if snapshot.balance > peak:
          peak = snapshot.balance
      dd = (peak - snapshot.balance) / peak * 100
      if dd > max_dd:
          max_dd = dd
  ```
- Agregar al endpoint `/stats/`:
  ```json
  {
    "max_drawdown_pct": 8.34,
    "max_drawdown_usd": 834.00
  }
  ```

#### Frontend
- KPI con valor en % y en divisa.
- Indicador visual: barra de progreso roja mostrando el DD sobre el balance pico.

---

### 2.3 — Ratio R/B Real

**Qué es**: El ratio Riesgo/Beneficio promedio de las operaciones ejecutadas (no el planeado).  
**Fórmula**: `avg_win / abs(avg_loss)` — ya calculado en 1.3, exponer como KPI dedicado.

#### Backend
- Ya disponible desde 1.3. Solo necesita ser expuesto como campo nombrado `rr_ratio`.

#### Frontend
- Tarjeta KPI con descripción: "R:B Real Ejecutado".
- Ideal: mostrar comparación con el ratio planeado si el usuario lo configura.

---

### 2.4 — Rachas (Streaks)

**Qué es**: Racha máxima de operaciones ganadoras consecutivas y racha máxima de perdedoras.

#### Backend
- **Lógica** (requiere la lista de trades ordenada por fecha de cierre):
  ```python
  max_win_streak = 0
  max_loss_streak = 0
  current_win = 0
  current_loss = 0
  for trade in trades_ordenados:
      if trade.net_profit > 0:
          current_win += 1; current_loss = 0
          max_win_streak = max(max_win_streak, current_win)
      else:
          current_loss += 1; current_win = 0
          max_loss_streak = max(max_loss_streak, current_loss)
  ```
- Agregar al endpoint `/stats/`:
  ```json
  {
    "max_win_streak": 7,
    "max_loss_streak": 4,
    "current_streak": 3,
    "current_streak_type": "WIN"
  }
  ```

#### Frontend
- Dos badges: "🔥 Mejor racha ganadora: 7" y "❄️ Peor racha perdedora: 4".
- Badge de racha actual con indicador de tendencia.

---

### 2.5 — Expected Payoff (Expectancia)

**Fórmula**: `(WinRate * avg_win) + ((1 - WinRate) * avg_loss)`  
**Interpretación**: Cuánto espera ganar/perder en promedio por operación futura.

#### Backend
- Cálculo puro en Python con datos ya disponibles. Agregar a `/stats/`:
  ```json
  { "expected_payoff": 12.45 }
  ```
- Positivo = sistema con expectativa matemática positiva (imprescindible).

#### Frontend
- KPI con explicación breve en tooltip: "Ganancia esperada por cada trade futuro".
- Verde si > 0, rojo si < 0.

---

### 2.6 — Tiempo Promedio de Exposición

**Fórmula**: `AVG(trades.duration_seconds)` — campo ya disponible en la tabla `trades`.

#### Backend
- Agregar a `/stats/`:
  ```json
  {
    "avg_duration_seconds": 7200,
    "avg_duration_human": "2h 00m"
  }
  ```

#### Frontend
- KPI mostrando el tiempo en formato legible (ej: "2h 15m").

---

### 2.7 — Impacto de Costos

**Qué es**: Cuánto representan las comisiones y swaps del PnL bruto total.

#### Backend
- **Problema**: La tabla `trades` tiene `net_profit` pero no desglosa `commission` y `swap` por separado.
- **Migración Alembic requerida**:
  ```sql
  ALTER TABLE trades ADD COLUMN commission NUMERIC(10,2) DEFAULT 0;
  ALTER TABLE trades ADD COLUMN swap NUMERIC(10,2) DEFAULT 0;
  ALTER TABLE trades ADD COLUMN gross_profit NUMERIC(10,2);
  -- gross_profit = net_profit + |commission| + |swap|
  ```
- **Script MQL5** debe capturar estos campos desde `DEAL_COMMISSION` y `DEAL_SWAP`.
- Agregar a `/stats/`:
  ```json
  {
    "total_commission": -124.50,
    "total_swap": -34.20,
    "cost_impact_pct": 12.3
  }
  ```

#### Frontend
- Tarjeta con desglose: Comisiones | Swaps | Total costos | % del PnL bruto.

---

### 2.8 — Ranking de Activos (Top 5)

**Qué es**: Los 5 activos más rentables y los 5 menos rentables.

#### Backend
- Reutilizar el endpoint `GET /by-symbol/{account_id}` del ítem 1.5.
- En el frontend, simplemente tomar los primeros 5 y los últimos 5 de la lista ya ordenada.

#### Frontend
- **Componente**: Dos listas verticales side-by-side.
  - "🏆 Top 5 Activos" (verde, ordenados por PnL total DESC).
  - "⚠️ Bottom 5 Activos" (rojo, ordenados por PnL total ASC).
- Cada fila: Ticker + barra de progreso proporcional + PnL en divisa.

---

## FASE 3 — Beta 2: Psicología y Timing (Nivel 3)

**Objetivo**: Detectar patrones conductuales y optimizar el timing operativo.  
**Pre-requisito**: Fase 2 completamente implementada.  
**Estimación total**: ~4 semanas de desarrollo.

---

### 3.1 — Análisis por Sesión

**Qué es**: Rendimiento segmentado por sesión de mercado (Asia, Londres, Nueva York).

#### Backend
- **Migración**: Agregar campo `open_time TIMESTAMP WITH TIME ZONE` a la tabla `trades` si no existe.
- **Lógica de clasificación de sesión** (UTC):
  ```python
  def get_session(open_time_utc):
      hour = open_time_utc.hour
      if 0 <= hour < 8:   return 'ASIA'
      if 8 <= hour < 16:  return 'LONDON'
      if 13 <= hour < 22: return 'NEW_YORK'  # Overlap Londres-NY: 13-16 UTC
      return 'OFF_HOURS'
  ```
- **Endpoint nuevo**: `GET /api/v1/trading/by-session/{account_id}`
- **Respuesta**:
  ```json
  [
    { "session": "LONDON", "total_pnl": 1240.50, "winrate": 62.1, "trades": 45 },
    { "session": "NEW_YORK", "total_pnl": -320.00, "winrate": 38.5, "trades": 26 }
  ]
  ```

#### Frontend
- **Componente**: Gráfico de barras agrupadas (PnL + Win Rate por sesión).
- Indicador visual de "Tu mejor sesión" con badge destacado.

---

### 3.2 — Mapa de Calor (Heatmap)

**Qué es**: Grilla de 7 días × 24 horas mostrando el PnL promedio por celda.

#### Backend
- **Endpoint nuevo**: `GET /api/v1/trading/heatmap/{account_id}`
- **Query**: Agrupar trades por `day_of_week` y `hour_of_day` del `open_time`.
- **Respuesta**: Matriz `[dia][hora] = avg_pnl`.

#### Frontend
- **Componente**: Grilla HTML/CSS con colores de calor.
  - Verde oscuro = alta rentabilidad promedio.
  - Rojo = pérdida promedio.
  - Gris = sin operaciones.
- Tooltip al hover: "Lunes 14:00 UTC — Promedio: +$23.40 | 8 trades".

---

### 3.3 — MAE (Max Adverse Excursion)

**Qué es**: El máximo punto "en rojo" que soportó cada trade antes de cerrarse.

#### Base de datos
- El campo `mae_price` ya existe en la tabla `trades`. Solo necesita ser poblado por el script MQL5.
- **Campo calculado a agregar**: `mae_usd = (mae_price - open_price) * volume * contract_size * direction`

#### Backend
- Agregar a `/stats/`:
  ```json
  {
    "avg_mae_usd": -45.20,
    "max_mae_usd": -320.00
  }
  ```
- **Endpoint nuevo**: `GET /trades/{account_id}` ya devuelve trades individuales — incluir `mae_usd` en cada trade.

#### Frontend
- **Componente**: Scatter plot (dispersión) donde cada punto es un trade.
  - Eje X: MAE en USD.
  - Eje Y: PnL final del trade.
  - Patrón buscado: trades ganadores con MAE pequeño (buenas entradas).

---

### 3.4 — MFE (Max Favorable Excursion)

**Qué es**: El punto máximo de beneficio que alcanzó un trade antes de cerrarse.

> **Implementación idéntica a MAE** usando el campo `mfe_price`. Misma lógica, mismo tipo de visualización.

#### Frontend adicional
- **Eficiencia de salida**: `PnL capturado / MFE máximo * 100` — indica qué porcentaje del potencial máximo se capturó.
- Alerta si la eficiencia promedio es menor al 50% (el trader está dejando mucho dinero sobre la mesa).

---

### 3.5 — Holding Time vs Result

**Qué es**: Gráfico de dispersión correlacionando la duración de un trade con su resultado.

#### Backend
- Usar `duration_seconds` y `net_profit` de `trades`.
- **Endpoint**: Ya disponible en `GET /trades/{account_id}`. Solo necesita que el frontend procese estos dos campos.

#### Frontend
- **Componente**: Scatter plot.
  - Eje X: Duración en horas.
  - Eje Y: PnL del trade.
  - Color: Verde si ganador, rojo si perdedor.
- **Insight automático**: Calcular si hay correlación positiva, negativa, o ninguna. Mostrar mensaje: "Tus trades más largos tienden a ser más rentables".

---

### 3.6 — Z-Score

**Qué es**: Estadístico que mide si el resultado de un trade depende del anterior.

**Fórmula**:
```
Z = (N * (R - 0.5) - W) / sqrt(W * (N - W) / N)
Donde:
  N = total de trades
  R = número de rachas (cambios W→L o L→W)
  W = número de trades ganadores
```

#### Backend
- Cálculo puro en Python. Agregar a `/stats/`:
  ```json
  {
    "z_score": -1.82,
    "z_interpretation": "Leve dependencia negativa (tendencia a alternar W/L)"
  }
  ```
- Interpretación: Z < -1.96 = dependencia (rachas correlacionadas), Z > 1.96 = alternancia.

#### Frontend
- KPI con gauge o barra centrada en 0.
- Tooltip explicando la interpretación en lenguaje simple.

---

### 3.7 — Efficiency Ratio

**Qué es**: Mide la calidad de la entrada/salida comparada con el movimiento total del mercado.

**Fórmula**: `|close_price - open_price| / SUM(|price_movement_per_bar|)`

> **Nota técnica**: Este ratio requiere datos de precio barra a barra durante el trade, lo cual no está disponible actualmente en el schema. Se requiere una decisión de arquitectura: almacenar ticks/barras intermedias o calcular una aproximación usando `mae_price` y `mfe_price`.

#### Implementación aproximada (con datos actuales)
```python
efficiency = abs(close_price - open_price) / (mfe_price - mae_price)
```

#### Backend
- Agregar a `GET /stats/`:
  ```json
  { "avg_efficiency_ratio": 0.68 }
  ```
- Valor entre 0 y 1. Cercano a 1 = entradas/salidas casi perfectas.

---

## FASE 4 — V1.0 Institucional (Nivel 4)

**Objetivo**: Llevar Analytica al nivel de herramientas profesionales de prop firms.  
**Pre-requisito**: Fases 1, 2 y 3 completas.  
**Estimación total**: ~5 semanas de desarrollo.

---

### 4.1 — Sharpe Ratio

**Fórmula**: `(avg_daily_return - risk_free_rate) / std_daily_return`

#### Backend
- Usar `daily_snapshots.daily_pl` para calcular los retornos diarios.
- Usar tasa libre de riesgo = 0 (simplificación estándar para trading).
- ```python
  import numpy as np
  daily_returns = [s.daily_pl / s.balance_start for s in snapshots]
  sharpe = (np.mean(daily_returns) / np.std(daily_returns)) * sqrt(252)  # Anualizado
  ```
- Agregar a `/stats/`: `{ "sharpe_ratio": 1.94 }`

#### Frontend
- KPI con referencia: "< 1: Pobre | 1-2: Bueno | > 2: Excelente".
- Sistema de rangos institucionales se basa en este valor.

---

### 4.2 — Simulación Monte Carlo

**Qué es**: Genera 1,000 escenarios aleatorios reordenando los trades históricos para estimar la distribución de posibles resultados futuros.

#### Backend
- **Endpoint nuevo**: `POST /api/v1/trading/monte-carlo/{account_id}`
- **Parámetros**: `{ "simulations": 1000, "forward_trades": 100 }`
- **Lógica**:
  ```python
  results = []
  trade_pnls = [t.net_profit for t in historical_trades]
  for _ in range(1000):
      shuffled = random.sample(trade_pnls, forward_trades)
      equity_path = cumsum(shuffled)
      results.append({
          "final_balance": equity_path[-1],
          "max_drawdown": calculate_dd(equity_path)
      })
  return {
      "percentile_5": percentile(results.final_balances, 5),
      "percentile_50": percentile(results.final_balances, 50),
      "percentile_95": percentile(results.final_balances, 95),
      "ruin_probability": count(r for r in results if r.final_balance < 0) / 1000
  }
  ```

#### Frontend
- **Componente**: Gráfico de fan (múltiples líneas translúcidas) mostrando los 1,000 caminos.
- Líneas destacadas: percentil 5, 50 y 95.
- Badge: "Probabilidad de ruina: 3.2%".
- Botón de re-ejecutar simulación.

---

### 4.3 — Recovery Factor

**Fórmula**: `Net Profit / Max Drawdown`

#### Backend
- Datos ya disponibles desde 2.1 y 2.2. Cálculo trivial.
- Agregar a `/stats/`: `{ "recovery_factor": 3.24 }`
- Referencia: > 3 es considerado excelente.

#### Frontend
- KPI simple con referencia numérica y color semáforo.

---

### 4.4 — SQN (System Quality Number)

**Fórmula**: `(avg_trade / std_trade) * sqrt(N)` (Dr. Van Tharp)

#### Backend
```python
import numpy as np
pnls = [t.net_profit for t in trades]
sqn = (np.mean(pnls) / np.std(pnls)) * np.sqrt(len(pnls))
```
- Agregar a `/stats/`:
  ```json
  {
    "sqn": 2.45,
    "sqn_rating": "Bueno"
  }
  ```
- Escala: `< 1.6` Pobre | `1.6-1.9` Por debajo del promedio | `2.0-2.4` Promedio | `2.5-2.9` Bueno | `3.0-5.0` Excelente | `> 7.0` Santo Grial.

#### Frontend
- KPI con la escala visual de calificaciones.

---

### 4.5 — Correlación de Cartera

**Qué es**: Detecta si el usuario está sobre-expuesto a activos correlacionados simultáneamente.

#### Backend
- **Endpoint nuevo**: `GET /api/v1/trading/correlation/{account_id}`
- **Lógica**: Calcular matriz de correlación de PnL diario entre pares de instrumentos.
- Alertas si correlación > 0.8 entre dos activos operados simultáneamente.

#### Frontend
- **Componente**: Heatmap de correlación (matriz N×N de instrumentos).
- Alertas destacadas: "⚠️ EURUSD y GBPUSD tienen 89% de correlación. Estás duplicando riesgo."

---

### 4.6 — Calendario Interactivo

**Qué es**: Vista de calendario mensual donde cada día muestra el PnL de esa jornada.

#### Backend
- Reutilizar `daily_snapshots.daily_pl` — datos ya disponibles.
- **Endpoint**: `GET /api/v1/trading/calendar/{account_id}?year=2025&month=1`
- Respuesta: array de `{ date, daily_pl, trades_count }`.

#### Frontend
- **Componente**: Grid de 7 columnas (lunes a domingo).
- Cada celda: fecha + PnL del día coloreado (verde/rojo/gris).
- Click en una celda: muestra la lista de trades de ese día en un modal.
- Navegación por mes (anterior/siguiente).

---

### 4.7 — Tags Psicológicos

**Qué es**: Sistema que detecta patrones de comportamiento disfuncional: "Revenge Trading", "FOMO", "Overtrading".

#### Backend
- **Endpoint nuevo**: `GET /api/v1/trading/psychology/{account_id}`
- **Reglas de detección**:
  ```python
  # Revenge Trading: Trade perdedor seguido de trade de mayor volumen en < 30 min
  revenge = trades donde [i].net_profit < 0 AND
            trades[i+1].volume > trades[i].volume * 1.5 AND
            (trades[i+1].open_time - trades[i].close_time) < 30 minutos

  # Overtrading: Más de X trades en un día (configurable por usuario)
  overtrading_days = daily_snapshots donde trades_count > threshold

  # FOMO: Trade abierto > 2h después del inicio de una sesión con mayor volatilidad
  # (Requiere datos de volatilidad externos — implementación futura)
  ```

#### Frontend
- **Componente**: Panel "Alertas Psicológicas" con tarjetas de advertencia.
- Ejemplo: "⚠️ Detectamos 3 episodios de Revenge Trading en enero. El PnL después de estos episodios fue de -$340."
- No punitivo — framing educativo y analítico.

---

## Arquitectura de Filtros (Cross-cutting)

**Aplica a todas las fases.** El dashboard debe soportar filtrado dinámico en tiempo real.

### Filtros globales del dashboard
- **Rango de fechas**: Selector de rango (preset: Hoy, Semana, Mes, 3 Meses, Todo).
- **Cuenta**: Selector si el usuario tiene múltiples cuentas vinculadas.
- **Símbolo**: Filtrar solo trades de un instrumento específico.

### Implementación Backend
- Todos los endpoints de `/api/v1/trading/` deben aceptar query params:
  ```
  ?date_from=2025-01-01&date_to=2025-03-01&symbol=XAUUSD
  ```
- Modificar las queries SQL para incluir cláusulas `WHERE` dinámicas.

### Implementación Frontend
- Barra de filtros sticky en la parte superior del dashboard.
- Al cambiar cualquier filtro, re-fetchar todos los endpoints con los nuevos parámetros.
- Usar un estado global (React Context o Zustand) para los filtros activos.

---

## Sistema de Rangos (Gamificación)

### Lógica de asignación de rango

| Rango | Condición |
|---|---|
| **Bronze** | < 30 trades registrados |
| **Silver** | ≥ 30 trades AND Win Rate ≥ 45% |
| **Gold** | Silver AND Profit Factor ≥ 1.8 AND Max DD ≤ 15% |
| **Platinum** | Gold AND Sharpe Ratio ≥ 2.0 AND ≥ 3 meses de datos |

### Implementación
- **Backend**: Endpoint `GET /api/v1/trading/rank/{account_id}` que retorna el rango actual y las condiciones que faltan para el siguiente.
- **Frontend**: Badge de rango en el header del dashboard. Modal de "Progresión" mostrando el camino al siguiente nivel.

---

## Migraciones de Base de Datos Requeridas (Resumen)

| Migración | Fase | Campos |
|---|---|---|
| Agregar `close_reason` a `trades` | Fase 1 (1.4) | `VARCHAR(20)` |
| Agregar `commission`, `swap`, `gross_profit` a `trades` | Fase 2 (2.7) | `NUMERIC(10,2)` |
| Agregar `open_time TIMESTAMPTZ` a `trades` | Fase 3 (3.1) | Timestamp con timezone |
| Tabla `monte_carlo_results` (cache) | Fase 4 (4.2) | `account_id, run_at, results_json` |

---

## Endpoints API a Crear (Resumen)

| Endpoint | Fase | Método |
|---|---|---|
| `GET /trading/by-symbol/{account_id}` | 1.5 | GET |
| `GET /trading/by-session/{account_id}` | 3.1 | GET |
| `GET /trading/heatmap/{account_id}` | 3.2 | GET |
| `POST /trading/monte-carlo/{account_id}` | 4.2 | POST |
| `GET /trading/correlation/{account_id}` | 4.5 | GET |
| `GET /trading/calendar/{account_id}` | 4.6 | GET |
| `GET /trading/psychology/{account_id}` | 4.7 | GET |
| `GET /trading/rank/{account_id}` | Gamif. | GET |

---

## Estimación de Tiempos

| Fase | Duración estimada | Versión objetivo |
|---|---|---|
| Fase 1 — MVP completo | 2 semanas | v0.4.0 |
| Fase 2 — Beta 1 | 3 semanas | v0.6.0 |
| Fase 3 — Beta 2 | 4 semanas | v0.8.0 |
| Fase 4 — Institucional V1 | 5 semanas | v1.0.0 |
| **Total** | **~14 semanas** | |

---

## Reglas de Desarrollo

1. **Backend primero**: Nunca construir el componente frontend hasta que el endpoint retorne datos reales.
2. **Migración antes de código**: Cualquier campo nuevo en DB debe tener su migración Alembic generada y aplicada antes de escribir la lógica.
3. **MQL5 sincronizado**: Si el backend espera un campo nuevo del script de ingesta, actualizar el script antes de desplegar el backend.
4. **Un ítem a la vez**: Completar backend + frontend de un ítem antes de pasar al siguiente. No desarrollo paralelo de múltiples features sin sincronización.
5. **Filtros desde el inicio**: Todos los endpoints nuevos deben soportar filtros de fecha desde el día 1.

---

*Documento generado el 2026-03-08. Actualizar cuando se complete cada ítem del backlog.*

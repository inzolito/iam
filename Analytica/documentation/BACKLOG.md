# Analytica: Professional Backlog & Roadmap

## 🔵 Nivel 1: El MVP (Fundamentos - COMPLETO ✅)
*Objetivo: Establecer el tablero de mandos básico y la conectividad.*
- [x] **1.1 Net Profit / Loss**: Beneficio neto real (comisiones/swaps).
- [x] **1.2 Win Rate (%)**: Efectividad porcentual.
- [x] **1.3 Profit vs Loss Promedio**: Ratio de ganancia/pérdida media.
- [x] **1.4 Cantidad de TP y SL**: Conteo de objetivos automáticos alcanzados.
- [x] **1.5 Tabla de Pares (Básico)**: Rendimiento desglosado por símbolo.
- [x] **1.6 Volumen Total**: Lotes o unidades movidas.
- [x] **1.7 Equity Curve**: Gráfico lineal de salud del balance.
- [x] **1.8 Trades Cerrados Manuales**: Conteo de intervenciones del usuario.

## 🟡 Nivel 2: Beta 1 (Eficiencia y Riesgo - COMPLETO ✅)
*Objetivo: Medir la calidad y sostenibilidad de la operativa.*
- [x] **2.1 Profit Factor**: Relación beneficio bruto vs pérdida bruta.
- [x] **2.2 Max Drawdown**: Mayor caída histórica desde el pico (USD + %).
- [x] **2.3 Ratio R/B Real**: Riesgo/beneficio ejecutado (R:R ratio en KPI).
- [x] **2.4 Rachas (Streaks)**: Máximos de operaciones consecutivas (W/L) + racha activa.
- [x] **2.5 Expected Payoff**: Expectancia matemática por trade.
- [x] **2.6 Tiempo Promedio**: Duración media en mercado (human-readable).
- [x] **2.7 Impacto de Costos**: Comisiones + swaps vs PnL bruto (%).
- [x] **2.8 Ranking de Activos**: Top 5 / Bottom 5 por PnL con barras proporcionales.

## 🟠 Nivel 3: Beta 2 (Psicología y Timing - COMPLETO ✅)
*Objetivo: Detectar puntos ciegos conductuales y optimización temporal.*
- [x] **3.1 Análisis por Sesión**: PnL por sesión Asia/Londres/NY/Sydney (BarChart).
- [x] **3.2 Mapa de Calor**: PnL promedio 7×24 (día/hora) con intensidad de color.
- [ ] **3.3 MAE (Max Adverse Excursion)**: Máximo en contra aguantado. *(bloqueado: MetaAPI REST no devuelve MAE/MFE por deal — requiere SDK streaming o endpoint /metrics de MetaAPI. Campo `mae_price` existe en DB y se expone en API, pero sin datos. Pendiente cuando se integre fuente de datos)*
- [ ] **3.4 MFE (Max Favorable Excursion)**: Máximo a favor alcanzado. *(mismo bloqueo que 3.3)*
- [x] **3.5 Holding Time vs Result**: Scatter plot duración vs resultado (wins/losses).
- [x] **3.6 Z-Score**: Dependencia estadística entre trades con interpretación.
- [ ] **3.7 Efficiency Ratio**: Calidad de entradas y salidas. *(bloqueado por 3.3/3.4 — depende de MAE/MFE poblados)*

## 🔴 Nivel 4: V1.0 (Institucional - COMPLETO ✅)
*Objetivo: Nivel profesional absoluto y gamificación.*
- [x] **4.1 Sharpe Ratio**: Retorno ajustado al riesgo (anualizado √252).
- [x] **4.2 Simulación Monte Carlo**: 1,000 escenarios, fan chart 50 paths, P5/P50/P95, ruina%.
- [x] **4.3 Recovery Factor**: Net profit / Max drawdown USD.
- [x] **4.4 SQN (System Quality Number)**: Rating Poor/Average/Good/Excellent/SuperSystem.
- [x] **4.5 Correlación de Cartera**: Matriz Pearson de PnL diario por símbolo. Alertas cuando r ≥ 0.6. Endpoint `GET /trading/correlation/{id}`. Componente `CorrelationMatrix.tsx`. *(2026-03-11)*
- [x] **4.6 Calendario Interactivo**: PnL diario visual con navegación mes/año.
- [ ] **4.7 Tags Psicológicos**: Análisis de "Venganza" o "FOMO". *(pendiente — requiere nueva tabla `trade_tags` en DB, endpoint PATCH /trades/{id}/tags, y UI inline en la tabla de trades)*

## 🐛 Bugs Corregidos (2026-03-11)
- **`func.date()` → `cast(close_time, Date)`**: `func.date()` es función MySQL, no PostgreSQL canónico. Causaba que todos los filtros de fecha devolvieran 0 resultados. Corregido en `stats_service.py` y `metaapi_sync.py`.
- **SSE "stats" sobrescribía datos filtrados**: El listener SSE aplicaba datos sin filtro encima de datos filtrados. Corregido usando refs `dateFromRef`/`dateToRef` para re-fetchear con filtro activo.
- **Pantalla de sincronización con filtro activo**: `stats.total_trades === 0` con filtro activaba pantalla de sync. Corregido con `hasEverHadData` — fetch unfiltered al cargar cuenta.
- **`side` no expuesto en API trades**: Campo BUY/SELL existía en DB pero no se retornaba. Corregido en `get_trades_list` + schema `TradeRow`.

## ✅ Completado
- [x] Autenticación JWT + Bcrypt.
- [x] Despliegue en GCP (VM + Cloud Run + Cloud SQL).
- [x] Landing & Login interactivo "Bitcoin Gold".
- [x] Dashboard Layout Institutional (v0.2.0).
- [x] Ingesta Pasiva mediante API Keys (v0.3.0).
- [x] Conexión Directa MT5 (contraseña de inversor cifrada AES-256-GCM, v0.3.0).
- [x] Sistema de filtros de fecha global (DateFilterBar + DateFilterContext + todos los endpoints).
- [x] SSE real-time: equity en vivo, posiciones abiertas, sync incremental cada 5min.

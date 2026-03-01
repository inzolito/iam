# Manual Operativo del Bot - MaikBot Trade

## 📊 ADN del Bot - Punto Cero (Reiniciado 28-Feb 13:35 UTC)

Esta tabla representa el estado inicial post-reseteo. Todos los contadores están en cero para iniciar una nueva auditoría limpia.

| Categoría | Métrica | Valor Actual | Lógica Técnica / Cálculo | ¿Qué indica al Bot? |
| :--- | :--- | :--- | :--- | :--- |
| **Actividad** | Total Ejecuciones | **0 Fills** | Suma de todos los `fills` (compras/ventas) en Bitget. | Nivel de actividad y acumulación de comisiones. |
| | Trades Completos | **0 Negocios** | Conteo de ciclos completos (Entrada -> Salida). | Cantidad de decisiones de mercado finalizadas. |
| **Tiempo** | Duración Media | **0.00 min** | `Suma(Duraciones) / Total Trades`. | Velocidad de scalping y exposición al mercado. |
| **Puntería** | Take Profit (TP) | **0 (0%)** | Conteo de trades con Profit > 0. | Eficacia de la estrategia en capturar ganancias. |
| | Stop Loss (SL) | **0 (0%)** | Conteo de trades con Profit < 0. | Resistencia y frecuencia de salida por seguridad. |
| **Costos** | Comisión Media | **$0.00** | `Suma(Fees) / Total Ejecuciones`. | Costo operativo real por cada movimiento. |
| | Neto / Ganada | **$0.00** | `(Profit Bruto - Fee)` promedio. | Rentabilidad real neta tras un acierto. |
| | Neto / Perdida | **$0.00** | `(Pérdida Bruta + Fee)` promedio. | Costo real neto tras un toque de Stop Loss. |
| **Algoritmo** | Riesgo vs Beneficio | **1:2** | Config: SL (ATR*1.5) vs TP (ATR*3.0). | Relación matemática de supervivencia. |
| **Balance** | Estado de Cuenta | **$371.23** | Balance real actual en USDT vía API. | Capital total disponible para operar. |
| | PnL Total | **$0.00** | `Balance Actual - Balance Inicial`. | Resultado neto de la sesión actual post-reinicio. |

## ⚙️ Configuración Técnica de Alta Precisión

| Parámetro | Valor / Método | Explicación del Cálculo | Importancia |
| :--- | :--- | :--- | :--- |
| **Señal de Entrada** | **Z-Score > 2.0** | Se calcula la desviación estándar del spread entre ORO/USDT y PLATA/USDT. | Determina cuándo un activo está "caro" o "barato" respecto al otro. |
| **Volatilidad** | **ATR (14)** | *Average True Range* de las últimas 14 velas de 1 minuto. | Ajusta la distancia de seguridad según qué tan "nervioso" esté el mercado. |
| **Stop Loss (SL)** | **ATR * 1.5** | Se resta (en Long) o suma (en Short) 1.5 veces el ATR al precio de entrada. | El "escudo" dinámico; se ensancha en alta volatilidad y se estrecha en calma. |
| **Take Profit (TP)** | **ATR * 3.0** | Se busca un beneficio del doble del riesgo (Ratio 1:2). | Objetivo de salida automática para asegurar ganancias rápidas. |
| **Filtro de Ruido** | **RSI + MACD** | Solo entra si el RSI no está en sobrecompra/sobreventa extrema. | Evita entrar en el final de una tendencia agotada. |

## 📉 Resumen de Inicio
- **Fecha de Inicio:** 2026-02-28 13:35:00 UTC
- **Balance de Referencia:** $371.23
- **Estado Inicial:** Calibrando (esperando 20 velas para cálculo de Z-Score).

> [!TIP]
> **Prioridad Técnica:** Al ser un balance menor ($371), el bot ajustará automáticamente el tamaño de la orden para mantener el riesgo por trade por debajo del 1-2% del capital.

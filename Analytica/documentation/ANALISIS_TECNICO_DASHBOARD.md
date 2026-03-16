# Reporte de Análisis Técnico: Inconsistencias en Dashboard Analytica

**Fecha:** 11 de Marzo de 2026  
**Versión:** 1.0  
**Estado:** Diagnóstico completado

---

## 1. Resumen del Hallazgo
Tras una auditoría de la base de datos y el código fuente, se confirma que la base de datos (PostgreSQL) registra correctamente la operativa, pero el frontend presenta métricas distorsionadas debido a fallos en el procesamiento de zonas horarias y reglas lógicas de visualización.

## 2. Diagnóstico de Datos (Cuenta: MT5-19789812 | Fecha: 2026-03-10)

| Métrica | Valor en Base de Datos | Valor Visual en Dashboard | Estado |
| :--- | :--- | :--- | :--- |
| **PnL Neto** | **+193.59 USD** | **-56.74 USD (Aprox)** | ❌ Error de Filtro/TZ |
| **Win Rate** | **44.44%** | **45% (Rojo)** | ❌ Lógica de Color Errónea |
| **Ganancia Promedio** | **33.08 USD** | **17.54 USD** | ❌ Error de Cálculo/Divisor |
| **Curva de Equity** | Serie de 27 trades | Punto estático | ❌ Lógica de Escala Fallida |
| **Sesiones (NY)** | Mayores ganancias | Reporte inconsistente | ❌ Desajuste UTC/CL |

## 3. Identificación de Causas Raíz

### A. Discrepancia por Zona Horaria (UTC vs Local)
El backend filtra trades usando `CAST(close_time AS DATE)`, lo cual utiliza el día UTC. Debido a que el usuario se encuentra en Chile (UTC-3), los trades realizados después de las 21:00 hora local se cuentan para el "día siguiente" en el dashboard, rompiendo la coherencia visual del filtro "HOY".

### B. Lógica de Colorización Estática
En `DashboardPage.tsx`, el color del Win Rate está anclado a un umbral fijo del 50%. No considera el Profit Factor ni el R:R, marcando como "malo" (rojo) un sistema que financieramente es rentable (+193 USD).

### C. Ausencia de Resolución Intradía
`StatsService._get_intraday_curve` está implementado pero no se activa correctamente en la vista principal cuando el filtro es de un solo día, lo que resulta en la visualización de un único punto en lugar de una curva de evolución horaria.

### D. Degradación del Impacto de Costos
El cálculo de `grossPnl` en el frontend está sumando valores absolutos de forma redundante sobre resultados que ya son netos, lo que genera montos incoherentes en la sección de Comisiones/Swaps.

## 4. Requerimientos para el Plan de Implementación

1.  **Refactor de Filtros:** Implementar desplazamiento de zona horaria (Timezone Offset) en todas las queries SQL de `StatsService.py`.
2.  **Activación de Escala Horaria:** Forzar visualización por horas en el gráfico de Equity cuando `date_from == date_to`.
3.  **Lógica Dinámica de Semáforos:** Cambiar el color del Win Rate para que sea verde si el PnL Neto es positivo o el Profit Factor > 1.0.
4.  **Normalización de Sesiones:** Ajustar los rangos horarios de las sesiones (Asia, Londres, NY) para reflejar la realidad del horario de mercado frente a la zona horaria del usuario.

## 5. Conclusión
El sistema es íntegro en cuanto a almacenamiento de datos. El problema es puramente de interpretación y visualización (Capas de Servicio y Presentación).

---
*Este documento sirve como base para el desarrollo del plan de revisión e implementación de mejoras.*

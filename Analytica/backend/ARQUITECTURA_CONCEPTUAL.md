# Analytica: Arquitectura Conceptual y Estándares de Datos

Este documento define la estructura lógica necesaria para que Analytica soporte desde el Nivel 1 hasta el Nivel 4, sin entrar en la implementación técnica de la base de datos que será proporcionada por el usuario.

## 1. Entidades Principales (Conceptos)

### A. El Trader (Usuario)
Identidad única que agrupa múltiples cuentas y fuentes de datos.

### B. Cuentas (Fuentes de "Vera")
- **MT5 (Bridge)**: Conexión externa (API) para capturar el historial.
- **Binance/Bitget (Spot/Futures)**: Conexión vía API Keys (Read-only).
- **Metadatos**: Divisa base, apalancamiento, saldo inicial (para cálculo de ROE%).

### C. El Activo (Symbol)
Referencia universal para normalizar datos:
- Ticker (ej: XAUUSD, BTCUSDT).
- Clase de activo (Forex, Crypto, Indices).
- Valor del punto/pip (necesario para cálculos de riesgo).

### D. La Operación (Trade)
El registro atómico de ejecución. Debe capturar:
- **Puntos de entrada y salida**: Precio y tiempo exactos.
- **Costos**: Comisión y Swap (clave para el Nivel 2.7).
- **Ejecución**: ¿Fue manual o automática (TP/SL)? (Nivel 1.4 y 1.8).
- **Excursión (MAE/MFE)**: Máximo drawdown y beneficio flotante durante la vida del trade (Nivel 3.3/3.4).

## 2. Precisión de Datos
Dada la naturaleza de pares como BTCUSDT o JPY, se requiere una precisión mínima de **16 decimales** en todos los cálculos financieros para evitar errores de redondeo acumulativos en métricas institucionales (Sharpe/Monte Carlo).

## 3. Estándares Visuales (UX/UI)
"Analytica" debe sentirse como una terminal institucional, no como un dashboard genérico.

- **Paleta de Colores**: Oscura (Deep Space), con acentos en cian eléctrico para datos positivos y naranja quemado para riesgos.
- **Tipografía**: Monoespaciada para datos numéricos (facilita la comparación visual rápida).
- **UX de "Zero Bias"**: Las estadísticas negativas no deben ocultarse; deben resaltarse para fomentar el aprendizaje y la eliminación del sesgo.

## 4. Clasificación Psicológica (Nivel 4.7)
Se implementará un sistema de **Etiquetado Conductual** que permita asociar trades a estados mentales o errores de sistema:
- *Indisciplina*: "Venganza", "FOMO", "Overtrading".
- *Sistema*: "Estrategia A", "Backtest Test", "News Event".

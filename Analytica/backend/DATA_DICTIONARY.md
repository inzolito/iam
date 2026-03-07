# Analytica Data Dictionary

Este documento detalla la estructura y filosofía de la base de datos de "Analytica". El diseño sigue un esquema de Tercera Forma Normal (3NF) optimizado para PostgreSQL, garantizando integridad referencial y alto rendimiento en cálculos analíticos.

## Filosofía del Diseño "Agnóstico"

Para soportar múltiples plataformas (MT5, Binance, Bitget), la tabla `trades` ha sido diseñada bajo una premisa agnóstica:

1.  **Formatos de Volumen**: Se utiliza `NUMERIC(18,8)` para el volumen. Esto permite manejar tanto lotajes de Forex (0.01) como cantidades fraccionarias de Cripto (0.00000001 BTC).
2.  **Identificadores Externos**: Las columnas `external_ticket_id` y `strategy_magic_number` son de tipo `VARCHAR`. Esto permite almacenar tickets numéricos de MT5 y hashes o UUIDs de plataformas crypto sin pérdida de información.
3.  **Precisión Financiera**: Se utiliza `NUMERIC(18,8)` para precios y `NUMERIC(18,4)` para beneficios, cumpliendo con los estándares institucionales para evitar errores de redondeo.

## Tablas de Catálogo

### `users`
Almacena la identidad de los traders.
- `id` (UUID): Identificador único global.
- `email` (VARCHAR UNIQUE): Correo del usuario.
- `password_hash` (VARCHAR): Hash bcyprt/argon2.

### `instruments`
Normalización de activos financieros para evitar redundancia de nombres.
- `id` (UUID): Primaria.
- `ticker` (VARCHAR): Símbolo de mercado (ej. XAUUSD, BTCUSDT).
- `asset_class` (VARCHAR): Clasificación (Forex, Crypto, Indices).

### `strategy_tags`
Etiquetado psicológico y de sistema (Conductual).
- `name` (VARCHAR): Nombre de la etiqueta (ej. "FOMO", "Estrategia Fractal").
- `color_hex` (VARCHAR): Color para el dashboard.

## Core Operativo

### `trading_accounts`
Enlaces a las fuentes de datos.
- `user_id` (FK): Referencia al dueño.
- `platform` (VARCHAR): MT5, Binance, etc.
- `connection_details` (JSONB): Credenciales cifradas o metadatos de conexión.

### `trades` (Tabla de Hechos)
El corazón de Analytica. Captura cada operación con métricas MAE/MFE.
- `duration_seconds`: Generado automáticamente o calculado para análisis de retención.
- `mae_price` / `mfe_price`: Máxima excursión adversa/favorable durante la vida del trade.
- **Índices**: Indexación en `(account_id, close_time)` para acelerar reportes históricos.

## Optimización de Rendimiento

### `daily_snapshots` (Equity Curve Cache)
Diseñada para evitar `JOIN`s pesados y agregaciones on-the-fly al renderizar gráficos de rendimiento.
- `balance_end`: Saldo al finalizar el día UTC.
- `daily_pl`: Beneficio o pérdida neta del día.
- **Razón de ser**: Al consultar un gráfico de 365 días, el sistema lee 365 filas en lugar de recalcular miles de operaciones.

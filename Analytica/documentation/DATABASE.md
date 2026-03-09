# Analytica: Documentación de Base de Datos

Este documento describe la estructura y relaciones de la base de datos de Analytica (PostgreSQL), diseñada para soportar el análisis institucional de trading y la gamificación por niveles.

## Esquema de Tablas

### 1. `users` (Usuarios)
Gestión de identidad y acceso al dashboard.
*   **id**: UUID (PK)
*   **email**: Correo electrónico (Único)
*   **password_hash**: Contraseña encriptada (Bcrypt)
*   **created_at / updated_at**: Auditoría temporal.

### 2. `trading_accounts` (Cuentas de Trading)
Cuentas vinculadas por el usuario (MT5, etc.).
*   **id**: UUID (PK)
*   **user_id**: Referencia al usuario (FK)
*   **name**: Nombre descriptivo de la cuenta.
*   **platform**: Plataforma (MT5, BINANCE).
*   **connection_details**: JSONB con metadatos de conexión.
*   **currency**: Divisa base (ej: USD).
*   **balance_initial**: Capital con el que se inicia el rastreo en Analytica.

### 3. `instruments` (Instrumentos)
Catálogo de activos financieros monitoreados.
*   **id**: UUID (PK)
*   **ticker**: Símbolo (ej: XAUUSD, BTCUSDT).
*   **asset_class**: Clase de activo (FOREX, CRYPTO, COMMODITIES).

### 4. `trades` (Operaciones)
El núcleo de datos para todas las métricas de rentabilidad.
*   **id**: UUID (PK)
*   **account_id**: Cuenta a la que pertenece (FK)
*   **instrument_id**: Activo operado (FK)
*   **external_ticket_id**: ID único del ticket en MT5 (Evita duplicados).
*   **side**: Dirección de la orden (BUY/SELL).
*   **volume**: Tamaño de la posición (Lotes/Unidades).
*   **open_price / close_price**: Precios de ejecución.
*   **net_profit**: Beneficio neto (Crucial para Nivel 1.1).
*   **mae_price / mfe_price**: Datos para análisis de eficiencia y psicología (Nivel 3).
*   **duration_seconds**: Tiempo de exposición (Nivel 2.6).

### 5. `daily_snapshots` (Historial Diario)
Instantáneas para la generación de la curva de equidad (Nivel 1.7).
*   **account_id**: Referencia a la cuenta (FK)
*   **date**: Fecha del registro.
*   **balance_end**: Balance al cierre del día.
*   **daily_pl**: PnL neto del día.

### 6. `api_keys` (Seguridad de Ingesta)
Credenciales para que el terminal MT5 envíe datos de forma pasiva.
*   **account_id**: Cuenta vinculada (FK - Única)
*   **client_id**: Identificador público de la conexión.
*   **hashed_secret**: Secreto para validación de firma en headers.

## Relaciones Críticas
1.  **User -> TradingAccounts**: Un usuario puede tener múltiples cuentas.
2.  **TradingAccount -> Trades**: Las operaciones están fragmentadas por cuenta para análisis individual.
3.  **TradingAccount -> ApiKey**: Relación 1:1 para asegurar que cada cuenta tenga una vía de ingesta segura.
4.  **Trade -> Instrument**: Normalización para análisis de rentabilidad por activos (Nivel 2.8).

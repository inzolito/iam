# Referencia de la API (Endpoints)

Documentación técnica de los puntos de acceso del servidor Analytica.

## 1. Módulo de Autenticación (`/api/v1/auth`)
*   **POST `/login`**: Intercambia credenciales (email/password) por un token de acceso JWT.
*   **GET `/me`**: Retorna el perfil del usuario autenticado.

## 2. Módulo de Cuentas (`/api/v1/accounts`)
*   **POST `/link`**: Crea una nueva vinculación de cuenta de trading.
*   **GET `/`**: Lista todas las cuentas vinculadas al usuario.
*   **DELETE `/{id}`**: Elimina una cuenta y todos sus datos asociados.

## 3. Módulo de Ingesta de Datos (`/api/v1/ingest`)
*   **POST `/mt5`**: Punto de entrada para el script MQL5.
    *   *Headers Requeridos*: `X-Client-ID`, `X-API-Key`.
    *   *Payload*: JSON con el historial de trades cerrados.

## 4. Módulo de Estadísticas (`/api/v1/trading`)
*   **GET `/stats/{account_id}`**: Retorna las métricas agregadas (Winrate, NetProfit, etc.).
*   **GET `/trades/{account_id}`**: Retorna la lista de operaciones cerradas con filtrado dinámico.
*   **GET `/equity-curve/{account_id}`**: Retorna los puntos para graficar la curva de capital.

---
> [!TIP]
> Puede acceder a la documentación interactiva en vivo (Swagger UI) visitando:
> `https://analytica-backend-419965139801.us-central1.run.app/docs`

# Analytica: Infraestructura y Credenciales del Sistema

Este documento centraliza los datos técnicos, puntos de acceso y credenciales críticas del ecosistema Analytica en Google Cloud Platform (GCP).

## 1. Servidor de Base de Datos (Cloud SQL / PostgreSQL)
La base de datos es el núcleo de persistencia de todas las operaciones y usuarios.
*   **Host**: `34.55.159.178`
*   **Puerto**: `5432`
*   **Base de Datos**: `analytica`
*   **Usuario**: `postgres`
*   **Contraseña**: `AnalyticaRootPW123!`

## 2. Backend (Cloud Run)
El motor lógico que procesa la API y la ingesta pasiva desde MT5.
*   **URL de Producción**: `https://analytica-backend-419965139801.us-central1.run.app`
*   **Región**: `us-central1`
*   **Variables Críticas**:
    *   `SECRET_KEY`: `KJA0u-JnlnbrxUEBE-mo6gmckvnw-OlSsoPE-EkDni0`
    *   `ALGORITHM`: `HS256`

## 3. Frontend (Compute Engine - VM)
La interfaz de usuario institucional desplegada como un contenedor Docker en una VM dedicada.
*   **Nombre de Instancia**: `analytica-frontend-vm`
*   **Zona**: `us-central1-a`
*   **Tipo de Máquina**: `e2-micro`
*   **Puertos Abiertos**: `80` (HTTP), `3000` (Node.js)
*   **Script de Inicio**: Ubicado en `c:\www\Analytica\startup.sh`

## 4. Registro de Contenedores (Artifact Registry)
Donde se almacenan las imágenes de Docker listas para despliegue.
*   **Repositorio**: `us-central1-docker.pkg.dev/maikbottrade/analytica-repo`
*   **Imagen Frontend**: `frontend:latest`

## 5. MetaAPI (Sincronización Directa MT5)
Servicio cloud que conecta a cuentas MT5 usando la Contraseña de Inversor (solo lectura).
*   **Proveedor**: MetaAPI Cloud — `https://metaapi.cloud`
*   **Token**: almacenado en `.env` como `METAAPI_TOKEN` y en Cloud Run como variable de entorno
*   **Scheduler**: APScheduler en el backend ejecuta sync cada 6 horas por cada cuenta DIRECT
*   **Endpoint manual**: `POST /api/v1/accounts/sync/{account_id}`
*   **Historial**: últimos 90 días por defecto (configurable con `METAAPI_HISTORY_DAYS`)
*   **Almacenamiento MetaAPI account ID**: en `connection_details.metaapi_account_id` (JSONB) para reutilizar en syncs futuros

## 6. Notas de Seguridad
> [!IMPORTANT]
> El archivo `.env` en la raíz del backend (`c:\www\Analytica\backend\.env`) contiene la copia local sincronizada de estas credenciales. Nunca suba este archivo a repositorios públicos.

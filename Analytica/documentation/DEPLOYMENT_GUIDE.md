# Guía de Despliegue y Mantenimiento (CI/CD)

Este documento es para administradores del sistema Analytica que necesiten actualizar los servicios o realizar tareas de mantenimiento.

## 1. Actualización del Backend (Cloud Run)
El backend se despliega como un servicio serverless que escala automáticamente.

### Pasos para desplegar cambios:
1.  Subir cambios al código en `backend/`.
2.  Construir la imagen de Docker:
    ```bash
    docker build -t us-central1-docker.pkg.dev/maikbottrade/analytica-repo/backend:latest ./backend
    ```
3.  Subir la imagen al registro de Google:
    ```bash
    docker push us-central1-docker.pkg.dev/maikbottrade/analytica-repo/backend:latest
    ```
4.  Desplegar en Cloud Run:
    ```bash
    gcloud run deploy analytica-backend --image us-central1-docker.pkg.dev/maikbottrade/analytica-repo/backend:latest --region us-central1
    ```

## 2. Actualización del Frontend (VM)
El frontend corre en una VM de Google Compute Engine.

### Proceso de actualización rápida:
1.  Construir y empujar la imagen de Docker del frontend.
2.  Acceder a la VM por SSH.
3.  Detener el contenedor actual y arrancar el nuevo:
    ```bash
    docker stop frontend && docker rm frontend
    bg-docker run -d --name frontend -p 80:3000 --restart always <IMAGE_PATH>
    ```

## 3. Migraciones de Base de Datos (Alembic)
Para cualquier cambio en la estructura de tablas, use Alembic:
```bash
alembic revision --autogenerate -m "descripción del cambio"
alembic upgrade head
```

## 4. Copias de Seguridad (Backups)
La base de datos Cloud SQL tiene habilitadas copias de seguridad automáticas diarias. Sin embargo, para un export manual:
```bash
gcloud sql export sql analytica gs://analytica-backups/backup_$(date +%F).sql --database=analytica
```

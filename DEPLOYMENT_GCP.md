# Guía de Despliegue en Google Cloud Platform (GCP)

Este documento detalla el procedimiento exacto que se llevó a cabo para llevar a **MaikBotTrade** desde un entorno local en Windows hacia un servidor de ejecución 24/7 en Google Cloud, utilizando Ubuntu Linux y el demonio `Systemd`.

## 1. Preparación del Entorno Local (Windows)

Dado que la consola estándar de Windows no tiene acceso nativo a la cuenta de GCP y sus llaves SSH seguras por defecto, instalamos el **Google Cloud SDK**:
1. Descarga e instalación silenciosa del paquete `Google.CloudSDK` mediante `winget`.
2. Autorización del equipo usando el comando `gcloud auth login` (que abrió el navegador para conectar con la cuenta `@gmail.com`).
3. Uso de la ruta absoluta del ejecutable para evitar problemas de variables de entorno prematuras: `"$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd"`

## 2. Preparación de la Infraestructura en la Nube
El usuario creó manualmente una instancia gratuita en GCP:
- **Proyecto:** `maikbottrade`
- **Zona:** `us-east1-c`
- **Instancia:** `maik-bot-server` (e2-micro o superior)
- **Sistema Operativo:** Ubuntu 22.04 LTS

## 3. Transferencia de Archivos (SCP)
Se utilizó el comando oficial de `gcloud compute scp` para transferir la carpeta evitando pedir contraseñas manuales (ya que gcloud gestiona las llaves SSH automáticamente):
```bash
gcloud compute scp --recurse c:\www\* maikol_salas_m@maik-bot-server:/home/maikol_salas_m/maikBotTrade --project=maikbottrade --zone=us-east1-c
```
*(Nota: El archivo local `.env` no se sube por seguridad).*

## 4. Instalación de Dependencias en el Servidor
Se ejecutó de forma remota el script `setup_server.sh` que previamente programamos. Este script se encargó de:
1. Actualizar los repositorios de Ubuntu (`apt update && apt upgrade`).
2. Instalar `python3`, `python3-pip`, `python3-venv` y compiladores (`build-essential`).
3. Crear el entorno virtual aislado `venv`.
4. Instalar todas las librerías matemáticas y de conexión desde `requirements.txt` (`ccxt`, `numpy`, `pandas`, `python-dotenv`).

## 5. Inyección de Secretos y Persistencia (Systemd)
Una vez instaladas las dependencias y el entorno, se ejecutó un solo bloque de comandos remotos (`gcloud compute ssh`) que realizó las siguientes configuraciones de nivel Dios:

1. **Variables de Entorno Clave:** Inyectó directamente las credenciales de Bitget (`BITGET_API_KEY`, `BITGET_SECRET_KEY`, `BITGET_PASSPHRASE`) en un nuevo archivo `.env` dentro de la sesión activa del servidor, asegurándose de que las llaves reales nunca tocaran GitHub ni el tránsito público.
2. **Demonio del Sistema:** Movió el archivo `maikbot.service` (nuestro creador de demonios) a la carpeta vital de Linux `/etc/systemd/system/`.
3. **Activación de Re-arranque Automático:**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable maikbot
   sudo systemctl start maikbot
   ```

## 6. Resultado Final y Monitoreo
Con el servicio `maikbot` activo (`active (running)`), el script `main.py` de Python pasó a vivir en la memoria de fondo de Ubuntu.
El bot no se detiene si se cierra la consola SSH. Si Google Cloud o el VPS se reinician por mantenimiento físico en los servidores base, Systemd levantará automáticamente el bot al encender, y gracias al Try/Except de la lógica en Python, si Bitget no responde en ese mismo instante, esperará y reintentará infinitamente.

**Comando de Monitoreo Remoto para ver la consola Python (Matrix mode):**
```bash
gcloud compute ssh maikol_salas_m@maik-bot-server --project=maikbottrade --zone=us-east1-c --command="sudo journalctl -u maikbot -f"
```

---
*Este documento fue autogenerado tras completarse exitosamente el despliegue multi-agente en infraestructura Cloud para sistemas de Trading Algorítmico 24/7.*

## 7. Mantenimiento y Actualizaciones Rápidas

Para aplicar cambios realizados localmente en Windows hacia el servidor en la nube sin reinstalar todo:

1. **Sincronizar carpetas/archivos:**
   ```bash
   gcloud compute scp --recurse c:\www\* maikol_salas_m@maik-bot-server:/home/maikol_salas_m/maikBotTrade --project=maikbottrade --zone=us-east1-c
   ```

2. **Reiniciar el servicio para aplicar cambios:**
   ```bash
   gcloud compute ssh maikol_salas_m@maik-bot-server --project=maikbottrade --zone=us-east1-c --command="sudo systemctl restart maikbot"
   ```

3. **Verificar que el bot arrancó bien:**
   ```bash
   gcloud compute ssh maikol_salas_m@maik-bot-server --project=maikbottrade --zone=us-east1-c --command="sudo journalctl -u maikbot -n 20"
   ```

---
*Fin del documento de infraestructura.*

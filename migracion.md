### Contexto del Proyecto y Entorno (Handover desde Claude a Gemini 4 Argon)

1. **Situación actual:**
   - Este proyecto (`IAM`) fue iniciado previamente con Claude y recién clonado en este equipo limpio (Windows 11, HP EliteBook con 32 GB RAM, carpeta `C:\msmDev\IAM`).
   - En este sistema ya están instalados `Git` y `scrcpy` (incluye `adb`). Aún no están instalados los SDKs/runtimes del proyecto ni sus dependencias.
   - Este es un equipo corporativo temporal: **todo el trabajo debe mantenerse 100% sincronizado en GitHub (`origin/main`)** mediante commits limpios al finalizar cada sesión, sin dejar dependencias rotas ni cambios locales sin respaldar.

2. **Flujo de pruebas sin cables ni emuladores:**
   - No usaremos emuladores locales. Probaremos la app en tiempo real sobre un **Samsung Galaxy S24 Ultra** físico conectado por **Depuración Inalámbrica (ADB over Wi-Fi)** y proyectado en pantalla con `scrcpy --tcpip`.
   - Necesito iterar rápido sobre el diseño y la UI usando **Hot Reload / Fast Refresh**, evitando compilar e instalar APKs manualmente.

3. **Tus primeras tareas ahora mismo:**
   - **Paso 1 (Auditoría y Setup):** Revisa toda la estructura del repositorio, lee `CLAUDE.md` (o documentación existente) para respetar la arquitectura y reglas del proyecto, y verifica qué runtimes/SDKs faltan en este Windows (Node, Flutter, Java/Android SDK, etc.). Instala las dependencias del proyecto.

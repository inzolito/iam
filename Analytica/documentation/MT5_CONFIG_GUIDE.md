# Guía de Vinculación: Elige tu método de conexión

Analytica te permite elegir cómo quieres que tus datos lleguen al dashboard. Tienes dos opciones profesionales dependiendo de tus prioridades:

---

## 🚀 Opción 1: Conexión Directa (Recomendada por Simplicidad)
*Ideal si quieres que todo funcione solo y no te importa compartir tu contraseña de inversor.*

### Pasos:
1.  En el Dashboard, haz clic en **"Vincular Cuenta"**.
2.  Selecciona **"Conexión Directa"**.
3.  Ingresa tu **ID de MT5**, **Servidor del Broker** y **Contraseña de Inversor**.
4.  **Listo**: Nuestro servidor se conectará periódicamente a tu cuenta para leer el historial. No tienes que instalar nada más.

---

## 🛡️ Opción 2: Ingesta Pasiva (Recomendada por Seguridad)
*Ideal para traders profesionales o institucionales que NO quieren compartir sus contraseñas bajo ninguna circunstancia.*

### Pasos:
1.  En el Dashboard, selecciona **"Ingesta Pasiva"**.
2.  Genera tu **API KEY** y **URL de Ingesta**.
3.  **Habilita WebRequest** en tu MetaTrader 5 (Herramientas > Opciones > Asesores Expertos). Añade la URL: `https://analytica-backend-419965139801.us-central1.run.app`
4.  **Descarga el Conector** (`Analytica_Ingest.ex5`) y arrástralo sobre cualquier gráfico en tu MT5.
5.  Pega tu **API KEY** cuando el script te lo pida.

---

### ¿Cuál elegir?
| Característica | Conexión Directa | Ingesta Pasiva |
| :--- | :--- | :--- |
| **Dificultad** | Muy Fácil | Media (1 instalación) |
| **Seguridad** | Media (Das contraseña) | Máxima (Solo envías datos) |
| **Automatización** | 100% Automática | Requiere tener MT5 abierto |
| **Privacidad** | Acceso al historial | Solo vemos lo que envías |

> [!IMPORTANT]
> Analytica **NUNCA** te pedirá tu contraseña de operaciones (la que permite abrir/cerrar trades). Solo usamos la de **Inversor** (solo lectura) o la **API Key**.

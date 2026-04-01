# Venues y Recompensas — IAM

El sistema de venues es la capa B2B de IAM y el mecanismo que conecta la app con encuentros reales.

---

## Modelo de Negocio B2B

Los venues (cafés, librerías, parques privados, etc.) pagan una **suscripción mensual** para ser listados como "Lugar Neuro-Safe certificado" y aparecer destacados en la app.

### Propuesta de valor para el venue
- Acceso a un nicho específico, fiel y con alta intención de visita
- Los usuarios van al venue para canjear su recompensa → tráfico garantizado
- Panel de analytics: cuántos canjes, días de más tráfico
- Badge "Neuro-Safe" que diferencia al negocio

### Propuesta de valor para el usuario
- Recompensas tangibles (no virtuales) por mantener hábitos sanos en la app
- El venue se convierte en excusa natural para el primer encuentro IRL

---

## Criterios "Neuro-Safe"

Para ser listado, el venue debe cumplir al menos 3 de estos criterios:
- Nivel de ruido bajo (se puede conversar sin elevar la voz)
- Iluminación no agresiva (sin luces blancas muy intensas o parpadeantes)
- Espacios sin saturación visual excesiva
- Personal informado sobre neurodivergencia (capacitación básica de IAM)
- Zonas tranquilas disponibles

El nivel sensorial (1-5) se asigna al momento de la certificación.

---

## Flujo Completo de Recompensa

```
1. DESBLOQUEO
   Usuario alcanza hito (ej: 30 días de racha)
   → Backend crea reward_redemption con status pendiente
   → Notificación: "¡Desbloqueaste un café gratis en [Venue]!"

2. GENERACIÓN DE CÓDIGO
   Usuario abre la recompensa en la app
   → POST /rewards/:id/redeem
   → Backend genera:
     - código alfanumérico único de 8 caracteres (ej: "X7KP2NMQ")
     - QR data (el mismo código en formato QR)
     - expires_at: 30 días desde generación
   → Se muestra en pantalla: QR grande + código debajo

3. CANJE EN EL VENUE
   Usuario muestra la pantalla al personal del venue
   → Personal abre Venue App → Escáner
   → Escanea QR o escribe código manualmente
   → POST /venue/scan { code, venue_id }
   → Backend:
     a. Verifica que el código existe
     b. Verifica que pertenece a este venue
     c. Verifica que no ha sido canjeado (redeemed_at IS NULL)
     d. Verifica que no ha expirado (expires_at > NOW())
     e. Registra redeemed_at = NOW()
   → Venue App muestra: ✅ "Válido — [Descripción de la recompensa]"

4. REGISTRO IRL (opcional)
   Después del canje, la app pregunta al usuario:
   "¿Veniste con alguien de IAM?"
   → Si dice sí y selecciona un match → se registra en irl_meetings
   → Ambos usuarios ganan logro "Primera cita IRL"
```

---

## Venue App (App separada)

Aplicación Flutter simplificada para el personal del venue.

### Pantallas
1. **Login**: Cuenta del venue (email + contraseña simple)
2. **Dashboard**: Estadísticas del día (canjes hoy, canjes del mes)
3. **Escáner**: Cámara para QR + campo de texto para código manual
4. **Resultado**: ✅ Válido / ❌ Inválido / ⏰ Expirado / 🔄 Ya usado

### Lo que el venue NO puede ver
- Nombre o datos del usuario que canjea
- Información de diagnóstico
- Historial de matches o actividad en la app

---

## Tipos de Recompensas por Hito

| Hito | Recompensa sugerida |
|------|-------------------|
| 7 días de racha | Descuento 10% en venue |
| 30 días de racha | Café/té gratis |
| 100 días de racha | Bebida premium gratis |
| Primer match | Descuento especial "primera cita" |
| Primera reunión IRL confirmada | Postre o snack gratis |
| 1 año en la app (Legado) | Experiencia especial del venue |

Los venues definen sus propias recompensas dentro de la plataforma.

---

## Panel de Administración del Venue (Web)

Acceso via browser (no requiere app separada para admin):
- Ver y editar recompensas activas
- Ver estadísticas de canjes
- Descargar reporte mensual
- Actualizar información del local (horarios, fotos, descripción)

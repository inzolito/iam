# Privacidad y Compliance — IAM

---

## Marco Legal Aplicable

### Chile
- **Ley 19.628** sobre protección de la vida privada (vigente)
- **Nueva Ley Marco de Datos Personales** (en tramitación, 2024-2025) — diseñar para cumplirla desde el inicio
- Los diagnósticos neurológicos son **datos sensibles** bajo ambas leyes
- Requieren consentimiento explícito, informado y específico

### iOS / Android
- **Apple App Store Review Guidelines** — privacidad de menores, in-app purchase rules
- **Google Play Policy** — apps para adolescentes requieren cumplimiento adicional
- **COPPA** (EE.UU.) — si eventualmente se expande, aplica para menores de 13

---

## Principios de Diseño de Privacidad

### 1. Mínimo necesario
Solo se recopila lo que la app necesita para funcionar. No se recopila:
- Historial de navegación
- Contactos del teléfono
- Información de otras apps

### 2. Consentimiento granular
Al registro, el usuario consiente explícitamente:
- [ ] Uso de datos de diagnóstico para personalizar la experiencia
- [ ] Uso de ubicación para matching por proximidad
- [ ] Recepción de notificaciones push
- [ ] Política de privacidad completa

Cada uno por separado. Sin "acepta todo".

### 3. Portabilidad y eliminación
- El usuario puede exportar sus datos en cualquier momento (JSON)
- La eliminación de cuenta borra todos los datos en 30 días
- Los mensajes en chats activos se marcan como "[Mensaje eliminado]" para el otro participante

---

## Datos Sensibles — Tratamiento Especial

Los diagnósticos neurológicos no se exponen directamente en la API más allá de lo necesario:

```
❌ Nunca se envía: "Usuario X tiene diagnóstico TEA"
✅ Solo se envía: haloColor, themeConfig (derivados del diagnóstico)

En el feed, otros usuarios ven el halo de color, no el diagnóstico exacto.
El diagnóstico solo es visible si el usuario lo hace explícito en su perfil.
```

### Row Level Security en Supabase
- Nadie puede leer diagnósticos de otros usuarios directamente
- Solo el backend con service_role accede a estos datos para computar themes y matches

---

## Menores de Edad (16-17)

Cuando teen_mode_enabled = true:
- **Verificación de edad**: se valida birth_date al registro. Si < 16 → no puede registrarse.
- **Separación total**: queries siempre filtran `is_teen` para evitar mezcla
- **Datos adicionales**: considerar requerimiento de consentimiento parental para < 18 si la ley chilena lo exige (revisar con abogado antes de activar el feature)
- **Marketing**: los menores NO aparecen en ningún material de marketing

---

## Seguridad Técnica

### Transmisión
- TLS 1.3 en todas las comunicaciones
- Certificate pinning en la app mobile

### Almacenamiento
- Passwords de venue app: bcrypt con salt rounds >= 12
- JWTs: firmados con RS256, expiración 15 minutos
- Refresh tokens: almacenados hasheados en DB

### Ubicación
- Solo se almacena la última ubicación conocida (no historial)
- Se redondea a 100 metros antes de almacenar para reducir precisión
- Al feed, se redondea al km más cercano

### Imágenes
- Las fotos se sirven via URLs firmadas con expiración (Google Cloud Storage Signed URLs)
- No hay URLs públicas permanentes de fotos de perfil

---

## Términos de Uso — Puntos Clave

Redactar con lenguaje claro y accesible (importante para el público neurodivergente):
- Sin jerga legal innecesaria
- Formato en bullet points, no parrafos largos
- Versión "resumen simple" además de la versión completa
- Disponible en español (Chile) desde el lanzamiento

---

## Antes del Lanzamiento

- [ ] Revisión por abogado especializado en datos personales Chile
- [ ] Política de privacidad publicada en URL accesible
- [ ] Términos de servicio publicados
- [ ] DPA (Data Processing Agreement) para venues
- [ ] Proceso documentado de respuesta a solicitudes de eliminación de datos

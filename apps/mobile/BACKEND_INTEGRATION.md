# Integración con Backend Real — IAM Mobile

Guía para conectar la app Flutter al backend NestJS y Supabase reales.

---

## Arquitectura de endpoints

- **Backend NestJS** tiene `setGlobalPrefix('v1')` en `main.ts`, así todas las rutas quedan bajo `/v1/*`.
- **Flutter** llama sin el prefix (`/feed`, `/matches`); el `/v1` se agrega desde `Env.effectiveApiBaseUrl`.

### Modos de conexión

| Modo | baseUrl | Cómo se resuelve |
|------|---------|------------------|
| Supabase Edge Functions | `${SUPABASE_URL}/functions/v1` | Default si no se provee `API_BASE_URL` |
| NestJS directo (staging/prod) | `${API_BASE_URL}/v1` | Si se provee `API_BASE_URL` |

---

## Setup local (dev)

### 1. Backend NestJS corriendo

```bash
cd apps/backend
npm install
npm run start:dev
# → backend en http://localhost:3000
```

### 2. Supabase local (opcional)

```bash
cd apps/backend
supabase start
# → Supabase en http://127.0.0.1:54321
```

### 3. Configurar Flutter

```bash
cd apps/mobile
cp .env.dev.example .env.dev
# Editar .env.dev con tus credenciales
./scripts/run_dev.sh
```

### Variables

```bash
# .env.dev
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=tu-anon-key-local
API_BASE_URL=http://10.0.2.2:3000    # Android emulator
# API_BASE_URL=http://localhost:3000 # iOS simulator
```

---

## Checklist de verificación

Después de `flutter run`, probar cada flujo:

### Auth (F2)
- [ ] Splash → LoginScreen aparece
- [ ] Login Google → redirige a Onboarding (usuario nuevo) o Feed (existente)
- [ ] Logout → vuelve a Login

### Onboarding (F2)
- [ ] Selección de diagnóstico (TEA/TDAH/AACC/Dislexia)
- [ ] SpIn: tags cargan desde `/spin/categories`
- [ ] Completar onboarding → tema cambia + redirige a Feed

### Feed (F3)
- [ ] `/feed` devuelve perfiles paginados
- [ ] Like dispara `/swipes` — si matched:true, aparece MatchDialog
- [ ] Pass dispara `/swipes`
- [ ] Cuando quedan <3, se auto-cargan más

### Chat (F4)
- [ ] `/matches` devuelve conversaciones con unreadCount
- [ ] Abrir conversación carga mensajes + auto mark-read
- [ ] Enviar mensaje aparece al instante

### Esencias (F5)
- [ ] `/esencias/balance` muestra balance correcto
- [ ] Tab Historial lista transacciones
- [ ] Tab Tienda muestra unlocks por diagnóstico

### Perfil (F6)
- [ ] `/users/me/profile` carga datos
- [ ] Edit bottom sheet actualiza displayName/username/msnStatus
- [ ] Diagnoses chips aparecen

### Venues (F7)
- [ ] `/venues/nearby/me?lat=...&lng=...` lista venues
- [ ] Filtros de categoría funcionan
- [ ] Toggle favorite persiste

### Body Doubling (F8)
- [ ] `/body-doubling/sessions` lista
- [ ] FAB crear sesión → POST exitoso
- [ ] Unirse / salir actualiza el contador

### Meetups (F9)
- [ ] Tab Pendientes muestra meetups activos
- [ ] Confirmar / Disputar funcionan
- [ ] Historial contiene confirmados/expirados

### Notificaciones (F10)
- [ ] Badge de no-leídos visible en AppBar
- [ ] `/notifications` lista notificaciones
- [ ] Marcar como leída actualiza badge
- [ ] "Marcar todo" limpia badge

### Push (requiere Firebase configurado)
- [ ] Después de login, logs muestran `[FCM] Token registrado`
- [ ] Backend recibe el token en `/notifications/devices`
- [ ] Enviar push de prueba desde Firebase Console llega al device

---

## Troubleshooting

### "Connection refused" en Android emulator
Android emulator no puede usar `localhost`. Usar:
- `http://10.0.2.2:3000` para llegar al host

### "Connection refused" en dispositivo real
Necesitas la IP LAN de tu máquina:
```bash
# macOS / Linux
ipconfig getifaddr en0

# Windows
ipconfig | grep "IPv4"
```
Luego: `API_BASE_URL=http://TU-IP-LAN:3000`

### "CORS blocked"
Agregar en backend (`apps/backend/src/main.ts`):
```typescript
app.enableCors({
  origin: true, // O lista específica
  credentials: true,
});
```

### "Invalid JWT"
El Flutter guarda el token en FlutterSecureStorage. Si hay mismatch con el backend:
1. Logout y re-login
2. Verificar que Supabase anon key sea la correcta
3. Verificar que el backend valide contra el mismo Supabase project

### "Token FCM null"
El simulador iOS no recibe tokens APNs reales. Usar dispositivo físico para probar push.

---

## Scripts disponibles

| Script | Propósito |
|--------|-----------|
| `./scripts/run_dev.sh` | Ejecutar con `.env.dev` |
| `./scripts/run_staging.sh` | Ejecutar con `.env.staging` |

---

## Endpoints consumidos por la app

Ver lista completa en los providers:
- `/auth/*` — F2
- `/feed`, `/swipes`, `/blocks`, `/reports` — F3
- `/matches/*` — F4
- `/esencias/*`, `/unlocks/*` — F5
- `/users/me/*` — F2/F6
- `/venues/*` — F7
- `/body-doubling/*` — F8
- `/meetups/*` — F9
- `/notifications/*` — F10
- `/spin/*` — F2 (onboarding)

# IAM Backend — Documentación por Etapas

**Stack:** NestJS (TypeScript strict) · Supabase (PostgreSQL + PostGIS + RLS) · JWT Auth

---

## Índice

- [Stage 1 — Setup Base](#stage-1--setup-base)
- [Stage 2 — Autenticación](#stage-2--autenticación)
- [Stage 3 — Usuarios & SpIn Tags](#stage-3--usuarios--spin-tags)
- [Stage 4 — Matching](#stage-4--matching)
- [Stage 5 — Chat](#stage-5--chat)
- [Stage 6 — Esencias (Token Economy)](#stage-6--esencias-token-economy)
- [Stage 7 — Venues](#stage-7--venues)
- [Stage 8 — Body Doubling](#stage-8--body-doubling)
- [Stage 9 — Meetup Confirmation](#stage-9--meetup-confirmation)
- [Stage 10 — Notificaciones](#stage-10--notificaciones)
- [Stage 11 — Admin Dashboard](#stage-11--admin-dashboard)
- [Tests](#tests)
- [Variables de entorno](#variables-de-entorno)

---

## Stage 1 — Setup Base

**Migración:** `001_feature_flags.sql`

Tabla `feature_flags` para activar/desactivar funcionalidades en producción sin redeploy.

| Flag | Default | Descripción |
|------|---------|-------------|
| `teen_mode_enabled` | false | Modo teen (14–17 años) |
| `venue_rewards_enabled` | false | Recompensas en venues |
| `body_doubling_enabled` | false | Sesiones de body doubling |
| `meetup_confirmations_enabled` | false | Confirmación de encuentros IRL |
| `notifications_enabled` | false | Sistema de notificaciones |
| `admin_dashboard_enabled` | false | Panel de administración |

---

## Stage 2 — Autenticación

**Migración:** `002_users.sql`
**Módulo:** `src/auth/`

### Tabla: `users`
| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK, mismo que auth.uid() de Supabase |
| `email` | TEXT | Email único |
| `display_name` | TEXT | Nombre público |
| `avatar_url` | TEXT | URL del avatar |
| `diagnosis` | TEXT | TEA · TDAH · AACC · DISLEXIA |
| `birth_date` | DATE | Para verificar edad mínima 14 años |
| `is_banned` | BOOLEAN | Baneado por moderación |
| `login_streak` | INTEGER | Días consecutivos de login |
| `last_login_at` | TIMESTAMPTZ | Último login |

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/auth/google` | Login con Google OAuth token |
| `POST` | `/auth/apple` | Login con Apple Sign In token |
| `GET` | `/auth/me` | Perfil del usuario autenticado |
| `POST` | `/auth/refresh` | Renovar JWT |

### JWT
- Header: `Authorization: Bearer <token>`
- Guard: `JwtAuthGuard` aplicado en todos los endpoints protegidos
- Payload: `{ id, email, iat, exp }`

---

## Stage 3 — Usuarios & SpIn Tags

**Migraciones:** `002_users.sql`, `003_spin.sql`
**Módulos:** `src/users/`, `src/spin/`, `src/onboarding/`

### Tabla: `spin_tags`
Catálogo de intereses especiales (Special Interests).

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `name` | TEXT | Nombre del interés |
| `category` | TEXT | Categoría agrupadora |
| `emoji` | TEXT | Emoji representativo |

### Tabla: `user_spin_tags`
Relación usuario ↔ SpIn tags (máx. 10 por usuario).

### Endpoints — Usuarios

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/users/me` | Mi perfil completo |
| `PATCH` | `/users/me` | Actualizar perfil |
| `GET` | `/users/:id` | Perfil público de otro usuario |
| `POST` | `/users/me/avatar` | Subir avatar |

### Endpoints — SpIn

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/spin/tags` | Catálogo de tags |
| `GET` | `/spin/tags/:category` | Tags por categoría |
| `GET` | `/spin/my-tags` | Mis SpIn tags |
| `POST` | `/spin/my-tags` | Agregar tag (máx. 10) |
| `DELETE` | `/spin/my-tags/:tagId` | Eliminar tag |

### Endpoints — Onboarding

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/onboarding/status` | Estado del onboarding |
| `POST` | `/onboarding/complete` | Marcar onboarding como completo |

### Login Streak
Calculado automáticamente en cada login:
- Mismo día → sin cambio
- Día siguiente → streak +1
- Más de 1 día de diferencia → reset a 1

---

## Stage 4 — Matching

**Migración:** `004_matching.sql`
**Módulo:** `src/matching/`

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `swipes` | Registro de likes/passes entre usuarios |
| `matches` | Match mutuo (user_a_id < user_b_id siempre) |
| `blocks` | Bloqueos entre usuarios |
| `reports` | Reportes de comportamiento inadecuado |

### Algoritmo de matching
1. Excluye usuarios ya vistos (swipes propios)
2. Excluye bloqueados/bloqueantes
3. Prioriza por **SpIn score** (intereses en común)
4. Filtra por proximidad si hay coordenadas GPS
5. Retorna máx. 20 perfiles por request

### SpIn Score
Calculado como intersección de tags dividido la unión:
```
score = |tags_comunes| / |tags_union| × 100
```

### Endpoints — Feed

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/feed` | Obtener perfiles para ver |
| `GET` | `/feed?lat=&lng=` | Feed con filtro de proximidad |

### Endpoints — Swipes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/swipes` | Registrar like/pass |
| `GET` | `/swipes/matches` | Mis matches activos |
| `GET` | `/swipes/matches/:id` | Detalle de un match |

### Endpoints — Blocks & Reports

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/blocks` | Bloquear usuario |
| `DELETE` | `/blocks/:userId` | Desbloquear |
| `GET` | `/blocks` | Lista de bloqueados |
| `POST` | `/reports` | Reportar usuario |

### Recompensa por match
Al crearse un match mutuo: **25 Esencias** para cada usuario (vía `RewardsService`).

---

## Stage 5 — Chat

**Migración:** `005_messages.sql`
**Módulo:** `src/chat/`

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `messages` | Mensajes entre usuarios matched |
| `message_reads` | Control de leídos |

### Reglas
- Solo usuarios con match activo pueden enviarse mensajes
- Mensajes sanitizados contra XSS
- Mensajes de usuarios baneados no visibles

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/chat/conversations` | Lista de conversaciones |
| `GET` | `/chat/conversations/:matchId` | Mensajes de una conversación |
| `POST` | `/chat/conversations/:matchId/messages` | Enviar mensaje |
| `POST` | `/chat/conversations/:matchId/read` | Marcar mensajes como leídos |

---

## Stage 6 — Esencias (Token Economy)

**Migraciones:** `006_esencias.sql`, `007_esencias_seed.sql`
**Módulo:** `src/esencias/`
**Servicios:** `EsenciasService`, `UnlocksService`, `RewardsService`

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `user_balance` | Balance actual por usuario |
| `esencias_transactions` | Historial de todas las transacciones |
| `unlock_rules` | Catálogo de features desbloqueables |
| `user_unlocks` | Features desbloqueadas por usuario |

### Mecánica: Earn → Transfer → Unlock

**Formas de ganar Esencias:**
| Evento | Cantidad |
|--------|----------|
| Login día 1–6 | 10 por día |
| Login día 7 (semanal) | 50 |
| Login día 14 (quincenal) | 100 |
| Login día 30 (mensual) | 200 |
| Crear match | 25 por usuario |
| Check-in en venue | 15 × multiplicador del venue |
| Completar body doubling | 20 (+ 10 bonus al host) |
| Confirmar meetup IRL | 30 por usuario |
| Admin grant | Variable |

**Unlocks por diagnóstico (costo en Esencias):**
| Diagnóstico | Feature | Costo |
|-------------|---------|-------|
| TEA | Sensory Dashboard | 50 |
| TEA | Deep Focus Theme | 100 |
| TDAH | Energy Boost | 50 |
| TDAH | Quick Nav Bar | 75 |
| AACC | Profundidad Extended | 50 |
| AACC | Advanced Search | 100 |
| DISLEXIA | Clarity Plus Font | 50 |
| DISLEXIA | Text Reader | 100 |

### Endpoints — Esencias

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/esencias/balance` | Mi balance actual |
| `GET` | `/esencias/transactions` | Historial de transacciones |
| `GET` | `/esencias/received` | Transferencias recibidas |
| `POST` | `/esencias/transfer` | Enviar Esencias a otro usuario |

### Endpoints — Unlocks

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/unlocks/rules` | Catálogo de unlocks disponibles |
| `GET` | `/unlocks/rules/:diagnosis` | Unlocks por diagnóstico |
| `GET` | `/unlocks/my-unlocks` | Mis features desbloqueadas |
| `GET` | `/unlocks/:id/status` | ¿Puedo desbloquear este feature? |
| `POST` | `/unlocks/:id/unlock` | Desbloquear feature (deduce balance) |

---

## Stage 7 — Venues

**Migraciones:** `008_venues.sql`, `009_venues_seed.sql`
**Módulo:** `src/venues/`

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `venues` | Locales físicos con ubicación PostGIS |
| `venue_checkins` | Check-ins con verificación GPS (200m) |
| `venue_reviews` | Reseñas con rating sensorial |
| `venue_favorites` | Favoritos por usuario |

### Campos especiales de venues
- `sensory_rating` — Rating de comodidad sensorial (1–5)
- `esencias_multiplier` — Multiplicador de recompensa (1.0–2.0×)
- `amenities` — Array: wifi, quiet_zone, natural_light, etc.
- `location` — GEOGRAPHY(POINT) PostGIS

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/venues/nearby?lat=&lng=&radius=` | Venues cercanos |
| `GET` | `/venues/search?q=` | Buscar venues |
| `GET` | `/venues/:id` | Detalle de venue |
| `POST` | `/venues/:id/checkin` | Hacer check-in (verifica GPS 200m) |
| `POST` | `/venues/:id/review` | Crear/actualizar reseña |
| `POST` | `/venues/:id/favorite` | Toggle favorito |
| `GET` | `/venues/my/checkins` | Mis check-ins |
| `GET` | `/venues/my/favorites` | Mis favoritos |

---

## Stage 8 — Body Doubling

**Migración:** `010_body_doubling.sql`
**Módulo:** `src/body-doubling/`

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `body_doubling_sessions` | Sesiones virtuales de co-trabajo |
| `body_doubling_participants` | Participantes por sesión |

### Ciclo de vida de una sesión
```
waiting → active → completed
                 → cancelled
```

### Tipos de actividad
`estudio`, `trabajo`, `arte`, `escritura`, `lectura`, `programacion`, `musica`, `ejercicio`, `meditacion`, `otro`

### Recompensas
- Al completar sesión: **20 Esencias** por participante activo
- Bonus para el host: **+10 Esencias** adicionales
- Requiere haber completado mínimo el **50%** del tiempo planificado

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/body-doubling/sessions` | Crear sesión |
| `GET` | `/body-doubling/sessions` | Sesiones públicas disponibles |
| `GET` | `/body-doubling/my-sessions` | Mis sesiones (host o participante) |
| `GET` | `/body-doubling/sessions/:id` | Detalle de sesión |
| `POST` | `/body-doubling/sessions/:id/join` | Unirse |
| `POST` | `/body-doubling/sessions/:id/leave` | Salir |
| `POST` | `/body-doubling/sessions/:id/start` | Iniciar (solo host) |
| `POST` | `/body-doubling/sessions/:id/complete` | Completar (solo host, da Esencias) |
| `POST` | `/body-doubling/sessions/:id/cancel` | Cancelar (solo host) |

---

## Stage 9 — Meetup Confirmation

**Migración:** `011_meetup_confirmations.sql`
**Módulo:** `src/meetups/`

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `meetup_confirmations` | Confirmaciones de encuentro IRL |
| `meetup_history` | Log de acciones por meetup |

### Flujo de confirmación
1. Usuario A llama `POST /meetups/initiate` → estado `pending`
2. Usuario B llama `POST /meetups/:id/confirm` → estado `confirmed`
3. Ambos reciben **30 Esencias**

### Reglas
- Ventana de confirmación: **48 horas** desde que el primero confirma
- Cooldown entre meetups del mismo match: **24 horas**
- Verificación GPS opcional (500m de radio, informativa — no bloquea)
- Se puede disputar un meetup falso: `POST /meetups/:id/dispute`

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/meetups/initiate` | Iniciar confirmación |
| `POST` | `/meetups/:id/confirm` | Confirmar (segundo usuario) |
| `GET` | `/meetups` | Mis meetups |
| `GET` | `/meetups/pending` | Pendientes que necesitan mi confirmación |
| `GET` | `/meetups/stats` | Estadísticas de meetups |
| `GET` | `/meetups/:id` | Detalle de meetup |
| `POST` | `/meetups/:id/dispute` | Disputar meetup falso |

---

## Stage 10 — Notificaciones

**Migración:** `012_notifications.sql`
**Módulo:** `src/notifications/`

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `notifications` | Notificaciones in-app |
| `user_devices` | Tokens de dispositivos para push |
| `notification_preferences` | Preferencias por usuario |

### Tipos de notificación
| Tipo | Evento |
|------|--------|
| `match_new` | Nuevo match |
| `message_new` | Nuevo mensaje |
| `meetup_initiated` | Alguien inició un meetup contigo |
| `meetup_confirmed` | Meetup confirmado |
| `meetup_expired` | Meetup expirado |
| `body_doubling_invite` | Invitación a body doubling |
| `body_doubling_start` | Sesión iniciada |
| `esencias_received` | Esencias recibidas |
| `esencias_earned` | Esencias ganadas |
| `unlock_available` | Balance suficiente para un unlock |
| `streak_milestone` | Hito de racha de login |
| `system` | Anuncio del sistema |

### Plataformas de dispositivos
`ios` · `android` · `web`

### Do Not Disturb (DND)
Configurable por hora (ej: 22:00–08:00). Durante DND no se envían pushes.

### Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/notifications` | Mis notificaciones |
| `GET` | `/notifications?unread=true` | Solo no leídas |
| `GET` | `/notifications/unread-count` | Conteo de no leídas |
| `POST` | `/notifications/:id/read` | Marcar como leída |
| `POST` | `/notifications/read-all` | Marcar todas como leídas |
| `POST` | `/notifications/devices` | Registrar dispositivo push |
| `DELETE` | `/notifications/devices` | Dar de baja dispositivo |
| `GET` | `/notifications/devices` | Mis dispositivos activos |
| `GET` | `/notifications/preferences` | Mis preferencias |
| `PATCH` | `/notifications/preferences` | Actualizar preferencias |

---

## Stage 11 — Admin Dashboard

**Migración:** `013_admin.sql`
**Módulo:** `src/admin/`

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `admin_roles` | Roles de administración |
| `moderation_actions` | Log de acciones de moderación |
| `moderation_queue` | Cola de reportes a revisar |

### Roles
| Rol | Permisos |
|-----|---------|
| `super_admin` | Todo, incluyendo gestión de roles |
| `admin` | Moderación completa, grants de Esencias |
| `moderator` | Cola de moderación, advertencias |

### Endpoints — Dashboard

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/stats` | Estadísticas de la plataforma |
| `GET` | `/admin/stats/diagnoses` | Usuarios por diagnóstico |

### Endpoints — Usuarios

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/users/search?q=` | Buscar usuarios |
| `GET` | `/admin/users/:id` | Detalle completo (admin view) |
| `POST` | `/admin/users/:id/ban` | Banear usuario |
| `POST` | `/admin/users/:id/unban` | Desbanear usuario |
| `POST` | `/admin/users/:id/warn` | Advertir usuario |
| `POST` | `/admin/users/:id/esencias` | Otorgar Esencias |

### Endpoints — Moderación

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/moderation/queue` | Cola de reportes |
| `POST` | `/admin/moderation/queue/:id/assign` | Asignarse un reporte |
| `POST` | `/admin/moderation/queue/:id/resolve` | Resolver reporte |
| `GET` | `/admin/actions` | Historial de acciones |

### Endpoints — Roles

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/admin/roles` | Listar admins activos |
| `POST` | `/admin/roles/grant` | Otorgar rol (solo super_admin) |
| `POST` | `/admin/roles/revoke` | Revocar rol (solo super_admin) |

---

## Tests

```bash
cd apps/backend

# Módulo específico
npx jest src/auth --no-coverage
npx jest src/users --no-coverage
npx jest src/matching --no-coverage
npx jest src/chat --no-coverage
npx jest src/esencias --no-coverage
npx jest src/venues --no-coverage
npx jest src/body-doubling --no-coverage
npx jest src/meetups --no-coverage
npx jest src/notifications --no-coverage
npx jest src/admin --no-coverage

# Suite completa
npx jest --no-coverage
```

**Estado actual:** 19 suites · 434 passed · 4 skipped · 0 failed

---

## Variables de entorno

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d

# Auth providers
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
APPLE_CLIENT_ID=com.yourapp.bundle

# App
PORT=3000
NODE_ENV=development
```

---

## Estructura de archivos

```
apps/backend/
├── src/
│   ├── admin/          # Stage 11
│   ├── auth/           # Stage 2
│   ├── body-doubling/  # Stage 8
│   ├── chat/           # Stage 5
│   ├── config/         # Validación de env vars
│   ├── esencias/       # Stage 6
│   ├── health/         # Health check
│   ├── matching/       # Stage 4
│   ├── meetups/        # Stage 9
│   ├── notifications/  # Stage 10
│   ├── onboarding/     # Stage 3 (parte)
│   ├── spin/           # Stage 3
│   ├── supabase/       # Cliente Supabase
│   ├── users/          # Stage 3
│   ├── venues/         # Stage 7
│   └── app.module.ts
├── supabase/
│   └── migrations/
│       ├── 001_feature_flags.sql
│       ├── 002_users.sql
│       ├── 003_spin.sql
│       ├── 004_matching.sql
│       ├── 005_messages.sql
│       ├── 006_esencias.sql
│       ├── 007_esencias_seed.sql
│       ├── 008_venues.sql
│       ├── 009_venues_seed.sql
│       ├── 010_body_doubling.sql
│       ├── 011_meetup_confirmations.sql
│       ├── 012_notifications.sql
│       └── 013_admin.sql
└── BACKEND.md          # Este archivo
```

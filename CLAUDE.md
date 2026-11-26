# CLAUDE.md — IAM Project Operating Manual

Este archivo es mi manual de operaciones. Lo leo al inicio de cada sesión para trabajar con autonomía.

---

## LEER ESTO PRIMERO — Estado del Proyecto

**Última actualización: 2026-11-26**

Antes de hacer cualquier cosa, revisar `git log --oneline -10`, `CHANGELOG.md`, `docs/planning.md` y `docs/issues.md` para conocer el estado exacto sin re-explorar el repo.

### Completado
- **Backend**: 14 módulos implementados, 485 tests pasando (21 suites, 0 skipped). Conectado a Supabase prod.
  - Auth, Onboarding, SpIn, Users+Streaks, Matching, Chat+WebSocket, Esencias+Rewards, Venues, Body Doubling, Meetups, Notifications, Photos, Admin
- **Mobile**: F1–F13 implementados. Widget tests F1–F13 cubiertos (19 tests F11-F13 añadidos). i18n ES/EN + a11y. CI/CD con GitHub Actions. Firebase FCM configurado.

### Pendientes (por orden de prioridad)
1. Tests de integración real contra Supabase (los actuales son unitarios con mocks)

### Etapa 8 — Moderación ✅ completada
- Rate limiting global: `ThrottlerModule` configurado en `AppModule`, 200 req/min por IP, guard global vía `APP_GUARD`
- Feature flag `teen_mode_enabled`: `FeatureFlagsService` con caché de 5 min, integrado en `OnboardingService` — registro de menores bloqueado si el flag está desactivado
- Tests: 22 suites, 499 tests pasando (0 skipped)

### Regla de sesión
No asumir nada sin leer el código. No avanzar a una etapa nueva si la anterior tiene tests rojos o pendientes abiertos.

### Ambiente de pruebas (Seed + Reset en 1 comando)
- `cd apps/backend && npm run seed:test-users`: siembra de forma idempotente 60 perfiles completos (`@iam.test`: 30 mujeres + 30 hombres, 2–4 fotos c/u, diagnósticos, SpIns y ubicación cercana al usuario real).
- `cd apps/backend && npm run reset:test-interactions`: limpia `swipes`, `matches`, `messages`, `meetup_confirmations`, `notifications`, `blocks` y `reports` de los usuarios `@iam.test`, dejando los 60 perfiles intactos (añadir `-- --no-likes` para no re-sembrar likes entrantes).

---

## Qué es IAM

App móvil de conexión social y citas **exclusivamente para personas neurodivergentes** (TEA, TDAH, AACC, Dislexia, etc.). El diferenciador central no es el matching digital — es **facilitar encuentros reales** entre personas que se entienden entre sí. El modelo de negocio combina freemium, venue partnerships y una economía de tokens digitales con recompensas físicas.

Mercado inicial: Chile. Multilenguaje desde la arquitectura.

---

## Stack

| Capa | Tecnología | Motivo |
|------|-----------|--------|
| Mobile | Flutter | UI altamente customizada, temas dinámicos, animaciones fluidas |
| Backend | NestJS (Node.js/TypeScript) | Estructura modular para proyecto de esta complejidad |
| Base de datos | Supabase (PostgreSQL + PostGIS) | Managed, realtime, auth, storage — reduce servicios GCP |
| Infraestructura | Google Cloud Run | Escala a 0, ideal para soft launch |
| Storage | Google Cloud Storage | Fotos de perfil optimizadas |
| Push notifications | Firebase Cloud Messaging | Ecosistema Google, soporte Android+iOS |
| Auth | Google Auth + Apple Sign In | Apple Sign In es obligatorio en iOS si hay login social |

---

## Estructura del Monorepo

```
/
├── CLAUDE.md
├── README.md
├── docs/
│   ├── architecture.md
│   ├── database-schema.md
│   ├── api-design.md
│   ├── ux-themes.md
│   ├── token-economy.md
│   ├── matching-algorithm.md
│   ├── venues-rewards.md
│   ├── development-stages.md
│   └── privacy-compliance.md
├── apps/
│   ├── mobile/          # Flutter app
│   └── backend/         # NestJS API
└── packages/
    └── shared/          # Tipos y validaciones compartidas (TypeScript + Dart)
```

---

## Reglas de Desarrollo — OBLIGATORIAS

### 1. Desarrollo por Etapas
Ver `docs/development-stages.md`. **No se avanza a la siguiente etapa sin que la actual pase todos sus tests.**

### 2. Testing — Filosofía
Cada etapa incluye tres tipos de tests:
- **Happy path**: El flujo funciona como se diseñó
- **Error forzado**: Se provocan errores deliberadamente (inputs inválidos, estados imposibles, race conditions)
- **Peor caso**: Carga máxima, datos extremos, usuarios maliciosos, red lenta

Backend: Jest + Supertest
Flutter: flutter_test (unit + widget + integration)

### 3. Convenciones de Código
- TypeScript estricto en backend (`strict: true`)
- Sin `any` explícito
- Nombres en inglés en código, comentarios en español si son explicativos
- Commits en inglés, formato: `type(scope): description`

### 4. Seguridad
- Los diagnósticos neurológicos son datos sensibles bajo Ley 19.628 (Chile)
- Nunca loggear datos personales
- Siempre validar en backend aunque el frontend también valide
- Row Level Security (RLS) activado en todas las tablas de Supabase

### 5. Feature Flags
Funcionalidades sensibles se controlan via tabla `feature_flags` en DB.
- `teen_mode_enabled`: activa el segmento 16-17 años
- Modificable desde panel admin sin nuevo deploy

---

## Decisiones de Diseño Clave

### Matching
- Basado en proximidad geográfica (PostGIS) + compatibilidad de SpIn
- Mecánica tipo swipe (mutual match como Tinder)
- Usuarios 16-17 SOLO ven y conectan con otros 16-17. Nunca aparecen para adultos.
- El rango del radio de búsqueda es configurable por el usuario

### SpIn (Special Interests)
- Lista curada de tags por categoría como base
- Opción de agregar tag custom con autocomplete (fuzzy match contra tags existentes)
- Límite: 5 SpIn por categoría, 20 en total
- Un tag custom se vuelve sugerible para otros cuando 3+ usuarios lo agregan
- Normalización interna: lowercase + sin caracteres especiales para evitar duplicados (ej: "rick y morty", "Rick and Morty", "rick and morty" → mismo tag)

### Temas de UI
**Actualizado 2026-11-26**: se descartó el theming dinámico por diagnóstico.
La app usa un único tema de marca basado en `logoOpcion2` vectorizado en 3 capas SVG con paleta **Celeste Sereno** (`#6BB9E8` fondo + `#FFFFFF` tipografía `iam_wordmark.svg` + `#EEB274` silueta central y 5 capas celestes `#4682A9..#8EC6ED` en `iam_crowd.svg`, más `iam_header_wordmark.svg` con la `i` en `#EEB274` y `am` en `#6BB9E8`), gobernado por `BrandPalette` (`BrandPalette.celesteSereno` activo, regenerable con `tools/brand/vectorize_logo.py`) en
`apps/mobile/lib/core/design/design_tokens.dart` y `core/theme/app_theme.dart`. Cambios de paleta/color/logo/spacing/radios se
hacen en `design_tokens.dart` (y `tools/brand/vectorize_logo.py` para los SVG/Adaptive Icon). `docs/ux-themes.md` documenta la
exploración de diseño original (histórica, ya no vigente).

### Notificaciones — "El Dial"
- Nivel 1 (Santuario): batch diario a hora definida por usuario
- Nivel 2 (Equilibrio): batch cada 4 horas
- Nivel 3 (Hiper-foco Social): tiempo real

### Sistema de Esencias (Tokens)
Ver `docs/token-economy.md`.

### Venues y Recompensas Físicas
Ver `docs/venues-rewards.md`.
- Usuarios desbloquean recompensas reales (café, descuentos) al alcanzar logros/rachas
- Los venues tienen una app separada para escanear QR de canje
- Esta es la capa B2B del negocio

### Compresión de Imágenes
- Client-side: redimensionar a max 1080x1080px, convertir a WebP, comprimir al 80%
- Target: imágenes de ~150KB en lugar de 10MB

---

## Lo que NO está en el MVP
- Audio / video / notas de voz
- Eventos grupales (roadmap futuro)
- Monetización de Esencias premium (roadmap futuro)
- Expansión fuera de Chile (arquitectura multilenguaje lista, pero lanzamiento solo Chile)

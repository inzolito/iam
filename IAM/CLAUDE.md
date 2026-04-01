# CLAUDE.md — IAM Project Operating Manual

Este archivo es mi manual de operaciones. Lo leo al inicio de cada sesión para trabajar con autonomía.

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
Ver `docs/ux-themes.md`. La UI muta según el/los diagnósticos del usuario.

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

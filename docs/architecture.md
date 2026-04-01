# Arquitectura — IAM

## Visión General

IAM es un monorepo con tres aplicaciones:
1. **Mobile** (Flutter) — App principal para usuarios neurodivergentes
2. **Backend** (NestJS) — API REST + WebSockets
3. **Venue App** (Flutter) — App simplificada para socios/venues

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTES                            │
│                                                         │
│  ┌─────────────────┐      ┌─────────────────────────┐  │
│  │  App Mobile     │      │  Venue App              │  │
│  │  (Flutter)      │      │  (Flutter)              │  │
│  │  iOS + Android  │      │  iOS + Android          │  │
│  └────────┬────────┘      └───────────┬─────────────┘  │
└───────────┼───────────────────────────┼─────────────────┘
            │ HTTPS / WSS               │ HTTPS
┌───────────┼───────────────────────────┼─────────────────┐
│           ▼         BACKEND           ▼                 │
│   ┌───────────────────────────────────────────┐         │
│   │         NestJS API                        │         │
│   │         Google Cloud Run                  │         │
│   │                                           │         │
│   │  ┌──────────┐  ┌──────────┐  ┌────────┐  │         │
│   │  │ Auth     │  │ Matching │  │Venues  │  │         │
│   │  │ Module   │  │ Module   │  │Module  │  │         │
│   │  └──────────┘  └──────────┘  └────────┘  │         │
│   │  ┌──────────┐  ┌──────────┐  ┌────────┐  │         │
│   │  │ Chat     │  │ Esencias │  │Users   │  │         │
│   │  │ Module   │  │ Module   │  │Module  │  │         │
│   │  └──────────┘  └──────────┘  └────────┘  │         │
│   └───────────────────────────────────────────┘         │
│           │                   │                         │
│    ┌──────┘                   └──────┐                  │
│    ▼                                 ▼                  │
│  ┌──────────────────┐   ┌────────────────────────────┐  │
│  │    Supabase      │   │   Google Cloud Storage     │  │
│  │                  │   │   (Fotos de perfil WebP)   │  │
│  │  PostgreSQL      │   └────────────────────────────┘  │
│  │  + PostGIS       │                                   │
│  │  + Realtime      │   ┌────────────────────────────┐  │
│  │  + Auth          │   │  Firebase Cloud Messaging  │  │
│  └──────────────────┘   │  (Push notifications)      │  │
│                         └────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Decisiones de Stack

### Flutter (Mobile)
- UI altamente personalizada por diagnóstico requiere control total del rendering
- Animaciones fluidas (partículas, fractales) sin bridge nativo
- Un codebase para iOS y Android
- Theming dinámico nativo del framework

### NestJS (Backend)
- TypeScript estricto
- Arquitectura modular — cada dominio (Auth, Matching, Chat, etc.) es un módulo independiente
- Decoradores nativos para guards, interceptors, pipes de validación
- WebSockets integrado via @nestjs/websockets

### Supabase
- PostgreSQL gestionado con PostGIS para queries geoespaciales (proximidad)
- Realtime subscriptions para chat (sin WebSocket propio para mensajes)
- Row Level Security (RLS) para seguridad a nivel de DB
- Storage para assets si se necesita backup de Cloud Storage
- Elimina necesidad de gestionar instancias de DB

### Google Cloud Run
- Escala a 0 instancias cuando no hay tráfico (costo ~$0 en períodos de baja actividad)
- Escala automática ante picos virales
- Sin gestión de servidores

---

## Flujos Principales

### Flujo de Autenticación
```
Usuario → Google/Apple Auth → Token ID
→ POST /auth/[provider] { idToken }
→ Backend verifica con proveedor
→ Crea/recupera usuario en DB
→ Emite JWT propio
→ Cliente almacena JWT
```

### Flujo de Matching
```
Usuario abre feed
→ GET /feed { lat, lng, radius }
→ Backend consulta PostGIS: usuarios en radio
→ Filtra por: no vistos, no bloqueados, rango de edad correcto
→ Ordena por score de compatibilidad SpIn
→ Retorna cards paginadas

Usuario hace swipe like
→ POST /swipe { target_id, direction: "like" }
→ Backend guarda acción
→ Verifica si target también dio like
→ Si match mutuo: crea Match, notifica a ambos via FCM
```

### Flujo de Canje de Recompensa
```
Usuario desbloquea recompensa (racha, logro)
→ GET /users/me/rewards muestra recompensa disponible
→ POST /rewards/:id/redeem
→ Backend genera código único alfanumérico + QR data
→ Usuario muestra QR en venue
→ Venue App escanea QR
→ POST /venue/scan { code }
→ Backend invalida código + registra canje
→ Venue App muestra confirmación
```

---

## Seguridad

- JWT con expiración corta (15min) + refresh tokens
- Rate limiting por IP y por usuario
- RLS en Supabase: cada usuario solo accede a sus datos
- Datos de diagnóstico: cifrados en tránsito (TLS), acceso restringido via RLS
- Feature flags en DB para funcionalidades sensibles (ej: teen_mode)
- Separación total de datos de menores (16-17) de adultos a nivel de query

---

## Internacionalización

- Backend: respuestas de error con códigos, no strings (el cliente traduce)
- Flutter: `flutter_localizations` + archivos `.arb` por idioma
- DB: contenido curado (categorías SpIn, etc.) con tabla de traducciones
- Lanzamiento: `es-CL`. Preparado para `en`, `pt-BR`

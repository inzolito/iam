# IAM Mobile — Documentación por Etapas

## Visión General

App Flutter para conexiones neurodiversas. Temas adaptativos por diagnóstico (TEA, TDAH, AACC, Dislexia), autenticación OAuth (Google/Apple), onboarding con selección de diagnóstico e intereses especiales (SpIn).

**Stack**: Flutter 3.x · Provider · GoRouter · FlutterSecureStorage · Google Sign In · Apple Sign In

**Ejecución**:
```bash
flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
flutter test
```

---

## F1 — Fundamentos

**Objetivo**: Establecer la base arquitectónica de la app.

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/main.dart` | Entry point. MultiProvider, tema dinámico por diagnóstico, MaterialApp.router |
| `lib/core/config/env.dart` | Variables de entorno via `--dart-define` |
| `lib/core/services/api_service.dart` | Cliente HTTP con JWT auto-header. GET/POST/PATCH. ApiException tipada |
| `lib/core/services/storage_service.dart` | FlutterSecureStorage wrapper. Tokens JWT, userId, diagnóstico, onboarding |
| `lib/core/theme/iam_themes.dart` | 4 temas por diagnóstico + default |
| `lib/features/home/home_shell.dart` | Shell con NavigationBar inferior (Feed, Chat, Explorar, Perfil) |

### Temas por diagnóstico

| Diagnóstico | Brightness | Primary | Font | Enfoque UX |
|-------------|-----------|---------|------|------------|
| TEA | light | `#7EB8D4` | Nunito | Calma, predecibilidad |
| TDAH | dark | `#7C6AF7` | Nunito | Energía controlada |
| AACC | light | `#4A7C59` | Nunito | Profundidad intelectual |
| Dislexia | light | `#2E7D6E` | OpenDyslexic | Legibilidad máxima |

### Arquitectura

```
lib/
├── core/
│   ├── config/env.dart          # Variables de entorno
│   ├── services/                # Capa de servicios
│   │   ├── api_service.dart     # HTTP client
│   │   └── storage_service.dart # Almacenamiento seguro
│   ├── providers/               # Estado global
│   │   └── auth_provider.dart   # Autenticación
│   ├── router/                  # Navegación
│   │   └── app_router.dart      # GoRouter + guards
│   └── theme/                   # Temas visuales
│       └── iam_themes.dart
├── features/
│   ├── auth/                    # Login + Splash
│   ├── home/                    # Shell con nav inferior
│   └── onboarding/              # Flujo de onboarding
```

### Tests (9 tests)

**`test/api_service_test.dart`**
- Happy Path: crear con baseUrl custom, setToken, ApiException con statusCode/message, toString
- Error Forzado: ApiException con códigos 400/500, mensaje vacío
- Peor Caso: setToken con string vacío, sobreescribir token

**`test/theme_test.dart`** (8 tests)
- Happy Path: TEA light con color calmado, TDAH dark con energía, AACC light con profundidad, Dislexia light con claridad, default es TEA
- Peor Caso: fontFamily Nunito excepto Dislexia (OpenDyslexic), surface/onSurface definidos, TDAH único dark

---

## F2 — Autenticación

**Objetivo**: Login con Google/Apple, gestión de sesión, router con guards.

### Flujo de auth

```
App inicia → SplashScreen → authProvider.initialize()
                               ├─ token guardado → restoreSession() → /auth/me
                               │   ├─ user con onboarding completo → authenticated → /feed
                               │   ├─ user sin onboarding → onboarding → /onboarding
                               │   └─ token inválido → tryRefresh → unauthenticated → /login
                               └─ sin token → unauthenticated → /login

LoginScreen → signInWithGoogle() / signInWithApple()
                ├─ OAuth → idToken → POST /auth/{provider}
                │   ├─ success + newUser → onboarding → /onboarding
                │   ├─ success + existingUser → authenticated → /feed
                │   └─ error → mostrar mensaje amigable
                └─ cancelado → LOGIN_CANCELLED (sin cambiar estado)
```

### AuthProvider — Estados

| Estado | Significado | Ruta |
|--------|-------------|------|
| `initial` | Verificando sesión | `/splash` |
| `unauthenticated` | Sin sesión activa | `/login` |
| `onboarding` | Autenticado, falta onboarding | `/onboarding` |
| `authenticated` | Sesión completa | `/feed` |

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/core/services/auth_service.dart` | OAuth Google/Apple, backend auth, restore session, token refresh, signOut |
| `lib/core/providers/auth_provider.dart` | ChangeNotifier con 4 estados, isLoading, error handling |
| `lib/core/router/app_router.dart` | GoRouter con redirect por AuthStatus. ShellRoute para tabs |
| `lib/features/auth/splash_screen.dart` | Logo "IAM" + spinner, llama initialize() en mount |
| `lib/features/auth/login_screen.dart` | Botones Google/Apple, errores amigables, footer legal |

### AuthService — Métodos

| Método | Descripción |
|--------|-------------|
| `signInWithGoogle()` | OAuth → idToken → POST /auth/google → guardar tokens |
| `signInWithApple()` | OAuth → idToken → POST /auth/apple → guardar tokens |
| `restoreSession()` | Leer token → GET /auth/me → AuthUser. Auto-refresh si 401 |
| `signOut()` | Limpiar Google session + tokens + storage |
| `isAppleSignInAvailable` | true solo en iOS/macOS |

### AuthProvider — Métodos

| Método | Descripción |
|--------|-------------|
| `initialize()` | Restaurar sesión guardada, determinar estado |
| `signInWithGoogle()` | Login Google → isLoading → resultado |
| `signInWithApple()` | Login Apple → isLoading → resultado |
| `completeOnboarding()` | Marcar onboarding completo → authenticated |
| `signOut()` | Limpiar todo → unauthenticated |
| `clearError()` | Limpiar error actual |

### Router — Rutas

| Ruta | Pantalla | Guard |
|------|----------|-------|
| `/splash` | SplashScreen | Solo en estado initial |
| `/login` | LoginScreen | Solo en unauthenticated |
| `/onboarding` | OnboardingScreen | Solo en onboarding |
| `/feed` | FeedScreen | authenticated, tab activa |
| `/chat` | ChatListScreen | authenticated |
| `/chat/:matchId` | ChatScreen | authenticated |
| `/explore` | PlaceholderPage | authenticated |
| `/profile` | PlaceholderPage | authenticated |

### Tests (18 tests)

**`test/auth_provider_test.dart`**

**Happy Path** (9):
- Estado inicial es `initial`
- initialize con sesión activa → `authenticated`
- initialize sin sesión → `unauthenticated`
- initialize con usuario nuevo → `onboarding`
- signInWithGoogle exitoso → `authenticated`
- signInWithGoogle usuario nuevo → `onboarding`
- completeOnboarding cambia a `authenticated`
- signOut limpia estado
- isAppleSignInAvailable refleja el servicio

**Error Forzado** (3):
- signInWithGoogle fallido setea error y isLoading=false
- signInWithGoogle cancelado no cambia status
- signInWithApple fallido setea error

**Peor Caso** (6):
- initialize con excepción → `unauthenticated`
- doble signOut no falla
- isLoading correcta después de completar signIn
- AuthUser.fromJson con campos mínimos
- AuthUser.fromJson con todos los campos
- clearError limpia error

---

## F3 — Feed & Matching

**Objetivo**: Pantalla de descubrimiento de perfiles con like/pass, matches mutuos, bloqueo y reportes.

### Flujo del feed

```
FeedScreen monta → feedProvider.loadFeed()
                     └─ GET /feed?page=0&radius=15000
                          → Lista de FeedProfile (20 por página)

Usuario ve ProfileCard:
  ├─ Like → POST /swipes {targetUserId, direction:'like'}
  │   ├─ matched: false → avanza al siguiente
  │   └─ matched: true → MatchDialog + avanza
  ├─ Pass → POST /swipes {targetUserId, direction:'pass'} → avanza
  ├─ Bloquear → POST /blocks {userId} → elimina del feed
  └─ Reportar → POST /reports {userId, reason, description?}

Cuando quedan <3 perfiles → loadMore() automático (paginación)
Cuando se agotan todos → pantalla "No hay mas perfiles" + botón actualizar
```

### FeedProfile — Modelo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | UUID del usuario |
| `displayName` | String? | Nombre visible |
| `avatarUrl` | String? | URL del avatar |
| `isTeen` | bool | Menor de 18 |
| `energyLevel` | int | Nivel de energía (1-3) |
| `msnStatus` | String? | Estado MSN (160 chars) |
| `spin` | List\<String\> | Tags de intereses especiales |
| `matchScore` | double | Compatibilidad (0-1), 70% SpIn + 30% proximidad |
| `distance` | double | Distancia en metros |

**Helpers**: `formattedDistance` (5.2 km / 800 m), `compatibilityPercent` (87%)

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/features/feed/feed_profile.dart` | Modelo FeedProfile con fromJson y helpers |
| `lib/features/feed/feed_provider.dart` | ChangeNotifier: loadFeed, like, pass, block, report, paginación |
| `lib/features/feed/feed_screen.dart` | Pantalla principal: estados loading/error/vacío/card |
| `lib/features/feed/widgets/profile_card.dart` | Card con avatar, nombre, distancia, compatibilidad, SpIn tags, botones |
| `lib/features/feed/widgets/match_dialog.dart` | Dialog de match mutuo con opción de mensaje |

### FeedProvider — Métodos

| Método | Descripción |
|--------|-------------|
| `loadFeed({radius?})` | Cargar primera página del feed |
| `loadMore({radius?})` | Cargar siguiente página (auto cuando quedan <3) |
| `like(targetUserId)` | Dar like, detecta match mutuo |
| `pass(targetUserId)` | Pasar perfil |
| `blockUser(userId)` | Bloquear y eliminar del feed local |
| `reportUser(userId, reason, {description?})` | Enviar reporte |
| `clearLastMatch()` | Limpiar match después de cerrar dialog |
| `clearError()` | Limpiar error |

### FeedProvider — Estado

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `profiles` | List\<FeedProfile\> | Perfiles cargados |
| `currentIndex` | int | Índice del perfil visible |
| `currentProfile` | FeedProfile? | Perfil actual (null si agotado) |
| `isLoading` | bool | Cargando datos |
| `error` | String? | Último error |
| `hasMore` | bool | Hay más páginas disponibles |
| `lastMatch` | Map? | Datos del último match (para dialog) |
| `isEmpty` | bool | Feed vacío sin loading |
| `isExhausted` | bool | Se acabaron todos los perfiles |

### Tests (33 tests)

**`test/feed_provider_test.dart`**

**Happy Path** (11):
- Estado inicial vacío sin loading
- loadFeed carga perfiles del backend
- loadFeed con radius pasa query param
- like avanza al siguiente perfil
- pass avanza al siguiente perfil
- like con match mutuo guarda lastMatch
- clearLastMatch limpia el match
- loadMore agrega perfiles a la lista
- blockUser elimina perfil del feed
- reportUser envía reporte al backend
- clearError limpia error

**Error Forzado** (6):
- loadFeed con error del servidor
- loadFeed con excepción genérica
- like con error no avanza perfil
- loadMore con error revierte página
- blockUser con error mantiene perfil
- reportUser con error setea error

**Peor Caso** (9):
- loadFeed con respuesta vacía
- isExhausted cuando se acabaron todos
- hasMore false con <20 perfiles
- hasMore true con 20 perfiles
- loadMore no hace nada si hasMore=false
- loadMore no hace nada si ya loading
- loadFeed resetea estado previo
- like sin match no guarda lastMatch
- blockUser ajusta index

**FeedProfile** (7):
- fromJson parsea todos los campos
- fromJson con campos mínimos
- formattedDistance km y metros
- compatibilityPercent formatos (0%, 87%, 100%)

---

## F4 — Chat

**Objetivo**: Mensajería entre matches — lista de conversaciones, historial de mensajes, envío, mark-read.

### Flujo del chat

```
ChatListScreen monta → chatProvider.loadConversations()
                          └─ GET /matches → lista de ChatConversation
                               (match + otherUser + lastMessage + unreadCount)

ChatListScreen → tap conversación → ChatScreen(matchId)
                                       └─ openConversation(matchId)
                                            ├─ GET /matches/:id/messages?page=0
                                            └─ PATCH /matches/:id/read (auto mark-read)

ChatScreen:
  ├─ Scroll arriba → loadOlderMessages() (paginación 50/página)
  ├─ Escribir + enviar → POST /matches/:id/messages {content}
  │   └─ Mensaje agregado a lista local + lastMessage actualizado
  └─ Volver → closeConversation()
```

### Modelos

| Clase | Campos |
|-------|--------|
| `ChatMessage` | id, matchId, senderId, content, createdAt, readAt, isRead |
| `ChatUser` | id, displayName?, avatarUrl? |
| `ChatConversation` | matchId, otherUser, lastMessage?, unreadCount, hasUnread |

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/features/chat/chat_models.dart` | ChatMessage, ChatUser, ChatConversation con fromJson |
| `lib/features/chat/chat_provider.dart` | ChangeNotifier: conversaciones, mensajes, envío, mark-read |
| `lib/features/chat/chat_list_screen.dart` | Lista de conversaciones con avatar, último mensaje, unread badge |
| `lib/features/chat/chat_screen.dart` | Chat individual con burbujas, input, scroll-to-load |

### ChatProvider — Métodos

| Método | Descripción |
|--------|-------------|
| `loadConversations()` | GET /matches → lista de conversaciones |
| `openConversation(matchId)` | Cargar mensajes + auto mark-read |
| `loadOlderMessages()` | Paginación hacia atrás (50/página) |
| `sendMessage(content)` | POST mensaje, actualiza lastMessage en conv |
| `markAsRead(matchId)` | PATCH /matches/:id/read, actualiza unread local |
| `closeConversation()` | Limpiar estado de mensajes activos |
| `totalUnreadCount` | Suma de unread de todas las conversaciones |

### Rutas

| Ruta | Pantalla |
|------|----------|
| `/chat` | ChatListScreen (lista) |
| `/chat/:matchId` | ChatScreen (conversación individual) |

### Tests (27 tests)

**`test/chat_provider_test.dart`**

**Happy Path** (9):
- Estado inicial limpio
- loadConversations carga lista
- totalUnreadCount suma todos los unread
- openConversation carga mensajes
- sendMessage agrega a la lista
- loadOlderMessages agrega al inicio
- markAsRead actualiza unread local
- closeConversation limpia estado
- clearError limpia error

**Error Forzado** (6):
- loadConversations con error
- openConversation con match inexistente
- sendMessage con contenido vacío
- sendMessage sin conversación activa
- sendMessage con error del servidor
- loadOlderMessages con error revierte página

**Peor Caso** (6):
- Conversaciones vacías
- Mensajes vacíos
- loadOlderMessages con hasMore=false
- loadOlderMessages sin conversación activa
- sendMessage actualiza lastMessage en conversación
- markAsRead silencia errores

**ChatModels** (6):
- ChatMessage.fromJson completo + isRead
- ChatMessage sin readAt
- ChatUser.fromJson completo + mínimo
- ChatConversation.fromJson completo + sin lastMessage

---

## Etapas pendientes

| Etapa | Nombre | Descripción |
|-------|--------|-------------|
| F5 | Esencias | Token economy, balance, transfers, unlocks |
| F6 | Venues | Mapa de venues seguros, check-in |
| F7 | Body Doubling | Sesiones de coworking virtual |
| F8 | Meetups | Confirmación de meetups presenciales |
| F9 | Notificaciones | Push notifications, preferencias |
| F10 | Perfil | Edición de perfil, settings, diagnóstico |

---

## Resumen de Tests

| Test file | Tests | Etapa |
|-----------|-------|-------|
| `test/api_service_test.dart` | 9 | F1 |
| `test/theme_test.dart` | 8 | F1 |
| `test/auth_provider_test.dart` | 18 | F2 |
| `test/onboarding_provider_test.dart` | 26 | F2 (pre-existente) |
| `test/feed_provider_test.dart` | 33 | F3 |
| `test/chat_provider_test.dart` | 27 | F4 |
| `test/widget_test.dart` | 1 | F1 |
| **Total** | **122** | |

Todos los tests pasan con `flutter test`.

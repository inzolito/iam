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
| `/explore` | EsenciasScreen | authenticated |
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

## F5 — Esencias (Token Economy)

**Objetivo**: Balance de Esencias, historial de transacciones, transferencias P2P, tienda de desbloqueos por diagnóstico.

### Flujo

```
EsenciasScreen (3 tabs):
  ├─ Balance → GET /esencias/balance → {balance, totalEarned, totalSpent}
  ├─ Historial → GET /esencias/transactions → lista de transacciones
  └─ Tienda → GET /unlocks/rules + GET /unlocks/my-unlocks
                 → lista de features con botón de desbloqueo
                 → POST /unlocks/:id/unlock (deduce balance)

Transfer: POST /esencias/transfer {toUserId, amount, message?}
```

### Modelos

| Clase | Campos clave |
|-------|-------------|
| `EsenciasBalance` | balance, totalEarned, totalSpent |
| `EsenciasTransaction` | id, fromUserId?, toUserId, amount, reason, type, reasonLabel |
| `UnlockRule` | id, diagnosis, featureKey, featureName, requiredEsencias, category, uiSettings |
| `UserUnlock` | id, unlockId, featureKey, featureName, unlockedAt, isActive |

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/features/esencias/esencias_models.dart` | 4 modelos con fromJson |
| `lib/features/esencias/esencias_provider.dart` | Balance, transacciones, transfers, unlocks |
| `lib/features/esencias/esencias_screen.dart` | 3 tabs: Balance, Historial, Tienda |

### EsenciasProvider — Métodos

| Método | Descripción |
|--------|-------------|
| `loadBalance()` | GET /esencias/balance |
| `loadTransactions()` | GET /esencias/transactions con paginación |
| `transfer(toUserId, amount, message?)` | POST /esencias/transfer |
| `loadUnlockRules(diagnosis?)` | GET /unlocks/rules o /unlocks/rules/:diagnosis |
| `loadUserUnlocks()` | GET /unlocks/my-unlocks → unlockedFeatureKeys set |
| `unlockFeature(unlockId)` | POST /unlocks/:id/unlock → actualiza balance y unlocks |
| `isFeatureUnlocked(featureKey)` | Check local en unlockedFeatureKeys |

### Tests (27 tests)

**`test/esencias_provider_test.dart`**

**Happy Path** (9): estado inicial, loadBalance, loadTransactions, transfer, loadUnlockRules (con/sin diagnosis), loadUserUnlocks, unlockFeature, clearError

**Error Forzado** (5): loadBalance error, transfer insuficiente, unlockFeature diagnosis mismatch, loadTransactions timeout, transfer error genérico

**Peor Caso** (5): respuesta vacía, loadUserUnlocks vacío, transfer actualiza totalSpent, isFeatureUnlocked sin cargar, unlockFeature success=false

**Models** (8): EsenciasBalance, EsenciasTransaction (grant/transfer/deduction/default reason), UnlockRule, UserUnlock (con/sin isActive)

---

---

## F6 — Perfil de Usuario

**Objetivo**: Visualizar y editar el perfil del usuario autenticado — nombre, username, estado MSN, diagnósticos, nivel de energía.

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/features/profile/profile_models.dart` | UserProfile (id, email, username, displayName, birthDate, isTeen, avatarUrl, msnStatus, energyLevel, notifLevel, isActive, onboardingCompleted, createdAt) + UserDiagnosis. Helper: `initials` |
| `lib/features/profile/profile_provider.dart` | loadProfile, loadDiagnoses, updateProfile, clearError. `primaryDiagnosis` getter |
| `lib/features/profile/profile_screen.dart` | Avatar, nombre, username, MSN status, chips de diagnósticos, filas de info, bottom sheet edición, botón cerrar sesión |

### ProfileProvider — Métodos

| Método | Descripción |
|--------|-------------|
| `loadProfile()` | GET /profile/me → UserProfile |
| `loadDiagnoses()` | GET /profile/diagnoses → List\<UserDiagnosis\> (silencia errores) |
| `updateProfile({displayName?, username?, msnStatus?, energyLevel?, notifLevel?})` | PATCH /profile/me → UserProfile actualizado. Retorna false si no hay campos |
| `clearError()` | Limpiar error |

### Tests (21 tests)

**`test/profile_provider_test.dart`**

**Happy Path** (6): estado inicial, loadProfile carga perfil, loadDiagnoses (2 diagnósticos), updateProfile (displayName+msnStatus), updateProfile con username, clearError

**Error Forzado** (4): loadProfile con error, updateProfile con USERNAME_TAKEN, updateProfile sin campos retorna false, loadDiagnoses silencia errores

**Peor Caso** (3): perfil con campos mínimos, diagnósticos vacíos, primaryDiagnosis sin primary flag

**ProfileModels** (8): UserProfile.fromJson completo/mínimo, initials con displayName/username/sin nombre, UserDiagnosis.fromJson completo/isPrimary default false

---

## F7 — Venues

**Objetivo**: Descubrir lugares seguros y accesibles para neurodivergentes — cafeterías, bibliotecas, coworkings — con filtros por categoría, rating sensorial y distancia.

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/features/venues/venues_provider.dart` | VenueSummary model + VenuesProvider |
| `lib/features/venues/venues_screen.dart` | Lista de venues con filtros, tarjetas con sensoryRating y distancia |

### VenueSummary — Modelo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | UUID del venue |
| `name` | String | Nombre del lugar |
| `category` | String? | cafe, biblioteca, parque, etc. |
| `address` | String? | Dirección textual |
| `sensoryRating` | double? | Rating sensorial (0-5) |
| `averageRating` | double? | Rating general (0-5) |
| `reviewCount` | int | Número de reseñas |
| `distance` | double? | Distancia en metros |
| `imageUrl` | String? | URL de imagen |
| `isFavorite` | bool | Marcado como favorito |

**Helper**: `formattedDistance` → "750 m" / "2.5 km" / "" si null

### VenuesProvider — Métodos

| Método | Descripción |
|--------|-------------|
| `loadNearby({lat, lng, radius?, category?})` | GET /venues/nearby/me con query params |
| `loadFavorites()` | GET /venues/user/favorites (silencia errores) |
| `toggleFavorite(venueId)` | POST /venues/:id/favorite |
| `checkIn(venueId, {lat, lng})` | POST /venues/:id/checkin |
| `clearError()` | Limpiar error |

### Tests (18 tests)

**`test/venues_provider_test.dart`**

**Happy Path** (7): estado inicial, loadNearby, loadNearby con filtros (radius+category), loadFavorites, toggleFavorite, checkIn, clearError

**Error Forzado** (5): loadNearby ApiException, excepción genérica, toggleFavorite error, checkIn error, loadFavorites silencia errores

**Peor Caso** (6): venues vacíos, respuesta sin campo venues, formattedDistance metros/km/null, venue campos mínimos

---

## F8 — Body Doubling

**Objetivo**: Sesiones de trabajo compartido para neurodivergentes — crear/unirse a sesiones de foco con otros usuarios de la comunidad.

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/features/body_doubling/body_doubling_provider.dart` | BdSession model + BodyDoublingProvider |
| `lib/features/body_doubling/body_doubling_screen.dart` | Lista de sesiones activas, FAB para crear, tarjetas con estado y cupo |

### BdSession — Modelo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | UUID |
| `hostId` | String | Usuario anfitrión |
| `hostName` | String? | Nombre del anfitrión |
| `title` | String | Título de la sesión |
| `activityType` | String | study / work / creative / exercise |
| `durationMinutes` | int | Duración (25, 45, 60, 90) |
| `maxParticipants` | int | Cupo máximo (default 5) |
| `currentParticipants` | int | Participantes actuales |
| `status` | String | waiting / active |
| `isPublic` | bool | Sesión pública |

**Helpers**: `isFull`, `isActive`, `isWaiting`

### BodyDoublingProvider — Métodos

| Método | Descripción |
|--------|-------------|
| `loadSessions({activity?})` | GET /body-doubling/sessions |
| `loadMySessions()` | GET /body-doubling/my-sessions (silencia errores) |
| `createSession({title, activityType, durationMinutes, description?, maxParticipants?})` | POST y recarga |
| `joinSession(sessionId)` | POST /body-doubling/sessions/:id/join |
| `leaveSession(sessionId)` | POST /body-doubling/sessions/:id/leave |
| `clearError()` | Limpiar error |

### Tests (20 tests)

**`test/body_doubling_provider_test.dart`**

**Happy Path** (8): estado inicial, loadSessions, loadSessions con filtro actividad, loadMySessions, createSession, joinSession, leaveSession, clearError

**Error Forzado** (6): loadSessions ApiException/genérica, createSession INVALID_DURATION, joinSession SESSION_FULL, leaveSession error, loadMySessions silencia errores

**Peor Caso** (6): sesiones vacías, respuesta sin campo sessions, BdSession.isFull, isActive, isWaiting, campos mínimos

---

## F9 — Meetups

**Objetivo**: Gestión de encuentros presenciales con matches — iniciar, confirmar y disputar meetups con expiración.

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/features/meetups/meetups_provider.dart` | Meetup model + MeetupsProvider |
| `lib/features/meetups/meetups_screen.dart` | 2 tabs: Pendientes / Historial. Tarjetas con confirmaciones y acciones |

### Meetup — Modelo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | UUID |
| `matchId` | String | Match relacionado |
| `status` | String | pending / confirmed |
| `userAConfirmed` | bool | Confirmación usuario A |
| `userBConfirmed` | bool | Confirmación usuario B |
| `expiresAt` | DateTime? | Fecha de expiración |
| `createdAt` | DateTime | Creación |

**Helpers**: `isPending`, `isConfirmed`, `isExpired`

### MeetupsProvider — Métodos

| Método | Descripción |
|--------|-------------|
| `loadMeetups({status?})` | GET /meetups con filtro opcional |
| `loadPending()` | GET /meetups/pending (silencia errores) |
| `initiateMeetup(matchId, {lat?, lng?})` | POST /meetups/initiate |
| `confirmMeetup(meetupId, {lat?, lng?})` | POST /meetups/:id/confirm |
| `disputeMeetup(meetupId)` | POST /meetups/:id/dispute |
| `clearError()` | Limpiar error |

### Tests (22 tests)

**`test/meetups_provider_test.dart`**

**Happy Path** (9): estado inicial, loadMeetups, loadMeetups con filtro status, loadPending, initiateMeetup, initiateMeetup con coordenadas (verifica body), confirmMeetup, disputeMeetup, clearError

**Error Forzado** (6): loadMeetups ApiException/genérica, initiateMeetup MEETUP_EXISTS, confirmMeetup EXPIRED, disputeMeetup error, loadPending silencia errores

**Peor Caso** (7): meetups vacíos, sin campo meetups, Meetup.isPending, isConfirmed, isExpired (fecha pasada/sin fecha), campos mínimos snake_case, ambos confirmados

---

## F10 — Notificaciones

**Objetivo**: Centro de notificaciones — historial de alertas (match, mensaje, meetup, esencias, sistema) con mark-read individual y masivo.

### Archivos

| Archivo | Descripción |
|---------|-------------|
| `lib/features/notifications/notifications_provider.dart` | AppNotification model + NotificationsProvider |
| `lib/features/notifications/notifications_screen.dart` | Lista con indicador de no-leído, FAB "marcar todo", tap para marcar leído |

### AppNotification — Modelo

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | String | UUID |
| `type` | String | match / message / meetup / esencias / system / general |
| `title` | String | Título de la notificación |
| `body` | String? | Cuerpo del mensaje |
| `actionUrl` | String? | Ruta interna para navegar |
| `isRead` | bool | Estado de lectura |
| `createdAt` | DateTime | Timestamp |

**Helper**: `typeLabel` → "Match" / "Mensaje" / "Meetup" / "Esencias" / "Sistema" / "General"

### NotificationsProvider — Métodos

| Método | Descripción |
|--------|-------------|
| `loadNotifications({limit?, offset?})` | GET /notifications?limit=50&offset=0. Calcula unreadCount |
| `loadUnreadCount()` | GET /notifications/unread-count (silencia errores) |
| `markAsRead(notificationId)` | POST /notifications/:id/read. Actualiza lista local + unreadCount |
| `markAllAsRead()` | POST /notifications/read-all. Marca todo local |
| `clearError()` | Limpiar error |

### Tests (20 tests)

**`test/notifications_provider_test.dart`**

**Happy Path** (7): estado inicial, loadNotifications (2 notifs / 1 unread), loadNotifications con paginación, loadUnreadCount, markAsRead (actualiza lista local y unreadCount), markAllAsRead (todo a 0), clearError

**Error Forzado** (5): loadNotifications ApiException/genérica, markAsRead error, markAllAsRead error, loadUnreadCount silencia errores

**Peor Caso** (8): notificaciones vacías, sin campo notifications, markAsRead id inexistente no rompe, typeLabel para los 6 tipos, notificación campos mínimos, snake_case (action_url/is_read), todas leídas → unreadCount=0

---

## Router — Rutas Completas

| Ruta | Pantalla | Guard |
|------|----------|-------|
| `/splash` | SplashScreen | Solo `initial` |
| `/login` | LoginScreen | Solo `unauthenticated` |
| `/onboarding` | OnboardingScreen | Solo `onboarding` |
| `/feed` | FeedScreen | `authenticated` |
| `/chat` | ChatListScreen | `authenticated` |
| `/chat/:matchId` | ChatScreen | `authenticated` |
| `/explore` | EsenciasScreen | `authenticated` |
| `/profile` | ProfileScreen | `authenticated` |
| `/venues` | VenuesScreen | `authenticated` |
| `/body-doubling` | BodyDoublingScreen | `authenticated` |
| `/meetups` | MeetupsScreen | `authenticated` |
| `/notifications` | NotificationsScreen | `authenticated` |

---

## Resumen de Tests

| Test file | Tests | Etapa |
|-----------|-------|-------|
| `test/api_service_test.dart` | 9 | F1 |
| `test/theme_test.dart` | 8 | F1 |
| `test/widget_test.dart` | 1 | F1 |
| `test/auth_provider_test.dart` | 18 | F2 |
| `test/onboarding_provider_test.dart` | 26 | F2 (pre-existente) |
| `test/feed_provider_test.dart` | 33 | F3 |
| `test/chat_provider_test.dart` | 27 | F4 |
| `test/esencias_provider_test.dart` | 27 | F5 |
| `test/profile_provider_test.dart` | 21 | F6 |
| `test/venues_provider_test.dart` | 18 | F7 |
| `test/body_doubling_provider_test.dart` | 20 | F8 |
| `test/meetups_provider_test.dart` | 22 | F9 |
| `test/notifications_provider_test.dart` | 20 | F10 |
| **Total** | **250** | |

Todos los tests pasan con `flutter test`.

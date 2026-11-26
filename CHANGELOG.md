# CHANGELOG — IAM (Agent Reference)

> **Propósito**: Registro compacto de cambios técnicos para agentes. Formato: qué cambió, dónde, por qué y cómo verificarlo.

---

## [Baseline Post-Migración] — 2026-11-25 (`50b6768`)
Punto de partida al migrar el proyecto a Windows 11 (`C:\msmDev\IAM`):
- **Backend (`apps/backend`)**: NestJS + Supabase (PostgreSQL + PostGIS), 14 módulos + Etapa 8 (`ThrottlerModule`, `teen_mode_enabled`), 22 suites / 499 tests unitarios. Puerto dev: **`3001`** (puerto 3000 ocupado por IDE local).
- **Mobile (`apps/mobile`)**: Flutter (`3.47.9`) + Provider + GoRouter, F1–F13 implementados. Device de prueba: Samsung Galaxy S24 Ultra vía ADB Wi-Fi + `scrcpy`.
- **Override local**: `packages/phosphor_flutter` con `dependency_overrides` en `apps/mobile/pubspec.yaml` (`typedef PhosphorIconData = IconData;` y `sdk: ">=3.0.0 <4.0.0"`).

---

## [Unreleased] — 2026-11-25 / 2026-11-26

### 1. Identidad Visual, Marca SVG y Adaptive Icon
- **Pipeline vectorial reusable**: `tools/brand/vectorize_logo.py` (Python 3.12 venv en `tools/brand/.venv` con `vtracer`, `opencv-python`, `numpy`, `pillow`). Calca curvas reales de `logoOpcion2.jpg` sin reinterpretación geométrica y regenera todos los SVG/XML cambiando solo el dict `PALETTE`.
- **Assets SVG en 3 capas** (`apps/mobile/assets/images/`):
  - `iam_wordmark.svg`: tipografía `iam` en `#FFFFFF`, fondo transparente.
  - `iam_header_wordmark.svg`: `i` en `#F4B266` + `am` en `#76C7E8` para el `AppBar`.
  - `iam_crowd.svg`: silueta central `#F4B266` + multitud en 5 capas celestes (`#4A8FB3`, `#5CA3C7`, `#6BB6DB`, `#8AD1EE`, `#A2DFF5`), `preserveAspectRatio="xMidYMax slice"`.
- **Renderizador nativo**: `IamSvgPicture` + `IamHeroLogoBanner` en `apps/mobile/lib/core/widgets/iam_svg_picture.dart` (precargado en `main.dart` con `IamSvgPicture.preloadAll()`, corrigiendo traslación de `BoxFit.cover` + `Alignment.bottomCenter`).
- **Paleta única activa**: `BrandPalette.celesteSereno` en `apps/mobile/lib/core/design/design_tokens.dart` (`heroBackground = #76C7E8`, `blue400 = #76C7E8`, `lavender400 = #F4B266`). Todos los botones primarios usan `#76C7E8`.
- **Pantallas actualizadas**:
  - `SplashScreen` (`splash_screen.dart`) y `LoginScreen` (`login_screen.dart`): composición en 3 capas SVG sobre `#76C7E8`.
  - `HomeShell` (`home_shell.dart`): header centrado con `iam_header_wordmark.svg`.
  - `SettingsScreen` (`settings_screen.dart`): `IamHeroLogoBanner(height: 240)` en cabecera.
- **Android Launch & Adaptive Icon**:
  - `res/mipmap-anydpi-v26/ic_launcher.xml`, `res/drawable/ic_launcher_background.xml` (`#76C7E8`), `res/drawable/ic_launcher_foreground.xml` (safe zone 62%).
  - `res/drawable/launch_background.xml`, `res/drawable-v21/launch_background.xml`, `res/values-v31/styles.xml`, `res/values-night-v31/styles.xml`: fondo `#76C7E8` + `@drawable/ic_launcher_foreground` (elimina splash cuadrado antiguo).
  - `logo.png` y los 5 `mipmap-*/ic_launcher.png` regenerados en `#76C7E8` + `#F4B266`.

### 2. Entorno de Pruebas (Seed + Reset)
- `apps/backend/scripts/seed-test-users.js` (`npm run seed:test-users`): siembra idempotente de 60 usuarios `@iam.test` (30F/30M, 2–4 fotos c/u, diagnósticos, SpIns, ubicación cercana), 6 venues y 8 historias activas.
- `apps/backend/scripts/reset-test-interactions.js` (`npm run reset:test-interactions`): limpia interacciones (`swipes`, `matches`, `messages`, `meetup_confirmations`, `notifications`, `blocks`, `reports`) preservando los 60 perfiles (`-- --no-likes` omite likes entrantes).

### 3. Auth, Ubicación y Backend Core
- **Auto-refresh JWT**: `ApiService` (`api_service.dart`) + `AuthService` (`auth_service.dart`) refrescan sesión automáticamente en `401`.
- **Ubicación rápida**: `LocationService.syncLocation()` (`location_service.dart`) usa `getLastKnownPosition()` + `LocationAccuracy.medium` + timeout `8s` para evitar bloqueo infinito en Splash/Feed.
- **Esencias**: `EsenciasService.addEsencias` (`apps/backend/src/esencias/esencias.service.ts`) corregido a suma entera (antes concatenaba SQL string).
- **Preferencias de usuario**: `GET /users/me/preferences` y `PATCH /users/me/preferences` en `OnboardingController` / `OnboardingService` (switches de `SettingsScreen`).

### 4. Feed, Perfiles y Media
- **Filtros persistentes**: `FeedFilters` / `FeedProvider` (`feed_filters.dart`, `feed_provider.dart`) persisten en `SharedPreferences`; backend `MatchingController`/`MatchingService` aplica `diagnoses`, `minAge`, `maxAge`, `tags`, `minEnergy`, `genders`, `radius`, `sort` y devuelve `diagnoses`.
- **Componentes compartidos**: `ProfileSectionCard`, `ProfileDiagnosesSection` y `ProfileSpinSection` en `apps/mobile/lib/core/widgets/profile_section_widgets.dart`, usados por `ProfileScreen`, `PublicProfileScreen` y `ProfileCard`. En `ProfileCard`, los diagnósticos van debajo de la descripción (`msnStatus`) y la proximidad va en pill sobre el gradiente.
- **Proximidad en perfil público**: `ProfilesController` (`GET /profiles/:id`) pasa `viewerId`; `OnboardingService.getPublicProfile` parsea ubicaciones PostGIS **EWKB hex** (`parseEwkbHex`) y devuelve `distance_meters`, renderizado en `PublicProfileScreen`.
- **Galería de fotos**: `PhotosService.uploadGalleryPhoto` (`photos.service.ts`) corregido (`fileStorage.uploadFile`, `image/webp`); `Env.resolveMediaUrl` + visor full-screen swipeable en `PhotoGallery` y `ProfileScreen`.
- **Overflow comunidad**: `HomeShell._showMoreSheet` envuelto en `SafeArea` + `SingleChildScrollView` (`isScrollControlled: true`).

### 5. Historias 24h y Chat / Unmatch
- **DB**: migración `apps/backend/supabase/migrations/016_stories.sql` aplicada en Supabase (`stories` table).
- **Backend Stories**: `apps/backend/src/stories/{stories.module.ts,stories.controller.ts,stories.service.ts}` (`GET /stories`, `POST /stories`, `DELETE /stories/:id`). `getActiveStories` filtra solo historias propias + usuarios con match `active`.
- **UI Historias**: `ChatProvider`, `ChatModels`, `ChatListScreen`:
  - Barra superior de historias + botón `+` con compositor full-screen oscuro (`_StoryComposerScreen`, texto blanco sobre fondo negro traslúcido).
  - Anillo degradado en barra y en avatar de `_ConversationTile`; cambia a **gris** (`Colors.grey.shade400`) al ver todas las historias del usuario (persistido en `SharedPreferences`).
  - `_StoryViewerDialog` navega de usuario en usuario (tap o swipe horizontal).
- **Romper Match**: `DELETE /matches/:id` en `ChatController`/`ChatService` (archiva match `status = 'archived'`); menú `⋮` en `ChatScreen` (`Ver perfil`, `Deshacer match` con confirmación).


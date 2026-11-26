# ISSUES — IAM Tracker (Agent Reference)

> **Propósito**: Lista compacta de bugs abiertos, deuda técnica y bugs recientes ya cerrados para evitar re-investigación.

---

## Abiertos (Por Prioridad)

| ID | Prio | Área | Descripción | Archivos / Referencia | Criterio de cierre |
|----|------|------|-------------|-----------------------|--------------------|
| **ISS-01** | P1 | Mobile Tests | `F4 FeedScreen muestra mensaje vacío` en `screens_f1_f6_test.dart` hace timeout (10m), probablemente por `SharedPreferences` / animación de carga | `apps/mobile/test/screens_f1_f6_test.dart` | `flutter test test/screens_f1_f6_test.dart` pasa completo en <15s |
| **ISS-02** | P1 | Git / Repo | ~55 archivos modificados/nuevos sin commit en working tree (incluye `016_stories.sql`, SVG, `tools/brand/`) | Repo raíz | Commits atómicos limpios pusheados a `origin/main` |
| **ISS-03** | P2 | Backend Tests | `StoriesModule` (`stories.service.ts`) y `ChatService.unmatch` no tienen tests unitarios dedicados | `apps/backend/src/stories/`, `apps/backend/src/chat/chat.service.spec.ts` | Specs pasando (happy path, error forzado, peor caso) |
| **ISS-04** | P2 | Venues | Pestaña Venues no muestra venues útiles en pruebas o falta validar flujo de recompensas/QR | `apps/backend/src/venues/`, `apps/mobile/lib/features/venues/` | Venues visibles cerca del usuario de prueba + flujo canje validado |
| **ISS-05** | P2 | Salas / Body Doubling | Evolucionar `body_doubling` a **Salas de Contexto Vivo** (Presence/Broadcast + historias multimedia + Likes Privados) | `apps/backend/src/body-doubling/`, `apps/mobile/lib/features/body_doubling/` | Spec §3.2 en `docs/planning.md` implementada |
| **ISS-06** | P2 | Meetups | No está claro cómo se gatilla un meetup desde el flujo normal de match/chat | `apps/mobile/lib/features/meetups/`, `apps/mobile/lib/features/chat/` | Trigger claro en UI + flujo probado E2E |
| **ISS-07** | P3 | Mobile Lint | 8+ `info` preexistentes `unnecessary_underscores` (`__`, `___`) en `chat_list_screen.dart`, `profile_card.dart`, `public_profile_screen.dart` | `apps/mobile/lib/features/` | `flutter analyze` con 0 infos/warnings |
| **ISS-08** | P2 | Infra / Storage | Migrar storage de fotos/stories/salas a **Cloudflare R2** (Presigned URLs vía Workers) con Lifecycle Rule de borrado `24h` para stories | `apps/backend/src/photos/file-storage.service.ts`, `stories.service.ts` | Bucket R2 + Workers presigner + Lifecycle 24h activos |
| **ISS-09** | P2 | UI / Settings | En `Configuración`, `IamHeroLogoBanner` se ve como un cuadrado encerrado y corta la cabeza de la persona central; rediseñar más elegante (ej. header curvo/full-bleed sin recorte) | `apps/mobile/lib/core/widgets/iam_svg_picture.dart`, `apps/mobile/lib/features/settings/settings_screen.dart` | Logo completo visible sin recortar la cabeza e integrado con diseño elegante |

---

## Resueltos Recientemente (No Re-investigar)

| ID | Qué pasaba | Solución aplicada | Dónde |
|----|-----------|-------------------|-------|
| **RES-01** | Logo antiguo e IP/puerto viejos en APK | Dejar de usar `--use-application-binary`; compilar APK limpio con `.env.dev` | `apps/mobile/.env.dev` |
| **RES-02** | Splash cuadrado antiguo al abrir app | `values-v31/styles.xml`, `values-night-v31/styles.xml`, `launch_background.xml`, `mipmap-*/ic_launcher.png` | `apps/mobile/android/app/src/main/res/` |
| **RES-03** | Multitud SVG manchada o camuflada con `#6BB9E8` | Segmentación watershed + grafo de adyacencia por silueta en `vectorize_logo.py` | `tools/brand/vectorize_logo.py` |
| **RES-04** | Proximidad no aparecía en `PublicProfileScreen` | `ProfilesController` pasa `viewerId`; `parseEwkbHex` en `OnboardingService` | `apps/backend/src/onboarding/onboarding.service.ts` |
| **RES-05** | Historias visibles sin match + sin aro gris + sin pasar entre usuarios | Filtro por `matches.status='active'`; `SharedPreferences` en `ChatProvider`; `_StoryViewerDialog` multi-usuario | `stories.service.ts`, `chat_provider.dart`, `chat_list_screen.dart` |
| **RES-06** | Texto invisible (blanco sobre blanco) en compositor de historia | `filled: true` + `fillColor: Colors.black.withValues(alpha: 0.65)` en `_StoryComposerScreen` | `apps/mobile/lib/features/chat/chat_list_screen.dart` |
| **RES-07** | Pantalla congelada en "Obteniendo tu ubicación" | `getLastKnownPosition()` + `LocationAccuracy.medium` + timeout `8s` | `apps/mobile/lib/core/services/location_service.dart` |
| **RES-08** | `401` al abrir perfil/chat por token expirado | Auto-refresh JWT en `ApiService` + `AuthService` | `apps/mobile/lib/core/services/api_service.dart` |


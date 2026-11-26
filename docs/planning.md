# PLANNING — IAM Roadmap & Definiciones Técnicas (Agent Reference)

> **Propósito**: Estado actual del producto, definiciones de arquitectura pendientes y backlog priorizado. Leer antes de proponer features nuevas.

---

## 1. Arquitectura Actual (Resumen Operativo)
- **Monorepo**: `apps/backend` (NestJS + Supabase/PostGIS, puerto dev `3001`) + `apps/mobile` (Flutter + Provider + GoRouter) + `packages/shared` + `packages/phosphor_flutter` (override local).
- **Marca**: 1 tema único (`BrandPalette.celesteSereno` en `design_tokens.dart`) + 3 capas SVG regenerables con `tools/brand/vectorize_logo.py`.
- **Testing**:
  - Backend: Jest (`apps/backend/src/**/*.spec.ts`).
  - Mobile: `flutter test` (nota: `AppTheme.disableGoogleFonts = true` en tests).
  - Manual en device: `seed:test-users` + `reset:test-interactions`.

---

## 2. Definiciones Pendientes de Producto (Por Aterrizar)

| Área | Estado actual | Qué falta definir / construir | Archivos clave |
|------|---------------|-------------------------------|----------------|
| **Venues** | Backend y UI base existen, pero sin datos de prueba visibles en flujo real | Sembrar venues reales/prueba cerca del usuario, validar filtros/mapa/QR de canje | `apps/backend/src/venues/`, `apps/mobile/lib/features/venues/`, `docs/venues-rewards.md` |
| **Body Doubling / Salas de Contexto Vivo** | Módulo `body_doubling` base implementado; evoluciona a **Salas de Contexto Vivo ("Co-experiencia")** | Ver especificación §3.2 (Salas temáticas + historias multimedia + Presence/Broadcast + Likes Privados) | `apps/backend/src/body-doubling/`, `apps/mobile/lib/features/body_doubling/` |
| **Meetups** | Lógica de confirmación existe, gatillo en flujo de chat/match poco claro | Definir cómo y cuándo se gatilla (botón en chat vs sugerencia automática tras N mensajes) | `apps/backend/src/meetups/`, `apps/mobile/lib/features/meetups/` |
| **Stories 24h + Modo Sombra** | Historias 24h (solo foto, solo matches) funcionales en dev (`016_stories.sql`) | Tests unitarios (`stories.service.spec.ts`), soporte multimedia + Modo Sombra (§3.1) + Cloudflare R2 lifecycle 24h | `apps/backend/src/stories/`, `apps/mobile/lib/features/chat/` |
| **Etiquetas de Intención + Likes Privados** | Diagnósticos y SpIn en perfil; falta etiqueta explícita de intención y Like Privado | Añadir `intent_tag` (`Buscando pareja`, `Amistad`, `Solo conversar`) + Like Privado (§3.3) | `apps/backend/src/onboarding/`, `apps/mobile/lib/features/profile/` |
| **Rachas de Chat + Token Potenciador** | Solo existe racha personal de login (`UsersService`) y economía base de tokens (`Esencias`, nombre tentativo por definir) | Implementar Match Streaks (`streak_days`, `last_streak_date`, ventana de gracia 48h, mensajes diarios mutuos), Escudo de Energía (congelar 48h extra) e Impulso `+2` / hitos (`7/30/100d`) usando el token; UI en `ChatListScreen` + `ChatScreen` | `apps/backend/src/chat/`, `apps/backend/src/esencias/`, `apps/mobile/lib/features/chat/` |

---

## 3. Especificaciones de Features Nuevas (MVP & Post-MVP)

### 3.1 Historias en Modo Sombra (Desahogo Anónimo con Revelación Selectiva) — **Prioridad Alta (MVP)**
- **Formato**: historia efímera `24h` multimedia sin restricción de formato (`foto WebP`, `video corto`, `audio comprimido`, `texto sobre fondo`).
- **Autor (Emisor)**: activa `is_shadow = true` y escribe `custom_alias` propio (sin alias autogenerados). Recibe reacciones/respuestas privadas en bandeja ligada a esa historia (viendo perfil real del respondedor). Botón **"Revelar Identidad"** descubre su perfil real y abre chat 1:1.
- **Comunidad (Receptores)**: ven solo `custom_alias` (sin avatar/perfil). Responden en privado sin ver respuestas ni contadores de terceros.
- **Infra**: media en **Cloudflare R2** (egress `$0` + Lifecycle Rule borrado `24h`). En PostgreSQL/Supabase: `is_shadow`, `custom_alias` + **RLS** que oculta `user_id` en consultas del feed público.

### 3.2 Salas de Contexto Vivo ("Co-experiencia" con Historias Multimedia) — **Prioridad Alta (MVP)**
- **Concepto**: salas temáticas en tiempo real (*ej. viendo anime/serie, escuchando música, evento en vivo, gaming*) **sin live streaming**, con chat/comentarios en vivo + historias libres (`video corto`, `audio`, `foto`, `texto`).
- **UI & Conexión**: avatares conectados con aro activo si subieron historia en la sala + muro/chat en tiempo real. Tocar cualquier avatar abre perfil rápido (Batería Social, intención, afinidad neurodivergente) con botón **Like Privado** (contador discreto, identidad revelada solo al dueño).
- **Infra**: presencia y chat en **Supabase Realtime (`Presence + Broadcast`)** para evitar escrituras masivas en DB; media de historias de sala subida directo cliente → **Cloudflare R2** vía **Presigned URLs** (Cloudflare Workers).

### 3.3 Etiquetas de Intención + Filtro de Neurodivergencia — **Prioridad Media (Perfil)**
- Campo explícito en perfil: `"Buscando pareja"`, `"Amistad"`, `"Solo conversar"` junto a neurodivergencia e intereses (SpIn). Sirve de contexto directo al conectar desde Salas o Historias Sombra, complementando los **Likes Privados**.

### 3.4 Rachas de Chat (Match Streaks) + Token Potenciador — *Borrador v1*
> **Nota para agentes**: El nombre del token (`Esencia`) es **provisional** y puede cambiar; usar constantes/labels centralizados. Diseño sujeto a refinamiento antes de implementar.

- **Regla base (gratis)**: si ambos participantes envían ≥1 mensaje en el día, `streak_days += 1`.
- **Margen de gracia neurodivergente**: **48h** sin romper racha ante días de baja energía social.
- **Potenciadores con Token (nombre provisional: Esencia)**:
  - **Impulso (`+2`)**: enviar un token dentro del chat suma `+2` días ese día y otorga recompensas en hitos (`7`, `30`, `100` días).
  - **Escudo de Energía**: gastar 1 token congela/protege la racha **48h adicionales** sin penalización.
- **UI**: badge compacto (`✨ N`) en `ChatListScreen` + pill en header de `ChatScreen` con acceso rápido a enviar token / activar escudo. Notificaciones respetan **El Dial**.

### 3.5 Fase 2 / Backlog (Pausado — Post-MVP)
- **Pregunta Diaria + Bitácora Archivada**: worker cron diario lanza 1 pregunta al feed y archiva respuestas en el perfil como historial de personalidad.

---

## 4. Roadmap Inmediato (Orden Sugerido)
1. **Estabilización & Git Sync**:
   - Arreglar `test/screens_f1_f6_test.dart` (timeout en `F4 FeedScreen` tras cambios de `SharedPreferences`/filtros).
   - Añadir `stories.service.spec.ts` y tests de `unmatch` en `chat.service.spec.ts`.
   - Commit ordenado en `origin/main` de todo el trabajo actual.
2. **Definición funcional (Venues / Body Doubling / Meetups)**:
   - Cerrar reglas de negocio de los 3 módulos con el product owner antes de tocar UI.
3. **Tests de Integración E2E (Supabase real)**:
   - Cubrir auth, swipe→match→chat→unmatch, stories y ubicación PostGIS sin mocks.
4. **Build de Release / Staging**:
   - Validar APK release (`flutter build apk --release`), íconos y FCM en producción.


# Development Stages — IAM

Cada etapa debe pasar su batería de tests completa antes de avanzar.
Tests incluyen: happy path + errores forzados + peor caso.

---

## Etapa 1 — Fundación del Proyecto
**Objetivo**: Monorepo funcionando, CI básico, conexión a Supabase verificada.

### Entregables
- Scaffold de NestJS con health check endpoint
- Scaffold de Flutter con pantalla placeholder
- Variables de entorno configuradas
- Conexión a Supabase verificada
- Migraciones iniciales de DB ejecutadas

### Tests
| Test | Tipo | Criterio |
|------|------|---------|
| GET /health retorna 200 | Happy path | Status 200, body `{ status: "ok" }` |
| GET /health con DB caída | Error forzado | Retorna 503 con mensaje claro |
| 1000 requests simultáneos a /health | Peor caso | Sin crashes, tiempo de respuesta < 500ms |
| Flutter app compila sin errores | Happy path | `flutter build apk` exitoso |
| Variables de entorno faltantes | Error forzado | App no inicia, error descriptivo en logs |

---

## Etapa 2 — Autenticación
**Objetivo**: Google Auth + Apple Sign In funcionando. Usuario creado en DB al primer login.

### Entregables
- Endpoint POST /auth/google
- Endpoint POST /auth/apple
- Creación automática de usuario en tabla `users`
- JWT de sesión emitido y validado
- Flutter: pantalla de login con ambos botones

### Tests
| Test | Tipo | Criterio |
|------|------|---------|
| Login con token Google válido | Happy path | JWT retornado, usuario en DB |
| Login con token Apple válido | Happy path | JWT retornado, usuario en DB |
| Login con token inválido/expirado | Error forzado | 401 con mensaje claro |
| Login doble (mismo usuario) | Error forzado | No duplica usuario, retorna JWT nuevo |
| Token JWT manipulado en request | Error forzado | 401, sin acceso a recursos |
| 500 logins simultáneos | Peor caso | Sin duplicados en DB, todos responden |
| Token Google de otro proyecto | Error forzado | 401, rechazado |

---

## Etapa 3 — Onboarding (Perfil + Diagnóstico + SpIn)
**Objetivo**: El usuario completa su "Espejo de Identidad": diagnósticos, SpIn, preferencias.

### Entregables
- Endpoint PATCH /users/me/profile
- Endpoint POST /users/me/diagnoses
- Endpoint POST /users/me/spin
- Endpoint GET /spin/tags?search=query&category=id (autocomplete)
- Flutter: pantalla "I AM" con selector de diagnósticos y temas
- Flutter: selector de SpIn con búsqueda y límites

### Tests
| Test | Tipo | Criterio |
|------|------|---------|
| Guardar perfil completo | Happy path | 200, datos persistidos |
| Seleccionar TEA → tema zen aplicado | Happy path | Response incluye theme config |
| Seleccionar TEA + AACC → tema fusionado | Happy path | Fusión de temas correcta |
| Agregar 20 SpIn (límite máximo) | Happy path | Todos guardados |
| Agregar SpIn #21 | Error forzado | 400 "Límite de SpIn alcanzado" |
| Agregar 6 SpIn en misma categoría | Error forzado | 400 "Límite por categoría alcanzado" |
| SpIn custom "Rick y morty" + "Rick and Morty" | Error forzado | Normalización detecta duplicado |
| Perfil sin diagnóstico | Error forzado | 400, campo requerido |
| Opción "me identifico sin diagnóstico formal" | Happy path | Guardado como AUTOIDENTIFIED |
| Búsqueda de SpIn con 1000 tags en DB | Peor caso | Respuesta < 200ms |
| Inyección SQL en campo SpIn custom | Peor caso | Sanitizado, 400 o guardado seguro |

---

## Etapa 4 — Matching y Feed
**Objetivo**: Los usuarios se pueden ver entre sí según proximidad + SpIn. Swipe funcional.

### Entregables
- Endpoint GET /feed (perfiles cercanos paginados)
- Endpoint POST /swipe { target_user_id, direction: "like"|"pass" }
- Lógica de match mutuo (notificación cuando hay match)
- Flutter: pantalla de feed con cards y swipe
- Flutter: halo de energía según diagnóstico

### Tests
| Test | Tipo | Criterio |
|------|------|---------|
| Feed retorna usuarios en radio | Happy path | Solo usuarios dentro del radio |
| Feed sin usuarios cercanos | Happy path | Array vacío, sin error |
| Swipe like mutuo → match creado | Happy path | Match en DB, notificación enviada |
| Swipe like + pass → no match | Happy path | No se crea match |
| Swipe mismo usuario dos veces | Error forzado | 400 o idempotente |
| Swipe a usuario bloqueado | Error forzado | 403 |
| Usuario 16-17 en feed de adulto | Error forzado | NUNCA aparece |
| Adulto en feed de usuario 16-17 | Error forzado | NUNCA aparece |
| Feed con 10.000 usuarios en radio | Peor caso | Paginación correcta, < 500ms |
| Usuario sin ubicación configurada | Error forzado | 400 con instrucción de activar ubicación |

---

## Etapa 5 — Chat
**Objetivo**: Mensajería en tiempo real entre usuarios con match.

### Entregables
- WebSocket gateway (NestJS)
- Endpoint GET /matches/:id/messages (historial)
- Endpoint POST /matches/:id/messages
- Realtime via Supabase subscriptions
- Flutter: pantalla de chat

### Tests
| Test | Tipo | Criterio |
|------|------|---------|
| Enviar y recibir mensaje | Happy path | Entrega < 500ms en condiciones normales |
| Historial de mensajes paginado | Happy path | Mensajes en orden cronológico |
| Mensaje entre usuarios sin match | Error forzado | 403 |
| Mensaje de 10.001 caracteres | Error forzado | 400 con límite indicado |
| Usuario offline recibe mensaje al volver | Peor caso | Mensaje persistido y entregado |
| 100 mensajes simultáneos en mismo chat | Peor caso | Sin pérdida, orden correcto |
| Inyección XSS en mensaje | Peor caso | Sanitizado antes de persistir |
| Reconexión WebSocket por red inestable | Peor caso | Reconexión automática, sin duplicados |

---

## Etapa 6 — Sistema de Esencias (Tokens)
**Objetivo**: Los usuarios pueden enviar y recibir Esencias. El inventario se gestiona correctamente.

### Entregables
- Endpoint POST /esencias/send
- Endpoint GET /users/me/inventory
- Endpoint GET /users/:id/displayed-esencias (las exhibidas en perfil)
- Lógica de otorgamiento por rachas y logros
- Flutter: pantalla de inventario y exhibición en perfil

### Tests
| Test | Tipo | Criterio |
|------|------|---------|
| Enviar Esencia válida | Happy path | Transferencia en DB, notificación |
| Exhibir Esencia en perfil | Happy path | Visible para otros usuarios |
| Enviarse Esencia a sí mismo | Error forzado | 400 |
| Enviar Esencia que no se tiene | Error forzado | 400 "Inventario insuficiente" |
| Racha de 100 días → token Hito | Happy path | Token acreditado automáticamente |
| Racha rota → no acredita token | Happy path | Sin token, racha reinicia a 0 |
| Manipular fecha de login para forzar racha | Peor caso | Servidor valida, no cliente |
| 1000 envíos de Esencias simultáneos | Peor caso | Sin race conditions en inventario |

---

## Etapa 7 — Venues y Recompensas Físicas
**Objetivo**: Los usuarios descubren lugares Neuro-Safe y canjean recompensas desbloqueadas.

### Entregables
- Endpoint GET /venues?lat=&lng=&radius= (venues cercanos)
- Endpoint GET /users/me/rewards (recompensas desbloqueadas)
- Endpoint POST /rewards/:id/redeem (genera QR + código alfanumérico)
- App de venue: endpoint POST /venue/scan { code }
- Flutter: mapa de venues y pantalla de recompensas
- Flutter (venue app): escáner de QR

### Tests
| Test | Tipo | Criterio |
|------|------|---------|
| Listar venues en radio | Happy path | Solo venues activos y cercanos |
| Canjear recompensa desbloqueada | Happy path | QR + código generado, único |
| Venue escanea QR válido | Happy path | Canje confirmado, QR invalidado |
| Canjear recompensa no desbloqueada | Error forzado | 403 "Requisito no cumplido" |
| Canjear QR ya usado | Error forzado | 400 "Código ya canjeado" |
| QR expirado | Error forzado | 400 "Código expirado" |
| Venue inactivo intenta escanear | Error forzado | 403 |
| 500 canjes simultáneos del mismo código | Peor caso | Solo 1 exitoso, resto rechazados |
| Código alfanumérico manipulado | Peor caso | No canjeable, 400 |

---

## Etapa 8 — Moderación y Seguridad
**Objetivo**: Sistema de reportes, bloqueos y protección de usuarios vulnerables.

### Entregables
- Endpoint POST /users/:id/report
- Endpoint POST /users/:id/block
- Lógica de feature flag `teen_mode_enabled`
- Panel básico de administración (web simple)
- Rate limiting en todos los endpoints

### Tests
| Test | Tipo | Criterio |
|------|------|---------|
| Reportar usuario | Happy path | Reporte en DB, usuario reportado no afectado hasta revisión |
| Bloquear usuario | Happy path | No aparece en feed ni puede escribir |
| Usuario bloqueado intenta escribir | Error forzado | 403 |
| Teen mode desactivado via feature flag | Happy path | Usuarios 16-17 no pueden registrarse |
| 200 requests/segundo al mismo endpoint | Peor caso | Rate limit activo, 429 retornado |
| Registrar usuario menor de 16 | Error forzado | 400 "Edad mínima no cumplida" |

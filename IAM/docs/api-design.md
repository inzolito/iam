# API Design — IAM

Base URL: `https://api.iam.app/v1`

Autenticación: Bearer token (JWT) en header `Authorization`.

---

## Convenciones

- Respuestas siempre en JSON
- Errores: `{ "code": "ERROR_CODE", "message": "descripción" }`
- Fechas: ISO 8601 UTC
- IDs: UUID v4
- Paginación: `?page=1&limit=20`

---

## Auth

### POST /auth/google
```json
Request:  { "idToken": "string" }
Response: { "accessToken": "jwt", "refreshToken": "jwt", "user": { ...UserProfile } }
Errors:   AUTH_INVALID_TOKEN, AUTH_TOKEN_EXPIRED
```

### POST /auth/apple
```json
Request:  { "idToken": "string", "authorizationCode": "string" }
Response: { "accessToken": "jwt", "refreshToken": "jwt", "user": { ...UserProfile } }
```

### POST /auth/refresh
```json
Request:  { "refreshToken": "string" }
Response: { "accessToken": "jwt" }
Errors:   AUTH_REFRESH_EXPIRED
```

---

## Users

### GET /users/me
Retorna el perfil completo del usuario autenticado.

### PATCH /users/me/profile
```json
Request: {
  "username": "string",
  "displayName": "string",
  "birthDate": "YYYY-MM-DD",
  "msnStatus": "string (max 160)",
  "notifLevel": 1|2|3,
  "notifTime": "HH:MM"
}
```

### POST /users/me/diagnoses
```json
Request:  { "diagnoses": ["TEA", "AACC"], "primary": "TEA" }
Response: { "theme": { ...ThemeConfig } }
```

### PATCH /users/me/location
```json
Request:  { "lat": -33.4489, "lng": -70.6693 }
Response: { "updated": true }
```

### PATCH /users/me/energy
```json
Request:  { "level": 1|2|3 }
Response: { "updated": true }
```

---

## SpIn

### GET /spin/categories
Retorna categorías con sus tags curados.

### GET /spin/tags?search=query&category=uuid&limit=10
Autocomplete de tags. Retorna tags curados primero, luego custom con usage_count >= 3.

### POST /users/me/spin
```json
Request:  { "tagIds": ["uuid1", "uuid2"] }
Response: { "spin": [...UserSpIn] }
Errors:   SPIN_LIMIT_EXCEEDED, SPIN_CATEGORY_LIMIT_EXCEEDED
```

### DELETE /users/me/spin/:tagId

---

## Feed y Matching

### GET /feed?radius=15000
```json
Response: {
  "profiles": [{
    "id": "uuid",
    "displayName": "string",
    "avatarUrl": "string",
    "diagnoses": ["TEA"],
    "spin": [...SpInTags],
    "msnStatus": "string",
    "distanceKm": 3,
    "haloColor": "#7EB8D4",
    "spinScore": 66.7
  }],
  "pagination": { "page": 1, "hasMore": true }
}
```

### POST /swipe
```json
Request:  { "targetUserId": "uuid", "direction": "like"|"pass" }
Response: { "matched": true|false, "matchId": "uuid|null" }
```

---

## Matches y Chat

### GET /matches
Lista de matches activos con último mensaje.

### GET /matches/:id/messages?page=1
Historial de mensajes paginado (más recientes primero).

### POST /matches/:id/messages
```json
Request:  { "content": "string (max 10000)" }
Response: { "message": { ...Message } }
Errors:   CHAT_NOT_AUTHORIZED, CHAT_MESSAGE_TOO_LONG
```

### POST /matches/:id/irl-confirm
Confirmar que hubo encuentro real.
```json
Request:  { "venueId": "uuid|null" }
Response: { "bothConfirmed": true|false }
```

---

## Esencias

### GET /users/me/inventory
Inventario de Esencias del usuario.

### POST /esencias/send
```json
Request:  { "receiverId": "uuid", "esenciaTypeId": "uuid" }
Response: { "transaction": { ...Transaction } }
Errors:   ESENCIA_SELF_SEND, ESENCIA_INSUFFICIENT_INVENTORY
```

### GET /users/:id/displayed-esencias
Esencias exhibidas en el perfil público de un usuario.

### PUT /users/me/displayed-esencias
```json
Request:  { "slots": [{ "slot": 1, "esenciaTypeId": "uuid" }, ...] }
```

---

## Venues

### GET /venues?lat=&lng=&radius=5000
```json
Response: {
  "venues": [{
    "id": "uuid",
    "name": "string",
    "address": "string",
    "sensoryLevel": 1,
    "category": "cafe",
    "distanceKm": 1.2,
    "rewards": [{ "id": "uuid", "title": "string", "locked": false }]
  }]
}
```

### GET /users/me/rewards
Recompensas desbloqueadas y pendientes de canje.

### POST /rewards/:id/redeem
```json
Response: {
  "code": "X7KP2NMQ",
  "qrData": "string",
  "expiresAt": "ISO8601",
  "reward": { ...Reward }
}
Errors: REWARD_NOT_UNLOCKED, REWARD_ALREADY_REDEEMED
```

---

## Venue App (endpoints exclusivos)

### POST /venue/auth/login
```json
Request:  { "email": "string", "password": "string" }
Response: { "accessToken": "jwt", "venue": { ...VenueProfile } }
```

### POST /venue/scan
```json
Request:  { "code": "string" }
Response: {
  "valid": true,
  "reward": { "title": "Café gratis", "description": "..." }
}
Errors: SCAN_INVALID_CODE, SCAN_ALREADY_REDEEMED, SCAN_EXPIRED, SCAN_WRONG_VENUE
```

### GET /venue/stats
```json
Response: {
  "today": { "scans": 12 },
  "month": { "scans": 87 }
}
```

---

## Moderación

### POST /users/:id/report
```json
Request:  { "reason": "string", "details": "string|null" }
Response: { "reported": true }
```

### POST /users/:id/block
```json
Response: { "blocked": true }
```

### DELETE /users/:id/block

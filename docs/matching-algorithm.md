# Matching Algorithm — IAM

---

## Inputs del Algoritmo

1. **Ubicación del usuario** (lat/lng) — requerida
2. **Radio de búsqueda** — configurable por usuario (default: 15km, min: 5km, max: 50km)
3. **SpIn del usuario** — lista de tags de intereses
4. **Diagnósticos del usuario** — para filtros de afinidad opcionales
5. **Edad del usuario** — para aislamiento teen/adulto

---

## Paso 1: Filtros Duros (eliminatorios)

Estos filtros se aplican antes del scoring. Un usuario excluido no llega al paso 2.

```sql
WHERE
  -- Dentro del radio geográfico
  ST_DWithin(target.location, user.location, :radius_meters)

  -- No ha sido visto antes (no swipe previo)
  AND target.id NOT IN (SELECT swiped_id FROM swipes WHERE swiper_id = :user_id)

  -- No bloqueado ni ha bloqueado
  AND target.id NOT IN (
    SELECT blocked_id FROM blocks WHERE blocker_id = :user_id
    UNION
    SELECT blocker_id FROM blocks WHERE blocked_id = :user_id
  )

  -- Aislamiento de edad (CRÍTICO)
  AND (
    (user.is_teen = true AND target.is_teen = true)   -- teen ve solo teens
    OR
    (user.is_teen = false AND target.is_teen = false)  -- adulto ve solo adultos
  )

  -- Teen mode habilitado (feature flag)
  -- Si teen_mode_enabled = false, ningún is_teen = true pasa
  AND (
    target.is_teen = false
    OR EXISTS (SELECT 1 FROM feature_flags WHERE key = 'teen_mode_enabled' AND enabled = true)
  )

  -- Usuario activo
  AND target.is_active = true
```

---

## Paso 2: Score de Compatibilidad SpIn

Para cada candidato que pasó el Paso 1, se calcula un score de 0 a 100.

```
SpIn score = (SpIn en común / SpIn totales únicos combinados) * 100

Ejemplo:
  Usuario A: [programación, filosofía, Rick and Morty, música jazz]
  Usuario B: [programación, filosofía, senderismo, música clásica]

  En común: programación, filosofía → 2
  Totales únicos: 6
  Score: (2/6) * 100 = 33.3
```

El SpIn score se combina con la distancia:

```
final_score = (spin_score * 0.7) + (proximity_score * 0.3)

proximity_score = (1 - distancia_actual / radio_maximo) * 100
```

Más cerca + más SpIn en común = aparece primero en el feed.

---

## Paso 3: Ordenamiento y Paginación

```
ORDER BY final_score DESC, created_at DESC
LIMIT 20  (una "página" del feed = 20 cards)
```

---

## Mecánica de Swipe

- **Like**: Se guarda en `swipes` con `direction = 'like'`
- **Pass**: Se guarda en `swipes` con `direction = 'pass'`
- **Match mutuo**: Si A dio like a B, y B da like a A → se crea registro en `matches`

```
Al recibir swipe like de User B:
  1. Guardar en swipes
  2. Buscar si existe swipe WHERE swiper_id = B AND swiped_id = A AND direction = 'like'
  3. Si existe → INSERT INTO matches + notificar a ambos via FCM
```

### Sin Deshacer Swipe
El pass es definitivo en el MVP. No hay "undo" (reduce complejidad y abuso).

---

## Recarga del Feed

Cuando el usuario agota los 20 perfiles disponibles:
- Se le muestra un mensaje de "Por ahora no hay más perfiles cerca"
- No se repiten perfiles ya vistos en la misma sesión
- Al día siguiente los perfiles "pass" del día anterior vuelven a estar disponibles (sin penalización de interés)
- Los "pass" de más de 7 días siempre están disponibles de nuevo

---

## Consideraciones de Privacidad

- La ubicación exacta NUNCA se comparte con otros usuarios
- El feed muestra solo la distancia aproximada (ej: "a ~3km") redondeada al km más cercano
- La ubicación se actualiza cuando el usuario abre la app (no en background)
- Los usuarios pueden desactivar su ubicación → salen del feed pero pueden seguir usando la app

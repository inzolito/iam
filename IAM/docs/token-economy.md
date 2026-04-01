# Sistema de Esencias — Token Economy

Las Esencias son "tokens de intención": regalos digitales limitados que eliminan la ambigüedad del interés social.

---

## Por Qué Funciona para Neurodivergentes

En interacción neurotípica, un "like" puede ser accidental o por aburrimiento. Una Esencia tiene un costo (escasez) que la convierte en señal clara de interés real. Elimina la duda que genera ansiedad en usuarios neurodivergentes.

---

## Categorías y Rareza

| Categoría | Rareza | Cómo se obtiene | Visual en perfil |
|-----------|--------|-----------------|-----------------|
| Social | Común | Actividad diaria regular | Puntos de luz sutiles |
| Hito | Raro | Racha de 100 días de ingreso | Glifos geométricos parpadeantes |
| Temporal | Épico | Aniversarios o cumpleaños | Anillo/halo plateado o dorado |
| Legado | Legendario | 1 año como usuario activo | Efecto de partículas constante |
| Exclusivo | Premium | Compra in-app (futuro MVP) | Texturas metálicas/neón |

---

## Mecánicas

### Escasez
- Las Esencias Comunes se generan en cantidad limitada por semana (ej: 5/semana)
- Las de mayor rareza son únicas o de stock muy bajo
- Enviar una Esencia reduce tu inventario → el receptor sabe que fue una decisión

### Muro de Exhibición
- El receptor puede "exhibir" hasta 5 Esencias recibidas en su perfil
- Las Esencias exhibidas son visibles para cualquiera que vea el perfil
- El emisor NO se revela públicamente (solo el receptor sabe quién la envió)
- Genera prueba social y validación sin presión de reciprocidad pública

### Anonimato del Emisor
- Las Esencias exhibidas en perfil son anónimas para visitantes
- El receptor siempre sabe quién se la envió (en su bandeja de entrada)
- Crea misterio sano y evita presión social sobre el emisor

---

## Reglas de Negocio

```
1. No se puede enviar Esencia a uno mismo
2. No se puede enviar una Esencia que no tienes en inventario
3. El límite de exhibición en perfil es 5 slots
4. Las Esencias de racha se otorgan automáticamente al alcanzar el hito
5. La racha se calcula server-side (nunca client-side) para evitar manipulación
6. Una racha se mantiene si el usuario inicia sesión al menos una vez por día
7. La racha se rompe si pasan más de 48 horas sin login (margen de gracia: 1 día)
```

---

## Unlock Rules (formato JSON en DB)

```json
// Esencia "Hito — Racha 100"
{ "type": "streak", "value": 100 }

// Esencia "Legado — 1 año"
{ "type": "account_age_days", "value": 365 }

// Esencia "Temporal — Cumpleaños"
{ "type": "birthday_match", "value": true }

// Esencia "Social — Actividad"
{ "type": "daily_grant", "amount": 1, "max_per_week": 5 }
```

---

## Monetización Futura (no en MVP)

Las Esencias "Exclusivo Premium" serán comprables via in-app purchase.
- No dan ventaja en matching (no pay-to-win)
- Son puramente cosméticas y de status
- Apple/Google toman 30% → precio debe considerarlo
- Rangos estimados: $0.99 - $4.99 por pack

---

## Consideraciones de Bienestar

Las mecánicas de gamificación en apps para neurodivergentes pueden generar ansiedad si no se diseñan con cuidado:

- **Las rachas NO son obligatorias**: perderla no implica penalización, solo dejar de acumular
- **Sin notificaciones agresivas por racha**: no se envían alertas de "¡vas a perder tu racha!"
- **El margen de 48 horas** existe específicamente para períodos de baja energía (común en TEA/TDAH)
- **El inventario nunca se vence**: las Esencias no tienen fecha de expiración en el inventario

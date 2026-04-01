# UX Themes — IAM

La interfaz muta según el/los diagnósticos del usuario. Este documento define los tokens de diseño por tema y la lógica de fusión.

---

## Temas Base

### TEA — "Zen"
Objetivo: eliminar el ruido visual, predecibilidad máxima.

```
Background:    #EEF4FB (azul pastel muy suave) o #F0ECF8 (lavanda)
Surface:       #FFFFFF
Primary:       #7EB8D4
Text:          #2C3E50
Navigation:    Rígida, sin animaciones de transición complejas
Spacing:       Generoso, nunca comprimido
Borders:       Suaves, redondeados (radius: 12px)
Animations:    Mínimas, solo fade simple
Particles:     NINGUNA
```

### TDAH — "Dashboard"
Objetivo: toda la información importante visible de inmediato, energía controlada.

```
Background:    #0F0F1A (oscuro) con partículas sutiles flotantes (opacidad 0.15)
Surface:       #1A1A2E
Primary:       #7C6AF7
Accent:        #F7A16A
Text:          #E8E8F0
Navigation:    Tab bar prominente, accesos directos visibles
Spacing:       Más compacto, información densa pero organizada
Borders:       Más definidos (radius: 8px)
Animations:    Permitidas y esperadas, dan feedback satisfactorio
Particles:     Sí — puntos flotantes muy lentos, opacidad < 0.15
```

### AACC — "Profundidad"
Objetivo: capas de información, referencias intelectuales sutiles.

```
Background:    #F8F6F0 (blanco cálido)
Surface:       #FFFFFF
Primary:       #4A7C59
Accent:        #C9A84C
Text:          #1A1A2A
Navigation:    Estándar
Spacing:       Normal
Borders:       Limpios (radius: 8px)
Animations:    Normales
Overlay:       Patrones geométricos/fractales en baja opacidad (0.08-0.12)
               Rotativos sutilmente — diagramas, fibonacci, geometría sagrada
```

### Dislexia — "Claridad"
```
Background:    #FFF8E7 (amarillo muy suave, reduce contraste duro)
Surface:       #FFFDF5
Primary:       #2E7D6E
Text:          #2C2C2C
Font:          OpenDyslexic o similar, tamaño mínimo 16px
Line height:   1.8 (mayor que normal)
Letter spacing: +0.05em
Navigation:    Iconos prominentes con labels siempre visibles
Animations:    Mínimas
```

---

## Lógica de Fusión de Temas

Cuando un usuario tiene múltiples diagnósticos, los temas se fusionan.

### Reglas de Fusión

1. **Background**: Se toma el más calmante (TEA > Dislexia > AACC > TDAH)
2. **Partículas**: Solo si TDAH está en el perfil Y el usuario tiene más de un diagnóstico
   - Si hay TEA + TDAH: partículas presentes PERO velocidad reducida al 40%
3. **Overlay geométrico**: Solo si AACC está en el perfil
   - Si hay TEA + AACC: overlay al 6% de opacidad (mitad del normal)
4. **Typography**: Si hay Dislexia, siempre aplica fuente y espaciado de Dislexia
5. **Primary color**: Blend 50/50 del primario de cada tema

### Ejemplos

**TEA + TDAH**
```
Background:  Celeste pastel de TEA (calmante prevalece)
Particles:   Presentes al 40% de velocidad normal
Primary:     Mix #7EB8D4 + #7C6AF7 = #7C94E0
Navigation:  Rígida de TEA (predecibilidad prevalece)
```

**TEA + AACC**
```
Background:  Celeste pastel de TEA
Overlay:     Fractales geométricos al 6% opacidad
Primary:     Mix #7EB8D4 + #4A7C59 = #65997A
Particles:   NINGUNA
```

**TEA + TDAH + AACC (triple)**
```
Background:  Celeste pastel de TEA
Particles:   Al 25% velocidad
Overlay:     Fractales al 5% opacidad
Primary:     Blend de los tres
Navigation:  Rígida
```

---

## Check-in Diario de Energía

Al iniciar sesión, si el usuario no ha hecho check-in hoy:

```
"¿Cómo estás hoy?"
  🔴 Batería baja        → energy_level = 1
     UI más simplificada, notificaciones en modo Santuario temporalmente
  🟡 En mi punto medio   → energy_level = 2
     UI normal
  🟢 Batería al 100%     → energy_level = 3
     Puede activar notificaciones en tiempo real temporalmente
```

El check-in no es obligatorio. Si no se hace, se mantiene el nivel anterior.

---

## Halo de Energía (Feed Cards)

Las fotos de perfil tienen un borde de color según diagnóstico principal:

```
TEA:           #7EB8D4 (azul tranquilo)
TDAH:          #7C6AF7 (violeta energético)
AACC:          #4A7C59 (verde profundo)
Dislexia:      #E8A87C (naranja cálido)
Autoidentified: #B0B0C8 (gris suave)
Multiple:       Degradado de los colores correspondientes
```

Energía del día también modifica el halo:
- Nivel 1: halo pulsante lento (1 ciclo/3 segundos)
- Nivel 2: halo estático
- Nivel 3: halo con brillo sutil

---

## Estados MSN

Campo de texto libre debajo del username (máx 160 caracteres).
Ejemplos sugeridos (no obligatorios):
- "En hiperfoco, leo pero no respondo hoy"
- "Batería al 100%, ¡hablemos!"
- "Modo recarga, vuelvo mañana"
- "Disponible para plans tranquilos"

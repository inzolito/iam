<!-- 
Cuando se implemente cualquiera de los puntos aquí listados, el resultado debe quedar registrado en un archivo llamado 'historial', bien documentado con todo lo que se aplicó, cambios realizados y resultados obtenidos.
-->

# Lista de Pendientes (Reparaciones e Implementaciones)

## 🛠️ Errores de Datos y Cálculos (Filtros Temporales)
*   **Inconsistencia en PnL de Hoy:** El bot ganó +150 USD, pero el dashboard muestra `-1.89%` y `56.74` en rojo. Revisar la lógica de cálculo de porcentajes y valores netos.
*   **Lógica de Color en Winrate:** El winrate del 45% aparece en rojo. Evaluar si debe ser verde o definir umbrales de color institucionales.
*   **Ganancia Promedio Confusa:** Dice `17.54` cuando la ganancia real fue >150 USD. Clarificar si el promedio es por trade o por día, y corregir el cálculo.
*   **Impacto de Costos Erróneo:** Muestra PnL Bruto de `56 USD` (positivo) pero en color rojo. Revisar montos y validación de colores.
*   **Comisiones y Swaps en Cero:** El sistema marca `0` en comisiones, swaps y porcentajes, incluso cuando hay operativa. Revisar la ingesta desde MT5 y MetaAPI.
*   **Rendimiento por Sesión:** Muestra `London NY +10.11` y `NY -66.00`. No coincide con la ganancia real de >150 USD (posible desajuste de zona horaria o filtrado).
*   **Duración de Resultados:** Revisar y validar los cálculos de tiempo de exposición.
*   **Mapa de Calor:** Los datos no coinciden con la operativa real. Revisar agrupación por horas/días.
*   **Discordancia General:** Las métricas en filtros de "Semana" y "Mes" también presentan inconsistencias graves.

## 📈 Mejoras de Visualización
*   **Optimización de Equity Curve (Hoy):** Cuando el filtro es de un solo día, no debe ser un punto. La lógica debe cambiar a escala de **horas**, iniciando a las 00:00 del día actual hasta la hora actual.
*   **Rendimiento por Par:** El winrate en trades negativos aparece como `00%`. Revisar si debe ser un porcentaje negativo o reflejar la estadística real de trades perdedores por símbolo.
*   **Interfaz Colapsable:** Añadir la opción de colapsar/expandir cada div (sección) del dashboard para permitir una vista personalizada y ampliada de métricas específicas.

## 🎨 UI & Footer
    `Develop by MaikolSalasM`

## 🧠 Educación y Análisis de Riesgo
*   **Explicación de Correlación:** Añadir ayuda visual en la sección de Correlación de Cartera:
    *   **Resumen Superior:** Un texto breve (2-3 líneas) que explique que la correlación mide la similitud de movimientos y que valores altos (verdes o rojos) indican concentración de riesgo.
    *   **Botón de Ayuda ("Saber más"):** Un mecanismo (modal o div expandible) que detalle la escala -1 a +1, explicando que el verde/rojo intenso no es "bueno", sino que indica duplicidad de riesgo o bloqueo de capital.


---
*Nota: Revisar integraciones de backend y frontend para asegurar que los filtros `date_from` y `date_to` se aplican correctamente en todas las queries SQL.*

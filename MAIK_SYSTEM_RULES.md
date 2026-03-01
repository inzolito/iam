# 🛡️ MAIK SYSTEM RULES (REGLAS DE ORO)

Estas reglas son de carácter **OBLIGATORIO** para cualquier agente (IA) que trabaje en este proyecto. No se deben romper bajo ninguna circunstancia sin previo acuerdo manual con Maikol.

## 1. Gestión de Sesiones y Horarios
- **Inicio de Sesión:** Siempre se define a las **00:00:00 Local (UTC-3)**.
- **Reseteo Diario:** Todos los cálculos de rendimiento deben reiniciarse a esta hora exacta.
- **Zona Horaria:** El servidor opera en UTC, pero la lógica de negocio y visualización debe ser siempre Local (UTC-3).

## 2. Cálculo de PnL y Balance
- **PnL Neto (Sesión):** Se calcula exclusivamente como **Delta de Equidad**:
  `PnL_Sesion = Balance_Actual - Balance_Inicial_a_las_00:00`.
- **Prohibición de "Suma de Profits":** Nunca calcular el PnL sumando profits individuales de la API, ya que ignora fees, funding y pérdidas de órdenes abiertas (scale-ins).
- **Consistencia:** Si el Dashboard dice X, el valor en Bitget debe ser X. No se aceptan aproximaciones que ignoren costos operativos.

## 3. Protocolo de Verificación (Pre-Despliegue)
- **Cero Alucinaciones:** Antes de confirmar una tarea como "lista", el agente debe:
  1. Leer los logs del servidor (`trades_history.txt`).
  2. Verificar que el `starting_balance` en la base de datos sea el correcto para el día.
  3. Ejecutar un script de comprobación técnica (`check_db.py` o similar).
- **Reporte Técnico:** Al terminar, el agente debe reportar los números reales verificados (Balance, PnL, Operaciones activas).

## 4. Diseño y UI (Mobile First)
- **Accesibilidad:** Todo botón o enlace en el Dashboard debe ser fácil de presionar en móviles (mínimo 44x44px).
- **Identidad Visual:** La pestaña de IA debe tener el icono de rayo parpadeante (IA) para ser detectado rápidamente.

## 5. Lógica de Trading (Macros)
- **Nested Orders:** Las órdenes de autocompra (Scale-in) se muestran anidadas bajo la posición principal para mantener el orden visual.
- **Apalancamiento:** No modificar configuraciones de apalancamiento sin revisión de riesgos.

---
*Cualquier código nuevo debe ser auditado contra este documento.*

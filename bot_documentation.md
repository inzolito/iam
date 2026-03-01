# Documentación Técnica: MaikBotTrade V9.0 (IA-Optimized)

Esta documentación describe la arquitectura, los modos de trading, y la construcción de la página web (Dashboard) que controla el Scalping Bot de XAU/XAG.

---

## 1. Resumen de Cambios Recientes (V8.2 -> V9.0)

Se ha integrado un motor de optimización basado en los diagnósticos proactivos de Gemini AI:
- **Asymmetrical Trailing Stop**: Protección agresiva de beneficios específicamente para posiciones SHORT (Sell).
- **Dynamic Sizing (Mini-Kelly)**: El bot ahora escala su lotaje un **+20%** en setups de alta probabilidad (Win Rate > 75%).
- **Adaptive Strategy Switching**: El Plan B (Momentum) ahora se activa automáticamente si el Plan A (Reversión) falla.
- **Dashboard Full-Width**: El panel de IA se expandió para facilitar la lectura de informes técnicos.
- **Absolute Real-Margin Display**: El dashboard muestra la **Garantía Real** aportada en cada posición.

---

## 2. Arquitectura de los "Bots" (Modos de Trading)

El sistema ahora soporta múltiples perfiles de riesgo gestionables desde el panel superior del Dashboard.

### A. Modo Algorítmico Puro
- **Características**: Se basa **estrictamente** en el valor del Z-Score (-1.5 / +1.5) y las bandas de cointegración estadística.
- **Funcionamiento**: Ignora por completo cualquier indicador técnico "clásico" (como el RSI o las Medias Móviles). Si hay desviación entre Plata y Oro, entra.
- **Uso**: Útil en mercados laterales de altísima frecuencia.

### B. Modo Híbrido (Por Defecto)
- **Características**: Añade un filtro técnico al Z-Score.
- **Funcionamiento**: Combina la reversión a la media (Z-Score estadístico) con filtros clásicos. El `TradeEngine` define un "Régimen de Mercado" (Tendencia o Reversión). Si el Z-Score indica compra pura, pero el MACD muestra divergencia bajista profunda, el bot **bloquea la orden** (Filtro Activo).

### C. Modo Inteligente (Trailing Stop)
- **Características**: Modifica el manejo de los Take Profits (Tolerancia al Riesgo).
- **Funcionamiento**: En vez de cerrar una operación al llegar a su ganancia esperada, el motor calcula dinámicamente:
  1. Si el mercado sube, cancela el *Take Profit* de Bitget.
  2. Sube el *Stop Loss* por encima del punto de entrada (asegurando el Break-Even más comisiones).
  3. Comienza a perseguir el precio cada pocos tics.
- **Uso**: Diseñado para exprimir al máximo corridas de tendencia no previstas (Flash Crash / Liquidaciones Largas).

### D. Modo Anti-Bot (Switch Secundario)
- **Características**: Defensa contra alta manipulación.
- **Funcionamiento**: Invierte el sentido del `TradeEngine`. Si la máquina ordena comprar Oro y vender BTC porque estadísticamente están "baratos", el script Anti-Bot asume que es una trampa de liquidez, y vende Oro comprando BTC. Los valores de Stop Loss y Take Profit también se recalculan a la inversa.

---

## 3. Construcción del Dashboard (Maik Control)

La interfaz se creó utilizando el micro-framework **Flask (Python)** combinado con una estructura **Vanilla JS y CSS Avanzado** en el lado del cliente, garantizando la máxima compatibilidad y rapidez sin frameworks pesados como React/Next.js.

### Motor de Backend (`app.py`)
- **Arquitectura REST**: Levanta un servidor web interno en el puerto 5000 (`0.0.0.0:5000` via GCP).
- Desarrollado con 2 Endpoints Críticos:
  - `GET /api/status`: Reúne un ecosistema de archivos (`active_positions.json`, Base de Datos SQLite, `trades_history.txt` invirtiendo su orden cronológico y `ai_output.txt`) y lo envía como un solo bloque comprimido al navegador del usuario cada 5 segundos.
  - `POST /api/config`: Recibe la señal del usuario ("Clic" en Inteligente) y escribe el `config.json` para que el `main.py` de atrás lo lea en el próximo milisegundo.

### Interfaz Frontend (`templates/index.html`)
Diseñada bajo el patrón **"Light SaaS Minimalist"** (V10), orientado a plataformas B2B y Fintech de alto nivel, priorizando el espacio en blanco, el alto contraste y la legibilidad extrema.

* **Layout Base**:
  - Un Header limpio con tipografía oscura, estado visual y botones estilo píldora (`rounded-full`).
  - El **Control Center**, agrupando los botones `mode-btn` con estados activos claros (`bg-slate-900 text-white`) e inactivos.
  - Una grilla de tarjetas blancas puras (`bg-white`) con bordes sutiles (`border-slate-100`) y sombras suaves (`shadow-sm`) sobre un fondo general súper claro (`bg-slate-50`). Los colores vivos (`emerald-600` y `red-600`) se usan estrictamente de forma semántica para demarcar ganancias (LONG) o pérdidas (SHORT).

* **Componentes JS Dinámicos**:
  - `updateDashboard()`: La función en JavaScript consume `/api/status`. Repinta dinámicamente usando DOM `innerHTML`. Usa selectores específicos para pintar de Verde (`var(--green)`) las variables positivas y Rojo neón (`var(--red)`) si el PnL entra en negativo o la Inteligencia Artificial registra errores.
  - Los cálculos no se hacen en la página, se hacen en el servidor. La página web es **100% tonta** (solo dibuja lo que el servidor ordena), lo que la hace ultra-rapida.

### 4. Módulos de Datos (Divs del Dashboard)
La cuadrícula principal (`.dashboard-grid`) está compuesta por las siguientes 7 Tarjetas (Cards) de datos que se actualizan en tiempo real:

1. **BALANCE TESTNET (`#card-balance`)**
   - Muestra el capital disponible (`$396.70`).
   - Muestra el **PnL Neto Estimado** total descontando comisiones abiertas.
   - En el pie del div, calcula el Promedio de Ganancia (`Prom. Ganancia`) vs. Promedio de Pérdida (`Prom. Pérdida`) exacto por ticket.

2. **MOTOR OPERATIVO (`#card-engine`)**
   - **Nombre del Plan Activo**: Imprime en texto gigante morado si el bot está corriendo la rutina `PLAN_A` o `PLAN_B`.
   - **WinRate Algorítmico vs Métricas Reales**: Compara el % de probabilidad teórica que el script le asigna a ese plan, versus el WinRate real (W/L ratio de Base de Datos).
   - **Señal Actual**: (Texto holográfico que respira) Imprime literalmente la intención actual de la máquina (Ej: `SCALE_IN_SHORT_ORO`).

3. **ACUMULADO GLOBAL (`#card-global`)**
   - **Trades con Profit VS Fallidos**: Contador en vivo de los aciertos vs errores historicos de todo el bot (`2 / 2`).
   - Sub-divisiones exactas: Desglosa cuántas victorias (W) y derrotas (L) tuvo específicamente operando LONG o operando SHORT desde que se inició.

4. **PLAN A: TENDENCIA (`#card-plana`)**
   - Panel de tracking especifico para operaciones de Momentum/Tendencia.
   - Cuenta cuántos `LONG PROFIT` exitosos y cuántos `SHORT PROFIT` exitosos ha logrado usando la lógica de seguimiento tendencial, evaluando la asertividad matemática de dicha estrategia en vivo.

5. **PLAN B: REVERSIÓN (`#card-planb`)**
   - Idéntico al Plan A, pero evalúa los resultados de las estrategias creadas cuando las medias móviles o RSI buscan cruces a contraflujo (Rebotes al soporte).

6. **ANÁLISIS IA (GEMINI) (`#ai-analysis`)**
   - Este módulo de doble ancho de columnas lee el archivo de salida del analista experto generado por `ai_analyst.py`. Interpreta la métrica del bot como un Director de Trading Humano y ofrece consejos estratégicos.

7. **POSICIÓN ACTIVA (`#active-positions`)**
   - Escucha el `active_positions.json`. 
   - Genera Tarjetas dinámicas con bordes según el color del trade (Rosa = SHORT, Verde = LONG). 
   - Imprime nombre del Activo (`XAU`), Volumen (`Contratos`), el Precio de Entrada exacto (`Entry`), y el **PnL Flotante en tiempo real** en formato gigante.

8. **Historial de Operaciones (Estilo Bitget)**
   - Al final de la página, fuera de la grilla principal, se construyó una tabla visual ancha (estilo plataforma Exchange/Bitget) en lugar de una simple consola de código.
   - **Registro Explícito del "Por qué"**: Cada línea no solo muestra si se "abrió" o "cerró" una posición, sino la razón matemática exacta fundamentada por el **Modo Actual**. 
     - *Ejemplo Algorítmico*: `[CERRADO LONG ORO] Motivo: Z-Score cruzó 0.0`
     - *Ejemplo Inteligente*: `[ACTUALIZACIÓN] Subiendo Trailing Stop a Break-Even +0.5%`
     - *Ejemplo Anti-Bot*: `[SEÑAL INVERTIDA] Comprando ORO por detección de manipulación institucional de Venta.`
   - A nivel de JavaScript, el listado se **invierte cronológicamente** (Reversed array) para que la última acción ejecutada por el script o el broker salte a la parte superior de la vista de Inmediato, evitando tener que hacer scroll hacia abajo constantemente.
  - Se eliminaron los estilos de "cristal" en favor de fondos sólidos ultra rápidos que renderizan instantáneamente en teléfonos de gama baja o pantallas de `1366x768`.

---

---

## 5. Gestión de Sesiones y Horarios (UTC-3)

El sistema opera bajo un concepto de **Sesión Diaria**, sincronizada con el tiempo local del usuario para garantizar que las métricas de la IA y el Dashboard sean coherentes con la actividad real.

### Sincronización de Datos
- **Reset de Estadísticas**: El `supervisor.py` calcula automáticamente el inicio del día local (**00:00:00 UTC-3**) en cada ciclo de actualización. Los trades anteriores a ese momento son ignorados en los cálculos de Win Rate, Ganancia Promedio y PnL de la sesión.
- **Análisis IA**: El Analista IA (`ai_analyst.py`) heredada esta lógica a través de la base de datos, enfocando sus diagnósticos únicamente en el rendimiento de la ventana de tiempo actual.
- **Desfase de Servidor**: Aunque el servidor físico pueda operar en UTC, la lógica interna aplica un offset de **-3 horas** para alinearse con el cierre de sesión del usuario.

### Comportamiento a Medianoche
- A las 00:00:01 local, el bot limpia sus contadores internos de la sesión anterior.
- Los trades abiertos que crucen la medianoche seguirán siendo monitoreados, pero su resultado final se contabilizará en la sesión del día en que se cierren.

---
> **Despliegue General**: Todos estos procesos se alojan finalmente en instancias `systemctl` (SystemD) dentro de Google Cloud, asegurando de que si Python tira algún error de memoria, el servicio se reinicia de manera transparente en 3 segundos sin que el usuario de la web note que algo pasó.

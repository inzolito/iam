# Analytica: Documentación Técnica de Niveles

## Introducción: El Concepto "Vera"
Analytica nace para eliminar el sesgo emocional del trading mediante datos puros. "Vera" representa la verdad objetiva del rendimiento, permitiendo al trader enfrentarse a sus estadísticas sin distorsiones psicológicas.

---

## Nivel 1: El MVP (Fundamentos)
*Enfoque: Visibilidad básica y control de daños.*

- **1.1 Net Profit / Loss**: El resultado final absoluto tras restarle costes.
- **1.2 Win Rate (%)**: Ratio de éxito. Crucial para entender si la estrategia tiene ventaja estadística.
- **1.3 Profit vs Loss Promedio**: ¿Ganas más cuando ganas de lo que pierdes cuando pierdes? (Ratio R/B teórico vs real).
- **1.4 Cantidad de TP y SL**: Mide la disciplina. ¿Se ejecutan las salidas automáticas o hay intervención humana?
- **1.5 Tabla de Pares (Básico)**: Identificación de activos rentables vs. "quemadores de capital".
- **1.6 Volumen Total**: Medición de la exposición total al mercado en lotes.
- **1.7 Equity Curve**: Visualización lineal del crecimiento o decrecimiento de la cuenta.
- **1.8 Trades Cerrados Manuales**: Marcador de indisciplina o gestión activa necesaria.

---

## Nivel 2: Beta 1 (Eficiencia y Riesgo)
*Enfoque: Robustez del sistema y gestión del riesgo.*

- **2.1 Profit Factor**: (Beneficio Bruto / Pérdida Bruta). La métrica reina de la rentabilidad. > 1.5 es el objetivo.
- **2.2 Max Drawdown**: La mayor caída desde un pico. Mide el dolor máximo soportado por la cuenta.
- **2.3 Ratio R/B Real**: Lo que realmente se ejecutó, no lo que se planeó en el gráfico.
- **2.4 Rachas (+/-)**: Máximo de operaciones seguidas en acierto o error. Prepara al trader para la varianza.
- **2.5 Expected Payoff**: ¿Cuántos USD esperas ganar por cada trade en promedio?
- **2.6 Tiempo Promedio**: Tiempo de exposición. ¿Eres un scalper o un swing trader en la práctica?
- **2.7 Impacto de Costos**: Detalle de Comisiones y Swaps. Revela si el broker se queda con tu ventaja.
- **2.8 Ranking de Activos**: Top 5 mejores/peores para optimizar el enfoque operativo.

---

## Nivel 3: Beta 2 (Psicología y Timing)
*Enfoque: Optimización de la ejecución y control emocional.*

- **3.1 Análisis por Sesión**: Asia, Londres, NY. ¿En qué horario eres realmente rentable?
- **3.2 Mapa de Calor PnL**: Rendimiento por día de la semana. ¿Deberías dejar de operar los viernes?
- **3.3 MAE (Maximum Adverse Excursion)**: Cuánto fue el máximo que estuvo en contra un trade que terminó ganando. Mide si tus SL son demasiado anchos.
- **3.4 MFE (Maximum Favorable Excursion)**: Cuánto fue el máximo que estuvo a favor un trade antes de cerrar. Mide si dejas mucho dinero sobre la mesa.
- **3.5 Holding Time vs Result**: Correlación entre cuánto tiempo mantienes y el éxito.
- **3.6 Z-Score**: Dependencia estadística. ¿Un win suele ir seguido de un loss?
- **3.7 Efficiency Ratio**: Calidad de la salida. ¿Saliste en el punto óptimo del movimiento?

---

## Nivel 4: V1.0 (Institucional)
*Enfoque: Estándares profesionales y análisis predictivo.*

- **4.1 Sharpe Ratio**: Retorno ajustado al riesgo (Volatilidad). El estándar de los Hedge Funds.
- **4.2 Monte Carlo (1,000 esc.)**: Simulación de probabilidad para entender la ruina de la cuenta bajo varianza.
- **4.3 Recovery Factor**: (Net Profit / MaxDD). Indica qué tan rápido el sistema se recupera de sus rachas negativas.
- **4.4 SQN (System Quality Number)**: Puntuación de Van Tharp para calificar la calidad del sistema.
- **4.5 Alertas de Correlación**: Aviso de sobre-exposición si operas pares correlacionados (ej: EURUSD y GBPUSD).
- **4.6 Calendario Interactivo**: Visualización de estilo "Daily Journal" para ver el PnL por día de un vistazo.
- **4.7 Tags Psicológicos**: Análisis de datos asociados a estados mentales (ej: "Venganza", "FOMO", "Euforia").

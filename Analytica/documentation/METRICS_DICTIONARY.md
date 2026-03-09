# Diccionario de Métricas Analytica

Entienda el significado y el valor real de cada indicador que Analytica calcula para su cuenta.

## 1. Métricas de Rendimiento Básico
### Net Profit/Loss (Beneficio Neto)
Es el resultado final de su operativa después de restar todos los costos operativos (Comisiones y Swaps). Es el dinero real que entra o sale de su bolsillo.

### Win Rate (Tasa de Acierto)
Porcentaje de operaciones que terminan en beneficio frente al total de operaciones.
*   *Fórmula*: `(Ganadoras / Totales) * 100`

### Profit Factor (Factor de Beneficio)
Indica cuántos dólares gana por cada dólar que pierde.
*   *Referencia*: Un Profit Factor mayor a 1.5 se considera un sistema saludable.

---

## 2. Métricas de Riesgo y Consistencia
### Max DrawDown (Caída Máxima)
Representa la mayor pérdida acumulada desde un pico de capital hasta un valle subsiguiente. Mide el "dolor" o estrés financiero que su cuenta ha soportado.

### Sharpe Ratio
Mide el retorno obtenido en relación al riesgo asumido. Cuanto más alto es el Sharpe Ratio, más eficiente es el trader.
*   *Valor Ideal*: Por encima de 2.0 se considera excelente.

### Recovery Factor (Factor de Recuperación)
Indica qué tan rápido se recupera su sistema después de una pérdida importante.
*   *Fórmula*: `Net Profit / Max Drawdown`

---

## 3. Análisis de Eficiencia Operativa
### MAE (Max Adverse Excursion)
La cantidad máxima de capital que un trade estuvo "en rojo" antes de cerrar. Ayuda a identificar si sus Stop Loss están demasiado alejados.

### MFE (Max Favorable Excursion)
El punto máximo de beneficio que alcanzó una operación antes de cerrarse. Ayuda a identificar si está cerrando sus trades demasiado temprano y dejando dinero sobre la mesa.

### Z-Score
Valor estadístico que indica si ganar un trade influye en que ganes el siguiente. Determina si tienes rachas de éxito predecibles o si tu operativa es aleatoria.

---

## 4. Clasificación Institucional (Niveles)
Analytica utiliza estas métricas para asignarle un rango:
- **Bronze**: Trader en fase de obtención de datos.
- **Silver**: Win Rate constante y gestión de riesgo básica.
- **Gold**: Profit Factor > 1.8 y Drawdown controlado.
- **Platinum**: Sharpe Ratio institucional y consistencia mayor a 3 meses.

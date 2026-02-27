# Documentación del Bot de Arbitraje Matemático (Oro/Plata)

## 1. Naturaleza de la Estrategia

El presente bot es un algoritmo de **Arbitraje Estadístico por Reversión a la Media (Statistical Arbitrage - Mean Reversion)**. Está diseñado específicamente para operar el "spread" o "ratio" entre dos activos altamente cointegrados financieramente: el **Oro (XAUUSDT)** y la **Plata (XAGUSDT)**.

En lugar de intentar predecir la dirección general del mercado (análisis direccional), el bot analiza puramente la relación proporcional entre ambos metales. Parte del fundamento de que ambos activos están apalancados por las mismas variables macroeconómicas globales.

## 2. Lógica Matemática (Z-Score)

El bot no utiliza indicadores técnicos tradicionales como RSI o MACD, sino estadística inferencial pura:

* **Paso 1 (Extracción):** El bot toma el precio exacto del Oro ($X$) y de la Plata ($Y$) cada 10 segundos directamente desde Bitget (Testnet).
* **Paso 2 (Ratio):** Calcula la relación $R = \frac{X}{Y}$.
* **Paso 3 (Memoria):** Alimenta un array (`deque`) limitándolo estrictamente a los últimos 20 datos computados ($R_1, R_2 ... R_{20}$).
* **Paso 4 (Parámetros Poblacionales):** Calcula la Media Aritmética ($\mu$) y la Desviación Estándar ($\sigma$) precisa del Ratio poblacional (la ventana de 20 datos) usando la librería `numpy` para evitar errores de coma flotante.
* **Paso 5 (Z-Score):** Obtiene la medida de desviación estándar actual en tiempo real a través de la fórmula de estandarización:
  $$ Z = \frac{R_{actual} - \mu}{\sigma} $$

## 3. Condiciones de Entrada y Salida (Gatillos)

El umbral de Z=2.0 en estadística normal (Campana de Gauss) indica que el valor actual se encuentra en el 95% probabilístico externo de alejamiento del promedio; es decir, es un comportamiento excepcionalmente anómalo que, por naturaleza, tiende a volver a la media (0).

* **Gatillo de COMPRA PLATA (+2.0):** El precio del Oro está anormalmente "caro" en proporción a la Plata. Se ejecuta la orden de compra apalancada en **XAGUSDT**, esperando que la plata suba de precio para cerrar la brecha del ratio y volver a su media.
* **Gatillo de COMPRA ORO (-2.0):** El precio del Oro está anormalmente "barato" respecto a la Plata. Se ejecuta la orden de compra apalancada en **XAUUSDT**, asumiendo que es su turno de subir para acortar el spread histórico.

### Gestión de Riesgo (Risk Management)
Las órdenes son introducidas "a mercado" (`market`) a través de la API, acoplándolas automáticamente con topes de contención en fracciones porcentuales (Scalping):
* **Take Profit:** `0.4%` por encima del precio de entrada (buscando salir rápido de la anomalía matemática).
* **Stop Loss:** `0.2%` por debajo (Relación Riesgo/Beneficio asimétrica de 1:2, asumiendo que si el mercado decide "romper" su cointegración general y separarse más, el robot prefiere asumir pérdida corta antes de atraparse en una divergencia persistente de largo plazo).

## 4. Eficiencia y Contexto de Mercado ideal

**¿En qué escenarios el bot es más agresivo y certero?**

1. **Mercados Laterales de Alta Volatilidad ("Choppy Markets"):** El modelo brilla estelarmente en días donde no hay noticias de alto impacto, y donde el Oro y la Plata consolidan sus precios en un canal ruidoso. El bot operará el ruido microscópico del spread.
2. **Mercados Maduros:** Esta estrategia no funciona en criptomonedas alternativas ("Memecoins" o "Altcoins") ya que tienen poca capitalización de mercado y sus precios se separan aleatoriamente sin volver a juntarse nunca (ausencia de cointegración). Por eso los metales nobles y pares de divisas masivos ($EUR/USD$ vs $GBP/USD$) son sus hábitats.
3. **Peligro (Tail-Risk):** El "Cisne Negro" temporal de este bot es que se presente un catalizador económico que modifique bruscamente el modelo de una materia prima, pero no de la otra (Ej. Se descubre el depósito de Plata más masivo de la historia; el precio de la plata colapsa y el oro no). En ese escenario, el ratio histórico se rompe orgánicamente. El agresivo Stop Loss (`0.2%`) funge de airbag contra esta anomalía extrema.

## 5. Arquitectura del Software (Documentación Técnica)

El entorno se programó en **Python 3.11** y está fragmentado modularmente bajo el patrón Orientado a Objetos funcional.

### A) El Motor Analítico (`engine.py`)
Clase aislada e independiente llamada `TradeEngine`. 
* **Input:** Precios crudos del broker.
* **Componente Analítico:** Mantiene estado interno en variable `self.ratios`. Convierte los arrays dinámicos a estructuras optimizadas en C subyacente (usando `numpy.array()`) para un cálculo inmediato de $\mu$ (`np.mean`) y $\sigma$ (`np.std`).
* **Manejo de Excepciones:** Contiene lógica para lidiar con el factor "División por Zero" en el caso matemático teórico de que todos los valores del array sean los mismos y el desvío estándar decaiga a cero puro.

### B) El Router / Broker Gateway (`broker.py`)
Utiliza la interfaz universal **CCXT** para conectarse al Exchange (Bitget). 
* **Modulación:** Abstrae la API del Exchange por completo. Si en un futuro el equipo cambia de Bitget a Binance o Bybit, **el motor central no requiere reescritura**; basta con reencapular las llaves de este archivo puntual.
* **Testnet Binding:** Parámetro embebido `exchange.set_sandbox_mode(True)` para canalizar operaciones al entorno Demo, y configuración contextual `{'options': {'defaultType': 'swap'}}` que fuerza la API a revisar la billetera de *Futuros Perpetuos Margenizados* en lugar de Spot.

### C) El Bucle Central (`main.py`)
* Control de latido temporal condicionado por `time.sleep(10)` (Ciclo 10seg).
* Control Asincrónico Silencioso (`try/except` global): Las peticiones API son propensas a errores momentáneos por latencia de la red, mantenimientos de IP o rechazo por Tasa Límite (Rate Limits). El lazo continuo "engulle" estas excepciones y simplemente reintenta a los 10 segundos, previendo el "Death of Execution" o congelabilidad del bot desatendida.

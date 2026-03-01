# 🛡️ PROYECTO MAIKBOT TRADE
> **CRITICAL:** Antes de realizar cualquier cambio, es obligatorio leer y cumplir con las [Reglas de Oro](MAIK_SYSTEM_RULES.md).

 Scalping Oro/Plata

Este es un bot de Scalping diseñado para operar las divergencias en el ratio entre Oro (XAUUSDT) y Plata (XAGUSDT). 

Opera directamente en **Bitget Testnet** utilizando un modelo estadístico de reversión a la media mediante el cálculo constante del **Z-Score** sobre el ratio de precios en tiempo real. 

Si el Z-Score supera un umbral de +2.0 se ejecuta una orden de compra de Plata, y si desciende de -2.0 se ejecuta una orden de compra de Oro.

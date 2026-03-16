# Plan de Mejora: Auditoría IA + Correlación Macro

Este documento detalla los pasos para la implementación del sistema de Auditoría de IA con integración de eventos macroeconómicos fundamentales.

## Fase 1: Infraestructura de Datos Macro
- [ ] Incorporar la tabla `macro_events` en el modelo de base de datos (`backend/app/models/database.py`).
- [ ] Generar y aplicar migración de Alembic para la nueva tabla.
- [ ] Registrar la actualización en el `HISTORIAL.md`.

## Fase 2: Ingesta de Datos Fundamentales
- [ ] Crear el servicio `MacroService` para la obtención de noticias de alto impacto.
- [ ] Implementar un conector (Scraper o API) para obtener datos de calendarios económicos (Investing/ForexFactory).
- [ ] Crear un proceso de actualización periódica para mantener la base de datos de eventos al día.

## Fase 3: Cerebro de IA (Integración)
- [x] Desarrollar el `AIAnalyticService` que consuma:
    - Datos de trades filtrados.
    - Capturas de métricas de rendimiento.
    - Eventos macro coincidentes en tiempo.
- [x] Diseñar el Prompt Maestro para **Gemini 2.0 Flash Lite** incorporando la variable fundamental.
- [x] Implementar la lógica de guardado de reportes en `ai_performance_reports`.

## Fase 4: Interfaz de Usuario (Dashboard)
- [x] Añadir el botón "Auditoría de IA" en los componentes relevantes del frontend.
- [x] Crear el panel de visualización de reportes que muestre:
    - Diagnóstico de rentabilidad.
    - Correlación Macro-Trade.
    - Plan de acción para el 10% de rendimiento.

---
**Estado Actual:** Despliegue completado.

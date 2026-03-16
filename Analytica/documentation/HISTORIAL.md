# Historial de Cambios y Decisiones - Analytica

## [2026-03-16] - Fase de Definición: Auditoría de IA
- **Regla Establecida**: A partir de este momento, todas las acciones, definiciones y cambios se registrarán en este documento.
- **Definición de Funcionalidad**:
    - Se aterrizó la idea del "Auditor de IA" en el dashboard.
    - El análisis será bajo demanda (presionando un botón) para optimizar el consumo de tokens.
    - Se definió la necesidad de dos campos de IA por trade (pre y post trade) y una tabla centralizada `ai_performance_reports`.
    - Se incluyó análisis comparativo mensual para sesiones operativas.
    - Se integró optimización horaria basada en el Mapa de Calor.
- **Objetivo del Análisis**: Maximizar el rendimiento hacia un 10% diario identificando causas raíz de trades negativos y factores de éxito en positivos.

## [2026-03-16] - Implementación Técnica: Base de Datos de IA
- **Modelos**: Actualizado `app/models/database.py` con:
    - Tabla `ai_performance_reports` para reportes de auditoría.
    - Campos `opening_ai_analysis` y `closing_ai_analysis` en la tabla `trades`.
- **Infraestructura de Datos**:
    - Configurado `alembic/env.py` y `alembic/script.py.mako` para permitir autogeneración.
    - Aplicada migración `36df710865ae` en la base de datos PostgreSQL de producción.
- **Resiliencia**: Limpieza de scripts de migración para proteger tablas legadas (`prism_*`).

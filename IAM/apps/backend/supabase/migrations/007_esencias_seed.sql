-- Stage 6: Seed unlock rules with diagnosis-specific features

-- ============================================================
-- TEA DIAGNOSIS: Zen theme - Sensory comfort & reduced stimulation
-- ============================================================

INSERT INTO unlock_rules (diagnosis, feature_key, feature_name, description, required_esencias, category, ui_settings)
VALUES
(
  'TEA',
  'sensory_dashboard',
  'Panel Sensorial',
  'Modo con movimiento reducido, colores calmantes y animaciones mínimas para comodidad sensorial.',
  50,
  'theme',
  '{
    "reducedMotion": true,
    "colorScheme": "calm",
    "animationDuration": 0,
    "fontScale": 1.0,
    "description": "Interfaz minimalista para usuarios sensibles a estímulos visuales"
  }'::jsonb
),
(
  'TEA',
  'deep_focus_theme',
  'Tema Enfoque Profundo',
  'Interfaz ultra-minimalista sin distracciones, perfecta para hiperfoco.',
  100,
  'theme',
  '{
    "reducedMotion": true,
    "colorScheme": "monochrome",
    "hideNonessential": true,
    "fontScale": 1.0,
    "animationDuration": 0,
    "description": "Esconde todos los elementos no esenciales para máxima concentración"
  }'::jsonb
);

-- ============================================================
-- TDAH DIAGNOSIS: Dashboard - Energy & movement
-- ============================================================

INSERT INTO unlock_rules (diagnosis, feature_key, feature_name, description, required_esencias, category, ui_settings)
VALUES
(
  'TDAH',
  'energy_boost',
  'Impulso de Energía',
  'Colores vibrantes, animaciones energéticas y accesos rápidos a acciones frecuentes.',
  50,
  'theme',
  '{
    "reducedMotion": false,
    "colorScheme": "vibrant",
    "animationDuration": 300,
    "fontScale": 1.0,
    "enableAnimations": true,
    "description": "Interfaz energética y estimulante con retroalimentación visual constante"
  }'::jsonb
),
(
  'TDAH',
  'quick_nav_bar',
  'Barra de Navegación Rápida',
  'Accesos directos persistentes a acciones favoritas y navegación frecuente.',
  75,
  'dashboard',
  '{
    "showQuickNav": true,
    "customizableShortcuts": true,
    "maxShortcuts": 6,
    "position": "bottom",
    "description": "Atajos personalizables para las acciones que usas más frecuentemente"
  }'::jsonb
);

-- ============================================================
-- AACC DIAGNOSIS: Profundidad - Detailed & deep analysis
-- ============================================================

INSERT INTO unlock_rules (diagnosis, feature_key, feature_name, description, required_esencias, category, ui_settings)
VALUES
(
  'AACC',
  'profundidad_extended',
  'Profundidad Extendida',
  'Estadísticas detalladas, análisis de compatibilidad y métricas de interacción.',
  50,
  'dashboard',
  '{
    "showDetailedStats": true,
    "compatibilityBreakdown": true,
    "showInteractionMetrics": true,
    "dataVisualization": "advanced",
    "description": "Desglose detallado de compatibilidad y estadísticas de matched"
  }'::jsonb
),
(
  'AACC',
  'advanced_search',
  'Búsqueda Avanzada',
  'Búsqueda booleana, filtrado multicapa y búsquedas guardadas para SpIn tags.',
  100,
  'dashboard',
  '{
    "enableBooleanSearch": true,
    "advancedFilters": true,
    "savedSearches": true,
    "maxSavedSearches": 10,
    "description": "Búsqueda avanzada con operadores booleanos y filtros complejos"
  }'::jsonb
);

-- ============================================================
-- DISLEXIA DIAGNOSIS: Clarity - Readable & accessible
-- ============================================================

INSERT INTO unlock_rules (diagnosis, feature_key, feature_name, description, required_esencias, category, ui_settings)
VALUES
(
  'DISLEXIA',
  'clarity_plus_font',
  'Tipografía Clarity Plus',
  'Escala de fuente 1.25x con tipografía dislexia-friendly (OpenDyslexic) y espaciado ampliado.',
  50,
  'accessibility',
  '{
    "fontScale": 1.25,
    "fontFamily": "OpenDyslexic",
    "letterSpacing": 1.5,
    "lineHeight": 1.8,
    "description": "Tipografía optimizada para dislexia con mayor espaciado"
  }'::jsonb
),
(
  'DISLEXIA',
  'text_reader',
  'Lector de Texto',
  'Lector de texto integrado con síntesis de voz para mensajes, perfiles y descripciones.',
  100,
  'accessibility',
  '{
    "textToSpeechEnabled": true,
    "autoHighlight": true,
    "voiceGender": "neutral",
    "speechRate": 1.0,
    "highlightColor": "#FFD700",
    "description": "Lector de texto integrado para mayor accesibilidad"
  }'::jsonb
);

-- ============================================================
-- VERIFY SEEDING
-- ============================================================

-- Count unlocks by diagnosis
-- SELECT diagnosis, COUNT(*) as count FROM unlock_rules GROUP BY diagnosis;
-- Expected output:
-- TEA     | 2
-- TDAH    | 2
-- AACC    | 2
-- DISLEXIA| 2
-- Total: 8 unlock rules seeded

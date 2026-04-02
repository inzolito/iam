-- Stage 7: Seed venues de ejemplo para desarrollo y demo
-- Venues en Santiago, Chile (zona principal del proyecto)

INSERT INTO venues (name, slug, description, category, address, city, country, location, amenities, sensory_rating, is_active, is_verified, partner_since, esencias_multiplier, opening_hours)
VALUES
-- Cafeterías
(
  'Café Silencio',
  'cafe-silencio',
  'Cafetería con ambiente tranquilo, ideal para personas con sensibilidad sensorial. Música suave, iluminación tenue.',
  'cafe',
  'Av. Providencia 1234',
  'Santiago',
  'CL',
  ST_GeogFromText('POINT(-70.6109 -33.4264)'),
  ARRAY['wifi', 'silencioso', 'accesible', 'enchufes'],
  2, -- Muy tranquilo
  true,
  true,
  NOW() - INTERVAL '30 days',
  1.5, -- 50% bonus Esencias
  '{"lunes": "08:00-20:00", "martes": "08:00-20:00", "miercoles": "08:00-20:00", "jueves": "08:00-20:00", "viernes": "08:00-22:00", "sabado": "09:00-22:00", "domingo": "10:00-18:00"}'::jsonb
),
(
  'Neurocafé',
  'neurocafe',
  'Espacio pensado para mentes neurodivergentes. Zonas diferenciadas: zona silenciosa y zona social.',
  'cafe',
  'Calle Merced 567',
  'Santiago',
  'CL',
  ST_GeogFromText('POINT(-70.6393 -33.4372)'),
  ARRAY['wifi', 'accesible', 'enchufes', 'zona_silenciosa', 'zona_social'],
  3, -- Moderado
  true,
  true,
  NOW() - INTERVAL '15 days',
  2.0, -- Double Esencias!
  '{"lunes": "07:00-21:00", "martes": "07:00-21:00", "miercoles": "07:00-21:00", "jueves": "07:00-21:00", "viernes": "07:00-23:00", "sabado": "08:00-23:00", "domingo": "09:00-19:00"}'::jsonb
),

-- Coworking
(
  'Hub Diverso',
  'hub-diverso',
  'Coworking inclusivo con estaciones de trabajo adaptables, pods de concentración y sala de descanso sensorial.',
  'coworking',
  'Av. Italia 890',
  'Santiago',
  'CL',
  ST_GeogFromText('POINT(-70.6234 -33.4456)'),
  ARRAY['wifi', 'silencioso', 'accesible', 'enchufes', 'impresora', 'sala_reunion'],
  2, -- Tranquilo
  true,
  true,
  NOW() - INTERVAL '60 days',
  1.5,
  '{"lunes": "08:00-22:00", "martes": "08:00-22:00", "miercoles": "08:00-22:00", "jueves": "08:00-22:00", "viernes": "08:00-22:00", "sabado": "09:00-18:00", "domingo": "cerrado"}'::jsonb
),

-- Parques
(
  'Parque Inclusivo Bicentenario',
  'parque-bicentenario',
  'Parque al aire libre con zonas verdes tranquilas. Punto de encuentro para meetups IAM.',
  'parque',
  'Av. Bicentenario 1001, Vitacura',
  'Santiago',
  'CL',
  ST_GeogFromText('POINT(-70.5897 -33.3941)'),
  ARRAY['aire_libre', 'accesible', 'estacionamiento', 'mascotas'],
  1, -- Muy tranquilo (naturaleza)
  true,
  true,
  NOW() - INTERVAL '90 days',
  1.0, -- Normal
  '{"lunes": "06:00-21:00", "martes": "06:00-21:00", "miercoles": "06:00-21:00", "jueves": "06:00-21:00", "viernes": "06:00-21:00", "sabado": "06:00-21:00", "domingo": "06:00-21:00"}'::jsonb
),

-- Biblioteca
(
  'Biblioteca GAM',
  'biblioteca-gam',
  'Centro cultural con biblioteca silenciosa, salas de estudio y eventos culturales neurodiversity-friendly.',
  'biblioteca',
  'Av. Libertador Bernardo O''Higgins 227',
  'Santiago',
  'CL',
  ST_GeogFromText('POINT(-70.6541 -33.4389)'),
  ARRAY['wifi', 'silencioso', 'accesible', 'libros', 'eventos'],
  1, -- Muy tranquilo
  true,
  true,
  NOW() - INTERVAL '120 days',
  1.0,
  '{"lunes": "10:00-20:00", "martes": "10:00-20:00", "miercoles": "10:00-20:00", "jueves": "10:00-20:00", "viernes": "10:00-20:00", "sabado": "10:00-18:00", "domingo": "cerrado"}'::jsonb
),

-- Restaurante
(
  'Rincón Neurodiverso',
  'rincon-neurodiverso',
  'Restaurante con menú sensory-friendly, iluminación adaptable y personal capacitado en neurodiversidad.',
  'restaurante',
  'Calle José Victorino Lastarria 70',
  'Santiago',
  'CL',
  ST_GeogFromText('POINT(-70.6456 -33.4398)'),
  ARRAY['accesible', 'menu_sensorial', 'iluminacion_adaptable', 'personal_capacitado'],
  3, -- Moderado
  true,
  false, -- Pendiente verificación
  NULL,
  1.0,
  '{"lunes": "12:00-22:00", "martes": "12:00-22:00", "miercoles": "12:00-22:00", "jueves": "12:00-22:00", "viernes": "12:00-23:00", "sabado": "12:00-23:00", "domingo": "12:00-20:00"}'::jsonb
);

-- Stage 7: Venues (Asociaciones con lugares reales)
-- Venues son espacios partner donde usuarios pueden encontrarse y ganar Esencias

-- ============================================================
-- VENUES TABLE (Establecimientos partner)
-- ============================================================

CREATE TABLE IF NOT EXISTS venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'cafe', 'coworking', 'parque', 'biblioteca', 'restaurante', 'tienda', 'otro'
  )),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'CL',
  location GEOGRAPHY(POINT, 4326), -- PostGIS point
  image_url TEXT,
  website_url TEXT,
  phone TEXT,
  opening_hours JSONB DEFAULT '{}'::jsonb, -- {"lunes": "09:00-18:00", ...}
  amenities TEXT[] DEFAULT '{}', -- ['wifi', 'silencioso', 'accesible', 'aire_libre']
  sensory_rating INTEGER CHECK (sensory_rating BETWEEN 1 AND 5), -- 1=muy tranquilo, 5=muy estimulante
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false, -- Verificado por admin
  partner_since TIMESTAMPTZ,
  esencias_multiplier NUMERIC(3,1) NOT NULL DEFAULT 1.0, -- Multiplicador de Esencias (1.0 = normal, 2.0 = double)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venues_location ON venues USING GIST(location);
CREATE INDEX idx_venues_city ON venues(city);
CREATE INDEX idx_venues_category ON venues(category);
CREATE INDEX idx_venues_active ON venues(is_active) WHERE is_active = true;

CREATE TRIGGER venues_updated_at
BEFORE UPDATE ON venues
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- RLS: Todos pueden ver venues activos
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view active venues"
ON venues FOR SELECT
USING (is_active = true);

-- ============================================================
-- VENUE_CHECKINS TABLE (Registro de visitas)
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  esencias_awarded INTEGER NOT NULL DEFAULT 0,
  location GEOGRAPHY(POINT, 4326), -- Ubicación del usuario al hacer check-in
  verified BOOLEAN NOT NULL DEFAULT false, -- Verificado por proximidad
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_venue_checkins_user ON venue_checkins(user_id, checked_in_at DESC);
CREATE INDEX idx_venue_checkins_venue ON venue_checkins(venue_id, checked_in_at DESC);

-- Prevenir check-ins duplicados: máximo 1 por venue por día por usuario
CREATE UNIQUE INDEX idx_venue_checkins_daily
ON venue_checkins(user_id, venue_id, (checked_in_at::date));

-- RLS: Usuarios ven solo sus check-ins
ALTER TABLE venue_checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins"
ON venue_checkins FOR SELECT
USING (user_id = auth.uid());

-- ============================================================
-- VENUE_REVIEWS TABLE (Reseñas de venues)
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  sensory_rating INTEGER CHECK (sensory_rating BETWEEN 1 AND 5), -- Calificación sensorial del usuario
  comment TEXT CHECK (char_length(comment) <= 500),
  tags TEXT[] DEFAULT '{}', -- ['silencioso', 'buena_luz', 'espacioso', 'amigable']
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, venue_id) -- Un review por usuario por venue
);

CREATE INDEX idx_venue_reviews_venue ON venue_reviews(venue_id);
CREATE INDEX idx_venue_reviews_user ON venue_reviews(user_id);

CREATE TRIGGER venue_reviews_updated_at
BEFORE UPDATE ON venue_reviews
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- RLS: Todos ven reviews, usuarios solo editan las suyas
ALTER TABLE venue_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view reviews"
ON venue_reviews FOR SELECT
USING (true);

CREATE POLICY "Users can insert own reviews"
ON venue_reviews FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own reviews"
ON venue_reviews FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- VENUE_FAVORITES TABLE (Venues favoritos del usuario)
-- ============================================================

CREATE TABLE IF NOT EXISTS venue_favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, venue_id)
);

ALTER TABLE venue_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own favorites"
ON venue_favorites FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can manage own favorites"
ON venue_favorites FOR ALL
USING (user_id = auth.uid());

-- Enable PostGIS for geolocation queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable trigram for fuzzy search (SpIn autocomplete)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Diagnosis enum
DO $$ BEGIN
  CREATE TYPE diagnosis_type AS ENUM (
    'TEA', 'TDAH', 'AACC', 'DISLEXIA', 'AUTOIDENTIFIED', 'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  auth_provider TEXT NOT NULL CHECK (auth_provider IN ('google', 'apple')),
  auth_id       TEXT UNIQUE NOT NULL,  -- ID del proveedor (Google/Apple sub)
  username      TEXT UNIQUE,
  display_name  TEXT,
  birth_date    DATE,
  -- is_teen se calcula en backend (AGE() no es immutable en PostgreSQL)
  is_teen       BOOLEAN DEFAULT false,
  location      GEOGRAPHY(POINT, 4326),
  avatar_url    TEXT,
  msn_status    TEXT CHECK (char_length(msn_status) <= 160),
  energy_level  SMALLINT DEFAULT 2 CHECK (energy_level BETWEEN 1 AND 3),
  notif_level   SMALLINT DEFAULT 2 CHECK (notif_level BETWEEN 1 AND 3),
  notif_time    TIME,
  is_active     BOOLEAN DEFAULT true,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- User diagnoses (many-to-many: user can have multiple diagnoses)
CREATE TABLE IF NOT EXISTS user_diagnoses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  diagnosis   diagnosis_type NOT NULL,
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, diagnosis)
);

-- User preferences (the "Manual de Usuario")
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  communication_style   TEXT,
  understands_sarcasm   BOOLEAN DEFAULT true,
  preferred_contact     TEXT CHECK (preferred_contact IN ('text', 'voice', 'video', 'in_person')),
  response_time_notes   TEXT,
  sensory_notes         TEXT,
  other_notes           TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- User streaks
CREATE TABLE IF NOT EXISTS user_streaks (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak   INTEGER DEFAULT 0,
  longest_streak   INTEGER DEFAULT 0,
  last_login_date  DATE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_auth ON users(auth_provider, auth_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_location ON users USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_user_diagnoses_user ON user_diagnoses(user_id);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_diagnoses ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_streaks ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER user_preferences_updated_at
  BEFORE UPDATE ON user_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

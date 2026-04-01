# Database Schema — IAM

Base de datos: PostgreSQL (Supabase) con extensión PostGIS habilitada.

---

## Tablas

### users
```sql
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  display_name  TEXT,
  birth_date    DATE NOT NULL,
  is_teen       BOOLEAN GENERATED ALWAYS AS (
                  EXTRACT(YEAR FROM AGE(birth_date)) BETWEEN 16 AND 17
                ) STORED,
  location      GEOGRAPHY(POINT, 4326),  -- PostGIS
  avatar_url    TEXT,
  msn_status    TEXT CHECK (char_length(msn_status) <= 160),
  energy_level  SMALLINT DEFAULT 2 CHECK (energy_level BETWEEN 1 AND 3),
  notif_level   SMALLINT DEFAULT 2 CHECK (notif_level BETWEEN 1 AND 3),
  notif_time    TIME,  -- Para nivel 1 (batch diario)
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);
```

### user_diagnoses
```sql
CREATE TYPE diagnosis_type AS ENUM (
  'TEA', 'TDAH', 'AACC', 'DISLEXIA', 'AUTOIDENTIFIED', 'OTHER'
);

CREATE TABLE user_diagnoses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  diagnosis   diagnosis_type NOT NULL,
  is_primary  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, diagnosis)
);
```

### user_preferences (Manual de Usuario)
```sql
CREATE TABLE user_preferences (
  user_id               UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  communication_style   TEXT,
  understands_sarcasm   BOOLEAN DEFAULT true,
  preferred_contact     TEXT CHECK (preferred_contact IN ('text', 'voice', 'video', 'in_person')),
  response_time_notes   TEXT,
  sensory_notes         TEXT,
  other_notes           TEXT,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

### spin_categories
```sql
CREATE TABLE spin_categories (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug  TEXT UNIQUE NOT NULL,  -- 'entertainment', 'science', etc.
  icon  TEXT
);

-- Tabla de traducciones de categorías
CREATE TABLE spin_category_translations (
  category_id  UUID REFERENCES spin_categories(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL,  -- 'es', 'en', 'pt'
  name         TEXT NOT NULL,
  PRIMARY KEY (category_id, lang)
);
```

### spin_tags
```sql
CREATE TABLE spin_tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,  -- normalizado: lowercase, sin espacios especiales
  display_name  TEXT NOT NULL,
  category_id   UUID REFERENCES spin_categories(id),
  usage_count   INTEGER DEFAULT 0,
  is_curated    BOOLEAN DEFAULT false,  -- true = viene de la lista oficial
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spin_tags_slug ON spin_tags USING gin(slug gin_trgm_ops);
CREATE INDEX idx_spin_tags_category ON spin_tags(category_id);
```

### user_spin
```sql
CREATE TABLE user_spin (
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  spin_tag_id UUID REFERENCES spin_tags(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, spin_tag_id)
);
-- El límite de 5 por categoría y 20 total se valida en backend
```

### swipes
```sql
CREATE TABLE swipes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  swiped_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  direction   TEXT CHECK (direction IN ('like', 'pass')) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(swiper_id, swiped_id)
);
```

### matches
```sql
CREATE TYPE match_status AS ENUM ('active', 'unmatched');

CREATE TABLE matches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  user_b_id   UUID REFERENCES users(id) ON DELETE CASCADE,
  status      match_status DEFAULT 'active',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  CHECK (user_a_id < user_b_id)  -- evita duplicados invertidos
);
```

### messages
```sql
CREATE TABLE messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   UUID REFERENCES matches(id) ON DELETE CASCADE,
  sender_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL CHECK (char_length(content) <= 10000),
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_match ON messages(match_id, created_at DESC);
```

### irl_meetings
```sql
CREATE TABLE irl_meetings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID REFERENCES matches(id) ON DELETE CASCADE,
  confirmed_by_a    BOOLEAN DEFAULT false,
  confirmed_by_b    BOOLEAN DEFAULT false,
  venue_id          UUID REFERENCES venues(id),
  met_at            TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
```

### user_streaks
```sql
CREATE TABLE user_streaks (
  user_id          UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  current_streak   INTEGER DEFAULT 0,
  longest_streak   INTEGER DEFAULT 0,
  last_login_date  DATE
);
```

### esencia_types
```sql
CREATE TYPE esencia_rarity AS ENUM ('comun', 'raro', 'epico', 'legendario', 'premium');
CREATE TYPE esencia_category AS ENUM ('social', 'hito', 'temporal', 'legado', 'exclusivo');

CREATE TABLE esencia_types (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  category      esencia_category NOT NULL,
  rarity        esencia_rarity NOT NULL,
  visual_data   JSONB NOT NULL,  -- { effect, color, animation }
  unlock_rule   JSONB,           -- { type: 'streak', value: 100 }
  is_active     BOOLEAN DEFAULT true
);
```

### user_esencia_inventory
```sql
CREATE TABLE user_esencia_inventory (
  user_id        UUID REFERENCES users(id) ON DELETE CASCADE,
  esencia_type_id UUID REFERENCES esencia_types(id),
  quantity       INTEGER DEFAULT 0 CHECK (quantity >= 0),
  PRIMARY KEY (user_id, esencia_type_id)
);
```

### esencia_transactions
```sql
CREATE TABLE esencia_transactions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID REFERENCES users(id),
  receiver_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  esencia_type_id UUID REFERENCES esencia_types(id),
  sent_at         TIMESTAMPTZ DEFAULT NOW(),
  CHECK (sender_id != receiver_id)
);
```

### user_displayed_esencias
```sql
CREATE TABLE user_displayed_esencias (
  user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
  esencia_type_id UUID REFERENCES esencia_types(id),
  slot            SMALLINT CHECK (slot BETWEEN 1 AND 5),
  PRIMARY KEY (user_id, slot)
);
```

### venues
```sql
CREATE TABLE venues (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  description       TEXT,
  location          GEOGRAPHY(POINT, 4326) NOT NULL,
  address           TEXT NOT NULL,
  sensory_level     SMALLINT CHECK (sensory_level BETWEEN 1 AND 5),  -- 1=muy silencioso
  category          TEXT CHECK (category IN ('cafe', 'library', 'park', 'restaurant', 'other')),
  subscription_tier TEXT DEFAULT 'basic',
  is_active         BOOLEAN DEFAULT true,
  owner_user_id     UUID,  -- cuenta de la empresa en venue app
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_venues_location ON venues USING GIST(location);
```

### venue_rewards
```sql
CREATE TABLE venue_rewards (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id             UUID REFERENCES venues(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  description          TEXT,
  required_streak      INTEGER,       -- días de racha necesarios
  required_achievement TEXT,          -- slug del logro requerido
  is_active            BOOLEAN DEFAULT true,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);
```

### reward_redemptions
```sql
CREATE TABLE reward_redemptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
  reward_id    UUID REFERENCES venue_rewards(id),
  venue_id     UUID REFERENCES venues(id),
  code         TEXT UNIQUE NOT NULL,  -- alfanumérico único
  qr_data      TEXT NOT NULL,
  redeemed_at  TIMESTAMPTZ,           -- NULL = pendiente
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### blocks
```sql
CREATE TABLE blocks (
  blocker_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id  UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);
```

### reports
```sql
CREATE TABLE reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID REFERENCES users(id),
  reported_id  UUID REFERENCES users(id),
  reason       TEXT NOT NULL,
  details      TEXT,
  status       TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
```

### feature_flags
```sql
CREATE TABLE feature_flags (
  key          TEXT PRIMARY KEY,
  enabled      BOOLEAN DEFAULT false,
  description  TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seeds iniciales
INSERT INTO feature_flags VALUES
  ('teen_mode_enabled', false, 'Habilita el segmento 16-17 años'),
  ('venue_rewards_enabled', true, 'Sistema de recompensas en venues'),
  ('body_doubling_enabled', false, 'Sesiones de Body Doubling (futuro)');
```

---

## Row Level Security (RLS) — Políticas Clave

```sql
-- Users: cada usuario solo ve/edita su propio perfil
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self ON users
  USING (auth.uid() = id);

-- Messages: solo participantes del match pueden ver mensajes
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY messages_participants ON messages
  USING (
    match_id IN (
      SELECT id FROM matches
      WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
  );
```

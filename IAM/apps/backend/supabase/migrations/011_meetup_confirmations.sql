-- ============================================================
-- Stage 9: Meetup Confirmations
-- Confirmación de encuentro presencial entre usuarios matched
-- ============================================================

-- Tabla de confirmaciones de meetup
CREATE TABLE meetup_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,

  -- Confirmaciones individuales
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_a_confirmed BOOLEAN DEFAULT FALSE,
  user_b_confirmed BOOLEAN DEFAULT FALSE,
  user_a_confirmed_at TIMESTAMPTZ,
  user_b_confirmed_at TIMESTAMPTZ,

  -- Ubicación de confirmación (opcional, para verificación)
  user_a_location GEOGRAPHY(POINT, 4326),
  user_b_location GEOGRAPHY(POINT, 4326),

  -- Estado general
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'expired', 'disputed')),

  -- Recompensa
  esencias_awarded INTEGER DEFAULT 0,

  -- Ventana de confirmación (48 horas desde primera confirmación)
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Un solo meetup activo por match
  CONSTRAINT unique_active_meetup UNIQUE (match_id, status),
  CONSTRAINT users_match CHECK (user_a_id <> user_b_id)
);

-- Índices
CREATE INDEX idx_meetup_user_a ON meetup_confirmations(user_a_id, status);
CREATE INDEX idx_meetup_user_b ON meetup_confirmations(user_b_id, status);
CREATE INDEX idx_meetup_match ON meetup_confirmations(match_id, status);
CREATE INDEX idx_meetup_expires ON meetup_confirmations(expires_at) WHERE status = 'pending';

-- Trigger auto-update updated_at
CREATE TRIGGER set_meetup_updated_at
  BEFORE UPDATE ON meetup_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE meetup_confirmations ENABLE ROW LEVEL SECURITY;

-- Los usuarios pueden ver sus propias confirmaciones
CREATE POLICY meetup_select_own ON meetup_confirmations
  FOR SELECT USING (
    auth.uid() = user_a_id OR auth.uid() = user_b_id
  );

-- Los usuarios pueden insertar si son parte del match
CREATE POLICY meetup_insert_own ON meetup_confirmations
  FOR INSERT WITH CHECK (
    auth.uid() = user_a_id OR auth.uid() = user_b_id
  );

-- Los usuarios pueden actualizar sus propias confirmaciones
CREATE POLICY meetup_update_own ON meetup_confirmations
  FOR UPDATE USING (
    auth.uid() = user_a_id OR auth.uid() = user_b_id
  );

-- Tabla de historial de meetups (para estadísticas)
CREATE TABLE meetup_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id UUID NOT NULL REFERENCES meetup_confirmations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('initiated', 'confirmed', 'expired', 'disputed')),
  location GEOGRAPHY(POINT, 4326),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_meetup_history_user ON meetup_history(user_id, created_at DESC);
CREATE INDEX idx_meetup_history_meetup ON meetup_history(meetup_id);

ALTER TABLE meetup_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY meetup_history_select_own ON meetup_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY meetup_history_insert ON meetup_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Feature flag
UPDATE feature_flags SET is_enabled = true, updated_at = NOW()
  WHERE flag_name = 'meetup_confirmations_enabled';

INSERT INTO feature_flags (flag_name, is_enabled, description)
VALUES ('meetup_confirmations_enabled', true, 'Confirmación de encuentros presenciales entre matches')
ON CONFLICT (flag_name) DO UPDATE SET is_enabled = true, updated_at = NOW();

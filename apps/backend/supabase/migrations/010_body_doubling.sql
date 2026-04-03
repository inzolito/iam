-- Stage 8: Body Doubling
-- Sesiones de acompañamiento virtual para concentración y motivación

-- ============================================================
-- BODY_DOUBLING_SESSIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS body_doubling_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  description TEXT CHECK (char_length(description) <= 300),
  activity_type TEXT NOT NULL CHECK (activity_type IN (
    'estudio', 'trabajo', 'lectura', 'arte', 'ejercicio', 'limpieza',
    'cocina', 'meditacion', 'programacion', 'otro'
  )),
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes BETWEEN 15 AND 480), -- 15min a 8h
  max_participants INTEGER NOT NULL DEFAULT 5 CHECK (max_participants BETWEEN 2 AND 20),
  is_public BOOLEAN NOT NULL DEFAULT true, -- false = solo matches/invitados
  status TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN (
    'waiting',   -- Esperando participantes
    'active',    -- Sesión en curso
    'completed', -- Finalizada exitosamente
    'cancelled'  -- Cancelada
  )),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ, -- NULL = empieza cuando se una alguien
  esencias_reward INTEGER NOT NULL DEFAULT 20, -- Reward por completar
  venue_id UUID REFERENCES venues(id) ON DELETE SET NULL, -- Opcional: sesión en un venue
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_bd_sessions_host ON body_doubling_sessions(host_id);
CREATE INDEX idx_bd_sessions_status ON body_doubling_sessions(status) WHERE status IN ('waiting', 'active');
CREATE INDEX idx_bd_sessions_activity ON body_doubling_sessions(activity_type);
CREATE INDEX idx_bd_sessions_public ON body_doubling_sessions(is_public) WHERE is_public = true AND status = 'waiting';

CREATE TRIGGER bd_sessions_updated_at
BEFORE UPDATE ON body_doubling_sessions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- RLS
ALTER TABLE body_doubling_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view public sessions"
ON body_doubling_sessions FOR SELECT
USING (is_public = true OR host_id = auth.uid());

CREATE POLICY "Users can create own sessions"
ON body_doubling_sessions FOR INSERT
WITH CHECK (host_id = auth.uid());

CREATE POLICY "Hosts can update own sessions"
ON body_doubling_sessions FOR UPDATE
USING (host_id = auth.uid());

-- ============================================================
-- BODY_DOUBLING_PARTICIPANTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS body_doubling_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES body_doubling_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN (
    'joined',    -- Unido a la sesión
    'active',    -- Participando activamente
    'completed', -- Completó la sesión
    'left'       -- Se fue antes de terminar
  )),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  left_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  esencias_awarded INTEGER DEFAULT 0,
  UNIQUE(session_id, user_id)
);

CREATE INDEX idx_bd_participants_session ON body_doubling_participants(session_id);
CREATE INDEX idx_bd_participants_user ON body_doubling_participants(user_id);
CREATE INDEX idx_bd_participants_active ON body_doubling_participants(user_id, status) WHERE status IN ('joined', 'active');

-- RLS
ALTER TABLE body_doubling_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view session participants"
ON body_doubling_participants FOR SELECT
USING (true); -- Visible para todos en la sesión

CREATE POLICY "Users can join sessions"
ON body_doubling_participants FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own participation"
ON body_doubling_participants FOR UPDATE
USING (user_id = auth.uid());

-- ============================================================
-- UPDATE FEATURE FLAG
-- ============================================================

UPDATE feature_flags
SET enabled = true, updated_at = NOW()
WHERE key = 'body_doubling_enabled';

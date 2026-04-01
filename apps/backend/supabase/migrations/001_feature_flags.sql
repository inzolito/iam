-- Feature Flags table — controls feature toggles without deploy
CREATE TABLE IF NOT EXISTS feature_flags (
  key          TEXT PRIMARY KEY,
  enabled      BOOLEAN DEFAULT false,
  description  TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Initial seeds
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('teen_mode_enabled', false, 'Habilita el segmento 16-17 años'),
  ('venue_rewards_enabled', true, 'Sistema de recompensas en venues'),
  ('body_doubling_enabled', false, 'Sesiones de Body Doubling (futuro)')
ON CONFLICT (key) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read feature flags (they're not sensitive)
CREATE POLICY "feature_flags_read_all" ON feature_flags
  FOR SELECT USING (true);

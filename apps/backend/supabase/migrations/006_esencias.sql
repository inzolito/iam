-- Stage 6: Esencias (Token Economy)
-- Create tables for user balance, transactions, unlock rules, and user unlocks

-- ============================================================
-- USER_BALANCE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS user_balance (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  esencias_balance INTEGER NOT NULL DEFAULT 0 CHECK (esencias_balance >= 0),
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER user_balance_updated_at
BEFORE UPDATE ON user_balance
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- RLS: Users can only view/update own balance
ALTER TABLE user_balance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own balance"
ON user_balance FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can update own balance (via backend only)"
ON user_balance FOR UPDATE
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ============================================================
-- ESENCIAS_TRANSACTIONS TABLE (Ledger)
-- ============================================================

CREATE TABLE IF NOT EXISTS esencias_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL for system grants
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL, -- 'login_bonus', 'match_creation', 'user_transfer', 'admin_grant', 'unlock_deduction'
  message TEXT, -- Custom message for user transfers
  type TEXT NOT NULL CHECK (type IN ('grant', 'transfer', 'deduction')), -- Transaction type
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_esencias_transactions_to_user_id_created
ON esencias_transactions(to_user_id, created_at DESC);

CREATE INDEX idx_esencias_transactions_from_user_id_created
ON esencias_transactions(from_user_id, created_at DESC) WHERE from_user_id IS NOT NULL;

CREATE INDEX idx_esencias_transactions_reason
ON esencias_transactions(reason);

-- RLS: Users can view own transactions
ALTER TABLE esencias_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions (from/to)"
ON esencias_transactions FOR SELECT
USING (
  to_user_id = auth.uid() OR
  from_user_id = auth.uid() OR
  from_user_id IS NULL -- System transactions visible to all
);

-- ============================================================
-- UNLOCK_RULES TABLE (Feature configuration)
-- ============================================================

CREATE TABLE IF NOT EXISTS unlock_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnosis TEXT NOT NULL CHECK (diagnosis IN ('TEA', 'TDAH', 'AACC', 'DISLEXIA')),
  feature_key TEXT NOT NULL, -- slug format: sensory_dashboard, energy_boost, etc.
  feature_name TEXT NOT NULL, -- Display name
  description TEXT NOT NULL, -- What this feature enables
  required_esencias INTEGER NOT NULL CHECK (required_esencias > 0),
  category TEXT NOT NULL CHECK (category IN ('theme', 'accessibility', 'dashboard')),
  ui_settings JSONB NOT NULL DEFAULT '{}'::jsonb, -- Feature-specific config
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(diagnosis, feature_key)
);

CREATE INDEX idx_unlock_rules_diagnosis ON unlock_rules(diagnosis);

-- RLS: Public read, no write
ALTER TABLE unlock_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view unlock rules"
ON unlock_rules FOR SELECT
USING (true);

-- ============================================================
-- USER_UNLOCKS TABLE (Tracks which features user has unlocked)
-- ============================================================

CREATE TABLE IF NOT EXISTS user_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  unlock_id UUID NOT NULL REFERENCES unlock_rules(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(user_id, unlock_id)
);

CREATE INDEX idx_user_unlocks_user_id ON user_unlocks(user_id);
CREATE INDEX idx_user_unlocks_active ON user_unlocks(user_id) WHERE is_active = true;

-- RLS: Users can only view own unlocks
ALTER TABLE user_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own unlocks"
ON user_unlocks FOR SELECT
USING (user_id = auth.uid());

-- ============================================================
-- INITIALIZE USER_BALANCE FOR EXISTING USERS
-- ============================================================

INSERT INTO user_balance (user_id, esencias_balance, total_earned, total_spent, updated_at)
SELECT id, 0, 0, 0, NOW()
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM user_balance WHERE user_id = u.id)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================
-- TRIGGER: Auto-create balance entry for new users
-- ============================================================

CREATE OR REPLACE FUNCTION create_balance_for_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_balance (user_id, esencias_balance, total_earned, total_spent)
  VALUES (NEW.id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_create_balance_for_new_user ON users;
CREATE TRIGGER trigger_create_balance_for_new_user
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION create_balance_for_new_user();

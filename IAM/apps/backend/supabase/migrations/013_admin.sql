-- ============================================================
-- Stage 11: Admin Dashboard
-- Panel de administración y moderación
-- ============================================================

-- Tabla de roles de admin
CREATE TABLE admin_roles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'moderator'
    CHECK (role IN ('super_admin', 'admin', 'moderator')),
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_admin_roles_active ON admin_roles(role) WHERE is_active = true;

-- Tabla de acciones de moderación
CREATE TABLE moderation_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id),
  target_user_id UUID REFERENCES users(id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'user_ban',
    'user_unban',
    'user_warn',
    'user_suspend',
    'content_remove',
    'report_resolve',
    'report_dismiss',
    'esencias_grant',
    'esencias_deduct',
    'system_announcement'
  )),
  reason TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mod_actions_admin ON moderation_actions(admin_id, created_at DESC);
CREATE INDEX idx_mod_actions_target ON moderation_actions(target_user_id, created_at DESC);
CREATE INDEX idx_mod_actions_type ON moderation_actions(action_type, created_at DESC);

-- Tabla de reportes extendida (estadísticas de moderación)
CREATE TABLE moderation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID REFERENCES reports(id),
  assigned_to UUID REFERENCES users(id),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'resolved', 'dismissed')),
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mod_queue_status ON moderation_queue(status, priority, created_at);
CREATE INDEX idx_mod_queue_assigned ON moderation_queue(assigned_to) WHERE status = 'in_review';

CREATE TRIGGER set_mod_queue_updated_at
  BEFORE UPDATE ON moderation_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE moderation_queue ENABLE ROW LEVEL SECURITY;

-- Solo admins pueden ver roles
CREATE POLICY admin_roles_select ON admin_roles
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM admin_roles WHERE is_active = true)
  );

-- Solo super_admin puede modificar roles
CREATE POLICY admin_roles_manage ON admin_roles
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM admin_roles WHERE role = 'super_admin' AND is_active = true)
  );

-- Admins pueden ver y crear acciones de moderación
CREATE POLICY mod_actions_select ON moderation_actions
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM admin_roles WHERE is_active = true)
  );

CREATE POLICY mod_actions_insert ON moderation_actions
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM admin_roles WHERE is_active = true)
  );

-- Admins pueden gestionar la cola de moderación
CREATE POLICY mod_queue_select ON moderation_queue
  FOR SELECT USING (
    auth.uid() IN (SELECT user_id FROM admin_roles WHERE is_active = true)
  );

CREATE POLICY mod_queue_manage ON moderation_queue
  FOR ALL USING (
    auth.uid() IN (SELECT user_id FROM admin_roles WHERE is_active = true)
  );

-- Feature flag
INSERT INTO feature_flags (flag_name, is_enabled, description)
VALUES ('admin_dashboard_enabled', true, 'Panel de administración y moderación')
ON CONFLICT (flag_name) DO UPDATE SET is_enabled = true, updated_at = NOW();

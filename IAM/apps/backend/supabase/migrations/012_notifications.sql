-- ============================================================
-- Stage 10: Notifications System
-- Sistema de notificaciones in-app y push
-- ============================================================

-- Tabla de tokens de dispositivos para push notifications
CREATE TABLE user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, device_token)
);

CREATE INDEX idx_devices_user ON user_devices(user_id) WHERE is_active = true;

-- Tabla de notificaciones in-app
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tipo y contenido
  type TEXT NOT NULL CHECK (type IN (
    'match_new',           -- Nuevo match
    'message_new',         -- Nuevo mensaje
    'meetup_initiated',    -- Alguien inició un meetup contigo
    'meetup_confirmed',    -- Meetup confirmado
    'meetup_expired',      -- Meetup expirado
    'body_doubling_invite',-- Invitación a body doubling
    'body_doubling_start', -- Sesión body doubling iniciada
    'esencias_received',   -- Esencias recibidas (transfer)
    'esencias_earned',     -- Esencias ganadas (reward)
    'unlock_available',    -- Tienes suficientes Esencias para un unlock
    'streak_milestone',    -- Hito de racha de login
    'system'               -- Notificación del sistema
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,

  -- Datos adicionales para navegación
  data JSONB DEFAULT '{}',

  -- Estado
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Push delivery
  push_sent BOOLEAN DEFAULT FALSE,
  push_sent_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_notifications_user_all ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_type ON notifications(type, created_at DESC);

-- Preferencias de notificaciones por usuario
CREATE TABLE notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Push notifications por tipo
  push_match_new BOOLEAN DEFAULT TRUE,
  push_message_new BOOLEAN DEFAULT TRUE,
  push_meetup BOOLEAN DEFAULT TRUE,
  push_body_doubling BOOLEAN DEFAULT TRUE,
  push_esencias BOOLEAN DEFAULT TRUE,
  push_streak BOOLEAN DEFAULT TRUE,
  push_system BOOLEAN DEFAULT TRUE,

  -- In-app notifications (siempre activas, pero el usuario puede silenciar)
  in_app_enabled BOOLEAN DEFAULT TRUE,

  -- Horario de no molestar
  dnd_enabled BOOLEAN DEFAULT FALSE,
  dnd_start_hour INTEGER DEFAULT 22, -- 10 PM
  dnd_end_hour INTEGER DEFAULT 8,    -- 8 AM

  -- Sonido y vibración
  sound_enabled BOOLEAN DEFAULT TRUE,
  vibration_enabled BOOLEAN DEFAULT TRUE,

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger auto-update updated_at
CREATE TRIGGER set_devices_updated_at
  BEFORE UPDATE ON user_devices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_notif_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-crear preferencias para nuevos usuarios
CREATE OR REPLACE FUNCTION create_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_create_notif_prefs
  AFTER INSERT ON users
  FOR EACH ROW
  EXECUTE FUNCTION create_notification_preferences();

-- RLS
ALTER TABLE user_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

-- Devices: solo propios
CREATE POLICY devices_select_own ON user_devices
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY devices_insert_own ON user_devices
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY devices_update_own ON user_devices
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY devices_delete_own ON user_devices
  FOR DELETE USING (auth.uid() = user_id);

-- Notifications: solo propias
CREATE POLICY notif_select_own ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY notif_update_own ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Preferences: solo propias
CREATE POLICY prefs_select_own ON notification_preferences
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY prefs_update_own ON notification_preferences
  FOR UPDATE USING (auth.uid() = user_id);

-- Feature flag
INSERT INTO feature_flags (flag_name, is_enabled, description)
VALUES ('notifications_enabled', true, 'Sistema de notificaciones push e in-app')
ON CONFLICT (flag_name) DO UPDATE SET is_enabled = true, updated_at = NOW();

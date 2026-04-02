-- Migration 005: Messages / Chat system
-- Messages between matched users, with real-time via Supabase

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ,
  CONSTRAINT content_length CHECK (char_length(content) BETWEEN 1 AND 10000)
);

CREATE INDEX idx_messages_match ON messages(match_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_unread ON messages(match_id, read_at) WHERE read_at IS NULL;

-- RLS: only match participants can read/write messages
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY messages_select ON messages
  FOR SELECT USING (
    match_id IN (
      SELECT id FROM matches
      WHERE user_a_id = auth.uid() OR user_b_id = auth.uid()
    )
  );

CREATE POLICY messages_insert ON messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND match_id IN (
      SELECT id FROM matches
      WHERE (user_a_id = auth.uid() OR user_b_id = auth.uid())
        AND status = 'active'
    )
  );

-- Enable Supabase Realtime on messages table
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

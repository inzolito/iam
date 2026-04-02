-- Migration 004: Matching system (feed, swipes, matches, blocks, reports)
-- PostGIS queries for proximity, teen isolation, blocking

-- Swipes table: user A swiped on user B
CREATE TABLE swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  swiper_id UUID REFERENCES users(id) ON DELETE CASCADE,
  swiped_id UUID REFERENCES users(id) ON DELETE CASCADE,
  direction TEXT NOT NULL, -- 'like' or 'pass'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(swiper_id, swiped_id),
  CONSTRAINT valid_direction CHECK (direction IN ('like', 'pass'))
);

CREATE INDEX idx_swipes_swiper ON swipes(swiper_id);
CREATE INDEX idx_swipes_swiped ON swipes(swiped_id);

-- Matches: mutual likes (or one-way like if other hasn't swiped yet)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_b_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'blocked', 'archived'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_a_id, user_b_id),
  CONSTRAINT users_different CHECK (user_a_id < user_b_id)
);

CREATE INDEX idx_matches_user_a ON matches(user_a_id);
CREATE INDEX idx_matches_user_b ON matches(user_b_id);
CREATE INDEX idx_matches_active ON matches(status) WHERE status = 'active';

-- Blocks: user A blocks user B
CREATE TABLE blocks (
  blocker_id UUID REFERENCES users(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (blocker_id, blocked_id)
);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- Reports: user A reports user B
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open', 'reviewed', 'resolved', 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_reports_reporter ON reports(reporter_id);
CREATE INDEX idx_reports_reported ON reports(reported_id);
CREATE INDEX idx_reports_status ON reports(status);

-- RLS policies
ALTER TABLE swipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY swipes_self ON swipes
  FOR INSERT WITH CHECK (swiper_id = auth.uid());

CREATE POLICY swipes_select ON swipes
  FOR SELECT USING (
    swiper_id = auth.uid() OR swiped_id = auth.uid()
  );

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY matches_participants ON matches
  FOR SELECT USING (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
  );

CREATE POLICY matches_create ON matches
  FOR INSERT WITH CHECK (
    user_a_id = auth.uid() OR user_b_id = auth.uid()
  );

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocks_self ON blocks
  FOR INSERT WITH CHECK (blocker_id = auth.uid());

CREATE POLICY blocks_select ON blocks
  FOR SELECT USING (
    blocker_id = auth.uid() OR blocked_id = auth.uid()
  );

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_self ON reports
  FOR INSERT WITH CHECK (reporter_id = auth.uid());

-- Trigger: auto-update matches.updated_at
CREATE OR REPLACE FUNCTION update_matches_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER matches_update_timestamp
  BEFORE UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_matches_timestamp();

-- Helper: check if users have mutual match
CREATE OR REPLACE FUNCTION has_mutual_match(user1 UUID, user2 UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS(
    SELECT 1 FROM swipes
    WHERE (swiper_id = user1 AND swiped_id = user2 AND direction = 'like')
      AND EXISTS(
        SELECT 1 FROM swipes s2
        WHERE s2.swiper_id = user2 AND s2.swiped_id = user1 AND s2.direction = 'like'
      )
  );
END;
$$ LANGUAGE plpgsql;

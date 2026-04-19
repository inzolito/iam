-- F12: Photos & Storage
-- User profile photos (avatars handled via users.avatar_url, galleries via this table)

-- Create user_photos table for gallery photos
CREATE TABLE IF NOT EXISTS user_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,           -- e.g., "gallery/user-123/photo-abc.jpg"
  public_url TEXT NOT NULL,              -- generated from Supabase Storage
  file_size INTEGER NOT NULL,            -- bytes
  mime_type TEXT NOT NULL,               -- image/jpeg, image/png
  position INTEGER NOT NULL DEFAULT 0,   -- order in gallery (0-4)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, position)              -- One photo per position
);

-- Index for fast lookups by user
CREATE INDEX idx_user_photos_user_id ON user_photos(user_id);

-- RLS: Users can read all photos, write/delete only their own
ALTER TABLE user_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Photos are publicly readable"
  ON user_photos FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own photos"
  ON user_photos FOR INSERT
  WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete own photos"
  ON user_photos FOR DELETE
  USING (auth.uid()::text = user_id::text);

-- Note: Admin delete policy would require is_admin() function
-- For now, delete is only via user's own photos

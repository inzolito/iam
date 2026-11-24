-- Género del usuario, para filtro de descubrimiento en el feed.
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT
  CHECK (gender IN ('male', 'female', 'other') OR gender IS NULL);

CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);

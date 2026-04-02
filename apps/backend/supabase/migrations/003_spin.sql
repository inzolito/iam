-- Migration 003: SpIn (Special Interests) tables
-- Categories, tags with trigram search, user_spin with limits enforced in backend

CREATE TABLE spin_categories (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug  TEXT UNIQUE NOT NULL,
  icon  TEXT
);

CREATE TABLE spin_category_translations (
  category_id  UUID REFERENCES spin_categories(id) ON DELETE CASCADE,
  lang         TEXT NOT NULL,
  name         TEXT NOT NULL,
  PRIMARY KEY (category_id, lang)
);

CREATE TABLE spin_tags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  category_id   UUID REFERENCES spin_categories(id),
  usage_count   INTEGER DEFAULT 0,
  is_curated    BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spin_tags_slug ON spin_tags USING gin(slug gin_trgm_ops);
CREATE INDEX idx_spin_tags_category ON spin_tags(category_id);
CREATE INDEX idx_spin_tags_curated ON spin_tags(is_curated) WHERE is_curated = true;

CREATE TABLE user_spin (
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  spin_tag_id UUID REFERENCES spin_tags(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, spin_tag_id)
);

-- RLS
ALTER TABLE spin_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY spin_categories_read ON spin_categories FOR SELECT USING (true);

ALTER TABLE spin_category_translations ENABLE ROW LEVEL SECURITY;
CREATE POLICY spin_cat_trans_read ON spin_category_translations FOR SELECT USING (true);

ALTER TABLE spin_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY spin_tags_read ON spin_tags FOR SELECT USING (true);

ALTER TABLE user_spin ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_spin_self ON user_spin
  USING (user_id = auth.uid());

-- Seed categories
INSERT INTO spin_categories (slug, icon) VALUES
  ('entertainment', '🎬'),
  ('science', '🔬'),
  ('technology', '💻'),
  ('art', '🎨'),
  ('music', '🎵'),
  ('sports', '⚽'),
  ('nature', '🌿'),
  ('gaming', '🎮'),
  ('literature', '📚'),
  ('food', '🍳'),
  ('history', '🏛️'),
  ('crafts', '🧶');

-- Seed translations (es + en)
INSERT INTO spin_category_translations (category_id, lang, name)
SELECT id, 'es', CASE slug
  WHEN 'entertainment' THEN 'Entretenimiento'
  WHEN 'science' THEN 'Ciencia'
  WHEN 'technology' THEN 'Tecnología'
  WHEN 'art' THEN 'Arte'
  WHEN 'music' THEN 'Música'
  WHEN 'sports' THEN 'Deportes'
  WHEN 'nature' THEN 'Naturaleza'
  WHEN 'gaming' THEN 'Videojuegos'
  WHEN 'literature' THEN 'Literatura'
  WHEN 'food' THEN 'Gastronomía'
  WHEN 'history' THEN 'Historia'
  WHEN 'crafts' THEN 'Manualidades'
END
FROM spin_categories;

INSERT INTO spin_category_translations (category_id, lang, name)
SELECT id, 'en', CASE slug
  WHEN 'entertainment' THEN 'Entertainment'
  WHEN 'science' THEN 'Science'
  WHEN 'technology' THEN 'Technology'
  WHEN 'art' THEN 'Art'
  WHEN 'music' THEN 'Music'
  WHEN 'sports' THEN 'Sports'
  WHEN 'nature' THEN 'Nature'
  WHEN 'gaming' THEN 'Gaming'
  WHEN 'literature' THEN 'Literature'
  WHEN 'food' THEN 'Food'
  WHEN 'history' THEN 'History'
  WHEN 'crafts' THEN 'Crafts'
END
FROM spin_categories;

-- Seed curated tags (a selection per category)
DO $$
DECLARE
  cat_id UUID;
BEGIN
  -- Entertainment
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'entertainment';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('rick-and-morty', 'Rick and Morty', cat_id, true),
    ('star-wars', 'Star Wars', cat_id, true),
    ('anime', 'Anime', cat_id, true),
    ('marvel', 'Marvel', cat_id, true),
    ('studio-ghibli', 'Studio Ghibli', cat_id, true),
    ('doctor-who', 'Doctor Who', cat_id, true),
    ('harry-potter', 'Harry Potter', cat_id, true),
    ('the-office', 'The Office', cat_id, true);

  -- Science
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'science';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('astronomy', 'Astronomía', cat_id, true),
    ('physics', 'Física', cat_id, true),
    ('biology', 'Biología', cat_id, true),
    ('chemistry', 'Química', cat_id, true),
    ('dinosaurs', 'Dinosaurios', cat_id, true),
    ('space-exploration', 'Exploración espacial', cat_id, true),
    ('neuroscience', 'Neurociencia', cat_id, true);

  -- Technology
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'technology';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('programming', 'Programación', cat_id, true),
    ('artificial-intelligence', 'Inteligencia Artificial', cat_id, true),
    ('robotics', 'Robótica', cat_id, true),
    ('3d-printing', 'Impresión 3D', cat_id, true),
    ('cybersecurity', 'Ciberseguridad', cat_id, true),
    ('linux', 'Linux', cat_id, true);

  -- Art
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'art';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('digital-art', 'Arte Digital', cat_id, true),
    ('photography', 'Fotografía', cat_id, true),
    ('pixel-art', 'Pixel Art', cat_id, true),
    ('calligraphy', 'Caligrafía', cat_id, true),
    ('origami', 'Origami', cat_id, true);

  -- Music
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'music';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('piano', 'Piano', cat_id, true),
    ('guitar', 'Guitarra', cat_id, true),
    ('lofi', 'Lo-fi', cat_id, true),
    ('classical-music', 'Música Clásica', cat_id, true),
    ('electronic-music', 'Música Electrónica', cat_id, true),
    ('kpop', 'K-Pop', cat_id, true);

  -- Gaming
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'gaming';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('minecraft', 'Minecraft', cat_id, true),
    ('zelda', 'Zelda', cat_id, true),
    ('pokemon', 'Pokémon', cat_id, true),
    ('chess', 'Ajedrez', cat_id, true),
    ('board-games', 'Juegos de Mesa', cat_id, true),
    ('speedrunning', 'Speedrunning', cat_id, true);

  -- Nature
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'nature';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('birdwatching', 'Observación de aves', cat_id, true),
    ('hiking', 'Senderismo', cat_id, true),
    ('gardening', 'Jardinería', cat_id, true),
    ('marine-biology', 'Biología Marina', cat_id, true),
    ('mushrooms', 'Micología', cat_id, true);

  -- Literature
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'literature';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('sci-fi', 'Ciencia Ficción', cat_id, true),
    ('fantasy', 'Fantasía', cat_id, true),
    ('manga', 'Manga', cat_id, true),
    ('poetry', 'Poesía', cat_id, true),
    ('philosophy', 'Filosofía', cat_id, true);

  -- Food
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'food';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('baking', 'Repostería', cat_id, true),
    ('sushi', 'Sushi', cat_id, true),
    ('coffee', 'Café', cat_id, true),
    ('fermentation', 'Fermentación', cat_id, true);

  -- History
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'history';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('ancient-rome', 'Roma Antigua', cat_id, true),
    ('world-war-2', 'Segunda Guerra Mundial', cat_id, true),
    ('mythology', 'Mitología', cat_id, true),
    ('archaeology', 'Arqueología', cat_id, true);

  -- Crafts
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'crafts';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('knitting', 'Tejido', cat_id, true),
    ('lego', 'LEGO', cat_id, true),
    ('model-trains', 'Trenes a Escala', cat_id, true),
    ('cosplay', 'Cosplay', cat_id, true);

  -- Sports
  SELECT id INTO cat_id FROM spin_categories WHERE slug = 'sports';
  INSERT INTO spin_tags (slug, display_name, category_id, is_curated) VALUES
    ('swimming', 'Natación', cat_id, true),
    ('climbing', 'Escalada', cat_id, true),
    ('martial-arts', 'Artes Marciales', cat_id, true),
    ('cycling', 'Ciclismo', cat_id, true),
    ('yoga', 'Yoga', cat_id, true);
END;
$$;

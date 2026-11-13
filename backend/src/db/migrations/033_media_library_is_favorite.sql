-- 030: Add is_favorite column to media_library for quick-access favorites
ALTER TABLE media_library ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT false;

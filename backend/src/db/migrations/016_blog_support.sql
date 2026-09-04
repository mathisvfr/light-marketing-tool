-- 016_blog_support: Add blog type + columns + RLS policies
-- Part of the blog pipeline (docs/designs/blog-pipeline.md)

-- 1. Add blog columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drafts' AND column_name = 'blog_titel'
  ) THEN
    ALTER TABLE drafts ADD COLUMN blog_titel TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'drafts' AND column_name = 'blog_html'
  ) THEN
    ALTER TABLE drafts ADD COLUMN blog_html TEXT;
  END IF;
END $$;

-- 2. Update type CHECK constraint to include 'blog'
ALTER TABLE drafts DROP CONSTRAINT IF EXISTS drafts_type_check;
ALTER TABLE drafts ADD CONSTRAINT drafts_type_check
  CHECK (type IN ('vacature', 'marketing-post', 'blog'));

-- 3. Fix RLS policies for anon reads
-- Drop the old policy that checks status='approved' (should be 'actief' for vacatures)
DROP POLICY IF EXISTS anon_read_public_vacatures ON drafts;

-- Vacatures: anon can read actief vacatures
CREATE POLICY anon_read_actief_vacatures ON drafts
  FOR SELECT TO anon
  USING (type = 'vacature' AND status = 'actief');

-- Blogs: anon can read published blogs
CREATE POLICY anon_read_published_blogs ON drafts
  FOR SELECT TO anon
  USING (type = 'blog' AND status = 'published');

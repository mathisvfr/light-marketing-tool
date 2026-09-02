-- 015_drafts_sector
-- Categorie op vacatures. Nullable zodat bestaande rijen niet breken; het
-- marketing-tool formulier kan later gaan schrijven. Publiek website filtert
-- op deze waarde; rijen zonder sector zijn zichtbaar onder "Alle".
--
-- Already applied on the Light-Marketing-Tool Supabase project
-- (bdifrujfgmfmzvypowcz). Commit this file into the marketing-tool repo at
-- backend/src/db/migrations/015_drafts_sector.sql so it becomes part of the
-- official migration history alongside 001–014.

ALTER TABLE public.drafts
  ADD COLUMN IF NOT EXISTS sector text;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'drafts_sector_check') THEN
    ALTER TABLE public.drafts DROP CONSTRAINT drafts_sector_check;
  END IF;
  ALTER TABLE public.drafts
    ADD CONSTRAINT drafts_sector_check
    CHECK (sector IS NULL OR sector IN ('Productie', 'Logistiek', 'Schoonmaak'));
END $$;

CREATE INDEX IF NOT EXISTS drafts_sector_idx ON public.drafts (sector)
  WHERE sector IS NOT NULL;

COMMENT ON COLUMN public.drafts.sector IS
  'Sectorlabel voor vacatures (Productie/Logistiek/Schoonmaak). Nullable; het publieke website leest deze kolom, met titel-heuristiek als fallback.';

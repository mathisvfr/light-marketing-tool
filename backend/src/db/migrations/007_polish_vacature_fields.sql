-- 007_polish_vacature_fields
-- Add Polish equivalents for functie_eisen and wat_wij_bieden
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS functie_eisen_pl TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS wat_wij_bieden_pl TEXT;

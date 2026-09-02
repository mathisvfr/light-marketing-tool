-- 014_drafts_translations.sql
--
-- Multi-language expansion. Vervangt de vaste Poolse kolommen door één
-- generieke JSONB-kolom `translations`, gestructureerd als:
--   { "pl": { "omschrijving": "...", "functie_eisen": "...",
--             "wat_wij_bieden": "...", "social": "..." },
--     "uk": { ... }, ... }
-- zodat we in de toekomst talen kunnen bijzetten zonder schema-migratie.
--
-- Ondersteunde taalcodes na deze migratie: pl, bg, sk, lv, en, hu, ro, uk.
-- (NL blijft in de bestaande omschrijving_nl / functie_eisen / wat_wij_bieden
-- / social_nl kolommen — NL is en blijft de primaire taal.)

-- 1. Nieuwe kolom toevoegen (idempotent — safe to re-run).
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS translations JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 2. Backfill: bestaande PL-content overzetten naar translations.pl.
-- Alleen rijen bijwerken die daadwerkelijk een PL-veld hebben, en alleen
-- als translations.pl er nog niet in staat (zodat een herhaalde run niets
-- overschrijft).
UPDATE drafts
SET translations = translations || jsonb_build_object(
  'pl', jsonb_strip_nulls(jsonb_build_object(
    'omschrijving',   omschrijving_pl,
    'functie_eisen',  functie_eisen_pl,
    'wat_wij_bieden', wat_wij_bieden_pl,
    'social',         social_pl
  ))
)
WHERE (translations->'pl') IS NULL
  AND (
    omschrijving_pl   IS NOT NULL OR
    functie_eisen_pl  IS NOT NULL OR
    wat_wij_bieden_pl IS NOT NULL OR
    social_pl         IS NOT NULL
  );

-- 3. Oude PL-kolommen droppen. Alle lees/schrijf-code gebruikt na deze
-- migratie de translations JSONB. generation_history bevat oude snapshots
-- met deze veldnamen — dat blijft geldig JSONB, we lezen ze niet meer terug.
ALTER TABLE drafts DROP COLUMN IF EXISTS omschrijving_pl;
ALTER TABLE drafts DROP COLUMN IF EXISTS functie_eisen_pl;
ALTER TABLE drafts DROP COLUMN IF EXISTS wat_wij_bieden_pl;
ALTER TABLE drafts DROP COLUMN IF EXISTS social_pl;

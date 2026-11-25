-- 038: laat de publieke website (anon key) website_texts lezen.
--
-- 034 maakte de tabel aan zonder policy. Supabase zet RLS standaard aan op
-- nieuwe tabellen, waardoor de website (anon) 0 rijen zag en overrides uit
-- de tool nooit op de site verschenen. Website-teksten zijn publiek; alleen
-- lezen voor anon. Schrijven blijft via de backend (service key, omzeilt RLS).

ALTER TABLE website_texts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anon_read_website_texts ON website_texts;
CREATE POLICY anon_read_website_texts ON website_texts
  FOR SELECT TO anon
  USING (true);

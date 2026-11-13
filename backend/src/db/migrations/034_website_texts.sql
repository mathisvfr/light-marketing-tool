CREATE TABLE IF NOT EXISTS website_texts (
  key TEXT NOT NULL,
  locale TEXT NOT NULL DEFAULT 'nl',
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (key, locale)
);

CREATE INDEX IF NOT EXISTS idx_website_texts_locale ON website_texts(locale);

#!/usr/bin/env node
/**
 * One-time backfill: trigger translations for all active vacatures and
 * published blogs that are missing translations.
 *
 * Usage:  node backend/scripts/backfill-translations.js
 *
 * Requires .env to be loaded (SUPABASE_URL, SUPABASE_SERVICE_KEY, and
 * an AI provider key). Run from the repo root.
 */

const path = require('path');

// Load .env from repo root
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { supabase } = require('../src/db/client');
const { translateVacature, translateBlog, SUPPORTED_TRANSLATION_LANGS, SUPPORTED_BLOG_TRANSLATION_LANGS } = require('../src/services/claude');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function backfillVacatures() {
  const { data: vacatures, error } = await supabase
    .from('drafts')
    .select('id, titel, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, form_data, translations')
    .eq('type', 'vacature')
    .eq('status', 'actief');

  if (error) {
    console.error('Fout bij ophalen vacatures:', error.message);
    return;
  }

  console.log(`\n=== Vacatures: ${vacatures.length} actief ===\n`);

  for (const draft of vacatures) {
    if (!draft.omschrijving_nl || !draft.omschrijving_nl.trim()) {
      console.log(`  SKIP ${draft.id} — geen NL omschrijving`);
      continue;
    }

    const existing = draft.translations && typeof draft.translations === 'object' ? draft.translations : {};
    const missing = SUPPORTED_TRANSLATION_LANGS.filter((lang) => {
      return !existing[lang] || !existing[lang].omschrijving;
    });

    if (missing.length === 0) {
      console.log(`  OK   ${draft.id} — alle ${SUPPORTED_TRANSLATION_LANGS.length} talen aanwezig`);
      continue;
    }

    console.log(`  FILL ${draft.id} — ${missing.length} ontbrekende talen: ${missing.join(', ')}`);

    const nlContent = {
      omschrijving_nl: draft.omschrijving_nl || '',
      functie_eisen: draft.functie_eisen || '',
      wat_wij_bieden: draft.wat_wij_bieden || '',
      social_nl: draft.social_nl || '',
    };

    for (const lang of missing) {
      try {
        console.log(`         ${lang}...`);
        const translation = await translateVacature(lang, draft.form_data || {}, nlContent);

        // Read-modify-write to avoid clobbering parallel results
        const { data: currentRow } = await supabase
          .from('drafts')
          .select('translations')
          .eq('id', draft.id)
          .maybeSingle();

        const merged = {
          ...(currentRow?.translations && typeof currentRow.translations === 'object' ? currentRow.translations : {}),
          [lang]: translation,
        };

        await supabase
          .from('drafts')
          .update({ translations: merged, updated_at: new Date().toISOString() })
          .eq('id', draft.id);

        console.log(`         ${lang} ✓`);

        // Small delay to avoid rate limits
        await sleep(1000);
      } catch (err) {
        console.error(`         ${lang} FOUT: ${err.message}`);
      }
    }
  }
}

async function backfillBlogs() {
  const { data: blogs, error } = await supabase
    .from('drafts')
    .select('id, blog_titel, blog_html, form_data, translations')
    .eq('type', 'blog')
    .eq('status', 'published');

  if (error) {
    console.error('Fout bij ophalen blogs:', error.message);
    return;
  }

  console.log(`\n=== Blogs: ${blogs.length} gepubliceerd ===\n`);

  for (const draft of blogs) {
    if (!draft.blog_html && !draft.blog_titel) {
      console.log(`  SKIP ${draft.id} — geen content`);
      continue;
    }

    const existing = draft.translations && typeof draft.translations === 'object' ? draft.translations : {};
    const missing = SUPPORTED_BLOG_TRANSLATION_LANGS.filter((lang) => {
      return !existing[lang] || (!existing[lang].blog_titel && !existing[lang].blog_html);
    });

    if (missing.length === 0) {
      console.log(`  OK   ${draft.id} — alle ${SUPPORTED_BLOG_TRANSLATION_LANGS.length} talen aanwezig`);
      continue;
    }

    const shortTitle = (draft.blog_titel || '').slice(0, 50);
    console.log(`  FILL ${draft.id} "${shortTitle}" — ${missing.length} ontbrekende talen`);

    const formData = draft.form_data || {};
    const nlContent = {
      blog_titel: draft.blog_titel || '',
      blog_html: draft.blog_html || '',
      teaser: formData.teaser || '',
      lead: formData.lead || '',
      meta_description: formData.meta_description || '',
      leestijd: formData.leestijd || '',
    };

    for (const lang of missing) {
      try {
        console.log(`         ${lang}...`);
        const translation = await translateBlog(lang, formData, nlContent);

        const { data: currentRow } = await supabase
          .from('drafts')
          .select('translations')
          .eq('id', draft.id)
          .maybeSingle();

        const merged = {
          ...(currentRow?.translations && typeof currentRow.translations === 'object' ? currentRow.translations : {}),
          [lang]: translation,
        };

        await supabase
          .from('drafts')
          .update({ translations: merged, updated_at: new Date().toISOString() })
          .eq('id', draft.id);

        console.log(`         ${lang} ✓`);
        await sleep(1000);
      } catch (err) {
        console.error(`         ${lang} FOUT: ${err.message}`);
      }
    }
  }
}

async function main() {
  console.log('Backfill vertalingen gestart...');
  console.log(`AI provider: ${process.env.AI_PROVIDER || 'anthropic (default)'}`);
  console.log(`Vacature talen: ${SUPPORTED_TRANSLATION_LANGS.join(', ')}`);
  console.log(`Blog talen: ${SUPPORTED_BLOG_TRANSLATION_LANGS.join(', ')}`);

  await backfillVacatures();
  await backfillBlogs();

  console.log('\nBackfill klaar.');
}

main().catch((err) => {
  console.error('Fatale fout:', err);
  process.exit(1);
});

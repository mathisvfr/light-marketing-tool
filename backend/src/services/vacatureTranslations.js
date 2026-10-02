const { supabase } = require('../db/client');
const { translateVacature, SUPPORTED_TRANSLATION_LANGS } = require('./claude');

/**
 * Fire-and-forget: translate an activated vacancy into all supported website
 * languages. Mirrors the blog translation pattern (triggerBlogTranslations).
 * Each language runs independently so one failure doesn't block the rest.
 *
 * Skips languages that already have a translation (e.g. user-selected ones
 * that were translated during generation). Only fills gaps.
 */
async function triggerVacatureTranslations(draftId) {
  const { data: draft, error } = await supabase
    .from('drafts')
    .select('id, titel, omschrijving_nl, functie_eisen, wat_wij_bieden, social_nl, form_data, translations')
    .eq('id', draftId)
    .maybeSingle();

  if (error || !draft) {
    console.error('[vacature-translate] Kon draft niet ophalen:', error?.message || 'niet gevonden');
    return;
  }

  // Nothing to translate if there's no Dutch description.
  if (!draft.omschrijving_nl || String(draft.omschrijving_nl).trim() === '') {
    return;
  }

  const existingTranslations =
    draft.translations && typeof draft.translations === 'object' ? draft.translations : {};

  const formData = draft.form_data || {};
  const nlContent = {
    omschrijving_nl: draft.omschrijving_nl || '',
    functie_eisen: draft.functie_eisen || '',
    wat_wij_bieden: draft.wat_wij_bieden || '',
    social_nl: draft.social_nl || '',
  };

  for (const lang of SUPPORTED_TRANSLATION_LANGS) {
    // Skip if this language already has a translation (user triggered it earlier).
    if (existingTranslations[lang] && existingTranslations[lang].omschrijving) {
      continue;
    }

    translateVacature(lang, formData, nlContent)
      .then(async (translation) => {
        // Read-modify-write to avoid clobbering parallel completions.
        const { data: currentRow } = await supabase
          .from('drafts')
          .select('translations')
          .eq('id', draft.id)
          .maybeSingle();

        const merged = {
          ...(currentRow?.translations && typeof currentRow.translations === 'object'
            ? currentRow.translations
            : {}),
          [lang]: translation,
        };

        await supabase
          .from('drafts')
          .update({ translations: merged, updated_at: new Date().toISOString() })
          .eq('id', draft.id);
      })
      .catch((err) => {
        console.error(`[vacature-translate] ${lang} mislukt voor draft ${draft.id}:`, err.message || err);
      });
  }
}

module.exports = { triggerVacatureTranslations };

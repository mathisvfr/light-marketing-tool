const { supabase } = require('../db/client');
const { translateBlog, SUPPORTED_BLOG_TRANSLATION_LANGS } = require('./claude');

/**
 * Fire-and-forget: translate a published blog into all supported website
 * languages. Each language runs as an independent promise so one failure
 * doesn't block the others. Uses read-modify-write on the translations
 * JSONB column (same pattern as vacature translations in drafts.js).
 */
async function triggerBlogTranslations(draftId) {
  const { data: draft, error } = await supabase
    .from('drafts')
    .select('id, blog_titel, blog_html, form_data')
    .eq('id', draftId)
    .maybeSingle();

  if (error || !draft) {
    console.error('[blog-translate] Kon draft niet ophalen:', error?.message || 'niet gevonden');
    return;
  }

  const formData = draft.form_data || {};
  const nlContent = {
    blog_titel: draft.blog_titel || '',
    blog_html: draft.blog_html || '',
    teaser: formData.teaser || '',
    lead: formData.lead || '',
    meta_description: formData.meta_description || '',
    leestijd: formData.leestijd || '',
  };

  // Skip if there's no real content to translate.
  if (!nlContent.blog_html && !nlContent.blog_titel) {
    return;
  }

  for (const lang of SUPPORTED_BLOG_TRANSLATION_LANGS) {
    translateBlog(lang, formData, nlContent)
      .then(async (translation) => {
        // Read-modify-write: merge into the current translations object so
        // parallel completions don't clobber each other.
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
        console.error(`[blog-translate] ${lang} mislukt voor draft ${draft.id}:`, err.message || err);
      });
  }
}

module.exports = { triggerBlogTranslations };

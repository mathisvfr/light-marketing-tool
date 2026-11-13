'use strict';

/**
 * Extract a human-readable title from a draft's form_data.
 * Shared across drafts.js, dashboard.js, and autoArchive.js to avoid duplication.
 */
function getDraftTitle(formData) {
  if (!formData || typeof formData !== 'object') {
    return 'Zonder titel';
  }

  return formData.functietitel || formData.onderwerp || formData.title || formData.titel || 'Zonder titel';
}

module.exports = { getDraftTitle };

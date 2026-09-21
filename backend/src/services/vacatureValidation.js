/**
 * Shared validation for vacature approval.
 * Used by both /drafts/:id/approve and /dashboard/queue/:id/approve
 * to ensure vacatures cannot be activated without required fields.
 */

/**
 * Validates that a vacature draft has all required fields before activation.
 * Returns null if valid, or an error message string if invalid.
 *
 * @param {object} draft - The draft row from the database
 * @returns {string|null} Error message or null
 */
function validateVacatureForApproval(draft) {
  if (draft.type !== 'vacature') {
    return null;
  }

  const sollicitatieUrl = String(
    draft.sollicitatie_url || draft.form_data?.sollicitatie_url || ''
  ).trim();

  if (!sollicitatieUrl || !/^https?:\/\//i.test(sollicitatieUrl)) {
    return 'Sollicitatie-URL ontbreekt of is ongeldig. Zonder geldige URL komen kandidaten via de feed nergens terecht.';
  }

  const omschrijvingNl = String(
    draft.omschrijving_nl || draft.form_data?.omschrijving_nl || ''
  ).trim();

  if (!omschrijvingNl) {
    return 'Nederlandse omschrijving ontbreekt; Jobit vereist een NL-omschrijving.';
  }

  return null;
}

module.exports = { validateVacatureForApproval };

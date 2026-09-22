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

  const omschrijvingNl = String(
    draft.omschrijving_nl || draft.form_data?.omschrijving_nl || ''
  ).trim();

  if (!omschrijvingNl) {
    return 'Nederlandse omschrijving ontbreekt; Jobit vereist een NL-omschrijving.';
  }

  return null;
}

module.exports = { validateVacatureForApproval };

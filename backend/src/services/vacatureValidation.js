/**
 * Shared validation for vacature approval.
 * Used by both /drafts/:id/approve and /dashboard/queue/:id/approve
 * to ensure vacatures cannot be activated without required fields.
 *
 * These checks prevent placement errors on downstream boards like
 * Werk.nl, Jobsonline, and Nationale Vacaturebank via Multiposter.
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

  const formData = draft.form_data || {};
  const errors = [];

  // Dutch description is required by Jobit for NL boards
  const omschrijvingNl = String(
    draft.omschrijving_nl || formData.omschrijving_nl || ''
  ).trim();
  if (!omschrijvingNl) {
    errors.push('Nederlandse omschrijving ontbreekt');
  }

  // Contract type
  const contract = String(draft.contract || formData.contract || '').trim();
  if (!contract) {
    errors.push('Contractvorm ontbreekt (bepaalde/onbepaalde tijd)');
  }

  // Dates — Werk.nl and Jobsonline require start/end dates for temporary contracts
  const isTemporary = contract.toLowerCase() !== 'onbepaalde tijd';
  const startdatum = String(formData.startdatum || '').trim();
  const einddatum = String(formData.einddatum || '').trim();

  if (isTemporary && !startdatum) {
    errors.push('Startdatum ontbreekt (verplicht bij tijdelijk contract, anders Werk.nl/Jobsonline fout)');
  }
  if (contract.toLowerCase() === 'bepaalde tijd' && !einddatum) {
    errors.push('Einddatum ontbreekt (verplicht bij contract voor bepaalde tijd)');
  }

  // Dienstverband
  if (!formData.dienstverband) {
    errors.push('Dienstverband ontbreekt (fulltime/parttime)');
  }

  // Uren
  const uren = String(draft.uren || formData.uren || formData.urenPerWeek || '').trim();
  if (!uren) {
    errors.push('Uren per week ontbreekt');
  }

  // Functiecategorie — needed for matching on most platforms
  if (!formData.functiecategorie && !formData.functie) {
    errors.push('Functiecategorie ontbreekt (nodig voor matching op vacatureboards)');
  }

  if (errors.length === 0) {
    return null;
  }

  return errors.join('; ') + '.';
}

module.exports = { validateVacatureForApproval };

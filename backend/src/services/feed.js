const { supabase } = require('../db/client');

const REQUIRED_FIELDS = ['nummer', 'datum', 'titel', 'plaats', 'omschrijving'];
// Fields that platforms like Werk.nl and Jobsonline require for successful placement.
// Not blocking the feed (unlike REQUIRED_FIELDS) but will emit diagnostics.
const PLATFORM_RECOMMENDED_FIELDS = [
  'dienstverband', 'contract', 'uren', 'opleiding', 'functiecategorie', 'email',
];
const FEED_PULL_STATE_KEY = 'feed_last_pulled_at';

function toCdata(value) {
  const text = String(value ?? '');
  return `<![CDATA[${text.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
}

/**
 * Format a date value to YYYY-MM-DD for the feed.
 * Handles ISO timestamps, YYYY-MM-DD strings, and Date objects.
 */
function formatDate(value) {
  if (!value) return '';
  const str = String(value).trim();
  if (!str) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;

  // ISO timestamp or other parseable date
  const parsed = new Date(str);
  if (Number.isNaN(parsed.getTime())) return str;

  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function isSinglePlaceName(value) {
  const text = String(value || '').trim();
  if (!text) {
    return false;
  }

  if (/[,/;0-9]/.test(text)) {
    return false;
  }

  const lowered = text.toLowerCase();
  if (lowered.includes('omgeving') || lowered.includes('regio') || lowered.includes('provincie')) {
    return false;
  }

  return true;
}

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

/**
 * Derive a startdatum when the form doesn't have one.
 * For 'Onbepaalde tijd' contracts we use today's date (platforms accept this
 * as "per direct"). For temporary contracts the date should have been provided
 * by the user — if it's missing we return '' and let diagnostics flag it.
 */
function deriveStartdatum(formData) {
  const explicit = pickFirst(formData.startdatum);
  if (explicit) return formatDate(explicit);

  const contract = pickFirst(formData.contract);
  if (contract === 'Onbepaalde tijd') {
    return formatDate(new Date().toISOString());
  }
  return '';
}

/**
 * Map "Bepaalde tijd" / "Onbepaalde tijd" to standardised values that
 * Multiposter can reliably map across all downstream boards.
 */
function normalizeContract(value) {
  const v = String(value || '').trim().toLowerCase();
  if (v === 'onbepaalde tijd') return 'Onbepaalde tijd';
  if (v === 'bepaalde tijd' || v === 'tijdelijk') return 'Bepaalde tijd';
  if (v === 'fulltime' || v === 'parttime') {
    // Old data had contract = "Fulltime" (confused with dienstverband)
    return 'Bepaalde tijd';
  }
  return value || 'Bepaalde tijd';
}

function mapDraftToFeedItem(draft) {
  const formData = draft.form_data || {};
  const plaatsCandidate = pickFirst(draft.plaats, formData.locatie);
  const plaats = isSinglePlaceName(plaatsCandidate) ? plaatsCandidate : 'Rotterdam';

  const contract = normalizeContract(pickFirst(draft.contract, formData.contract));

  // Jobit distribueert naar Nederlandse boards. Altijd de NL-tekst gebruiken.
  return {
    nummer: draft.id,
    datum: formatDate(draft.created_at),
    titel: pickFirst(draft.titel, formData.functietitel, formData.titel, formData.title, 'Vacature'),
    plaats,
    omschrijving: pickFirst(draft.omschrijving_nl, formData.omschrijving_nl, formData.omschrijving, ''),
    functiecategorie: pickFirst(formData.functiecategorie, formData.functie, ''),
    functieEisen: pickFirst(draft.functie_eisen, ''),
    watWijBieden: pickFirst(draft.wat_wij_bieden, ''),
    opleiding: pickFirst(formData.opleiding, 'Geen vereiste'),
    carriereNiveau: pickFirst(formData.carriereNiveau, 'Starter'),
    dienstverband: pickFirst(formData.dienstverband, 'Fulltime'),
    salaris: pickFirst(draft.salaris, formData.salaris, 'conform CAO'),
    uren: pickFirst(draft.uren, formData.uren, formData.urenPerWeek, ''),
    contract,
    startdatum: deriveStartdatum(formData),
    einddatum: formatDate(pickFirst(formData.einddatum, '')),
    sollicitatieUrl: pickFirst(draft.sollicitatie_url, formData.sollicitatie_url, ''),
    email: pickFirst(formData.email, 'vacature@lightpersoneelsdiensten.nl'),
  };
}

function createIssue(code, message, field) {
  return { code, message, field };
}

function evaluateItemQuality(draft, item) {
  const issues = [];
  const formData = draft.form_data || {};

  if (!draft.titel && !formData.functietitel && !formData.titel && !formData.title) {
    issues.push(createIssue('fallback_title', 'Titel ontbreekt in brondata, fallback gebruikt.', 'titel'));
  }

  const plaatsCandidate = pickFirst(draft.plaats, formData.locatie);
  if (!isSinglePlaceName(plaatsCandidate)) {
    issues.push(
      createIssue(
        'fallback_place',
        'Plaats was ongeldig of leeg, fallback Rotterdam gebruikt.',
        'plaats'
      )
    );
  }

  if (!draft.omschrijving_nl || String(draft.omschrijving_nl).trim() === '') {
    issues.push(
      createIssue(
        'missing_description',
        'Omschrijving ontbreekt; dit veld is verplicht volgens XML-specificatie.',
        'omschrijving'
      )
    );

    const translations = draft.translations && typeof draft.translations === 'object' ? draft.translations : {};
    const hasAnyTranslation = Object.values(translations).some(
      (entry) => entry && String(entry?.omschrijving || '').trim() !== ''
    );
    if (hasAnyTranslation) {
      issues.push(
        createIssue(
          'only_translation_description',
          'Alleen een vertaalde omschrijving aanwezig. Jobit distribueert naar NL-boards — voeg een Nederlandse omschrijving toe.',
          'omschrijving'
        )
      );
    }
  }

  // Date validation: platforms require start/end dates for temporary contracts
  const contract = normalizeContract(pickFirst(draft.contract, formData.contract));
  if (contract !== 'Onbepaalde tijd') {
    if (!item.startdatum) {
      issues.push(
        createIssue(
          'missing_startdatum',
          'Startdatum ontbreekt. Werk.nl en Jobsonline vereisen een startdatum bij tijdelijke contracten.',
          'startdatum'
        )
      );
    }
    if (contract === 'Bepaalde tijd' && !item.einddatum) {
      issues.push(
        createIssue(
          'missing_einddatum',
          'Einddatum ontbreekt. Werk.nl vereist een einddatum bij contracten voor bepaalde tijd.',
          'einddatum'
        )
      );
    }
  }

  // Check recommended fields (non-blocking, diagnostic only)
  for (const field of PLATFORM_RECOMMENDED_FIELDS) {
    if (!item[field] || String(item[field]).trim() === '') {
      issues.push(
        createIssue(
          'missing_recommended',
          `Aanbevolen veld '${field}' is leeg. Sommige platforms plaatsen de vacature mogelijk niet correct.`,
          field
        )
      );
    }
  }

  const missingRequired = REQUIRED_FIELDS.filter(
    (field) => item[field] === undefined || item[field] === null || String(item[field]).trim() === ''
  );

  for (const field of missingRequired) {
    issues.push(
      createIssue('missing_required', `Verplicht veld ontbreekt in feed-item: ${field}.`, field)
    );
  }

  return issues;
}

function toJobXml(item) {
  return [
    '  <job>',
    `    <Nummer>${toCdata(item.nummer)}</Nummer>`,
    `    <Datum>${toCdata(item.datum)}</Datum>`,
    `    <Titel>${toCdata(item.titel)}</Titel>`,
    `    <Plaats>${toCdata(item.plaats)}</Plaats>`,
    `    <Omschrijving>${toCdata(item.omschrijving)}</Omschrijving>`,
    `    <Functie>${toCdata(item.functiecategorie)}</Functie>`,
    `    <FunctieEisen>${toCdata(item.functieEisen)}</FunctieEisen>`,
    `    <WatWijBieden>${toCdata(item.watWijBieden)}</WatWijBieden>`,
    `    <Opleiding>${toCdata(item.opleiding)}</Opleiding>`,
    `    <CarriereNiveau>${toCdata(item.carriereNiveau)}</CarriereNiveau>`,
    `    <Dienstverband>${toCdata(item.dienstverband)}</Dienstverband>`,
    `    <LoonSalaris>${toCdata(item.salaris)}</LoonSalaris>`,
    `    <AantalUur>${toCdata(item.uren)}</AantalUur>`,
    `    <Contract>${toCdata(item.contract)}</Contract>`,
    `    <Startdatum>${toCdata(item.startdatum)}</Startdatum>`,
    `    <Einddatum>${toCdata(item.einddatum)}</Einddatum>`,
    `    <SollicitatieUrl>${toCdata(item.sollicitatieUrl)}</SollicitatieUrl>`,
    `    <Email>${toCdata(item.email)}</Email>`,
    '  </job>',
  ].join('\n');
}

async function recordFeedPull(context = {}) {
  const nowIso = new Date().toISOString();

  const value = JSON.stringify({
    at: nowIso,
    userAgent: context.userAgent || null,
    ip: context.ip || null,
  });

  await supabase
    .from('brand_settings')
    .upsert({ key: FEED_PULL_STATE_KEY, value, updated_at: nowIso }, { onConflict: 'key' });
}

async function readLastFeedPull() {
  const { data, error } = await supabase
    .from('brand_settings')
    .select('value, updated_at')
    .eq('key', FEED_PULL_STATE_KEY)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  try {
    const parsed = JSON.parse(data.value);
    return { at: parsed.at || data.updated_at, userAgent: parsed.userAgent || null };
  } catch (_error) {
    return { at: data.updated_at, userAgent: null };
  }
}

async function generateJobsFeedXml() {
  const { items } = await buildJobsFeedData();
  const jobsXml = items.map(toJobXml).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<jobs>',
    jobsXml,
    '</jobs>',
  ].join('\n');
}

async function fetchActiveVacatureDrafts() {
  const { data, error } = await supabase
    .from('drafts')
    .select('id, created_at, form_data, titel, plaats, omschrijving_nl, translations, functie_eisen, wat_wij_bieden, salaris, uren, contract, sollicitatie_url')
    .eq('type', 'vacature')
    .eq('status', 'actief')
    .order('updated_at', { ascending: false })
    .limit(5000);

  if (error) {
    throw error;
  }

  return data || [];
}

async function buildJobsFeedData() {
  const drafts = await fetchActiveVacatureDrafts();
  const items = [];
  const diagnostics = [];

  for (const draft of drafts) {
    const item = mapDraftToFeedItem(draft);
    const issues = evaluateItemQuality(draft, item);

    const hasMissingRequired = issues.some((i) => i.code === 'missing_required');

    if (!hasMissingRequired) {
      items.push(item);
    }

    if (issues.length > 0) {
      diagnostics.push({
        draftId: draft.id,
        excluded: hasMissingRequired,
        issues,
      });
    }
  }

  return {
    items,
    diagnostics,
  };
}

async function getJobsFeedStatus() {
  const [{ items, diagnostics }, lastPull] = await Promise.all([
    buildJobsFeedData(),
    readLastFeedPull(),
  ]);

  const issueCounts = diagnostics.reduce((accumulator, entry) => {
    for (const issue of entry.issues) {
      const currentCount = accumulator[issue.code] || 0;
      accumulator[issue.code] = currentCount + 1;
    }
    return accumulator;
  }, {});

  const excluded = diagnostics.filter((d) => d.excluded).length;

  return {
    generatedAt: new Date().toISOString(),
    totalItems: items.length,
    excludedItems: excluded,
    itemsWithIssues: diagnostics.length,
    issueCounts,
    diagnostics,
    lastPulledAt: lastPull?.at || null,
    lastPulledUserAgent: lastPull?.userAgent || null,
  };
}

module.exports = {
  generateJobsFeedXml,
  getJobsFeedStatus,
  recordFeedPull,
};

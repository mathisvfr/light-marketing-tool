const { supabase } = require('../db/client');

function toCdata(value) {
  const text = String(value ?? '');
  return `<![CDATA[${text.replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
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

function mapDraftToFeedItem(draft) {
  const formData = draft.form_data || {};
  const plaatsCandidate = pickFirst(draft.plaats, formData.locatie);
  const plaats = isSinglePlaceName(plaatsCandidate) ? plaatsCandidate : 'Rotterdam';

  return {
    nummer: draft.id,
    datum: draft.created_at,
    titel: pickFirst(draft.titel, formData.functietitel, formData.titel, formData.title, 'Vacature'),
    plaats,
    omschrijving: pickFirst(draft.omschrijving_nl, ''),
    functie: pickFirst(formData.functie, ''),
    functieEisen: pickFirst(draft.functie_eisen, ''),
    watWijBieden: pickFirst(draft.wat_wij_bieden, ''),
    opleiding: pickFirst(formData.opleiding, ''),
    carriereNiveau: pickFirst(formData.carriereNiveau, ''),
    dienstverband: pickFirst(formData.dienstverband, draft.contract, ''),
    salaris: pickFirst(draft.salaris, 'conform CAO'),
    uren: pickFirst(draft.uren, formData.uren, ''),
    contract: pickFirst(draft.contract, formData.contract, ''),
    sollicitatieUrl: pickFirst(draft.sollicitatie_url, formData.sollicitatie_url, ''),
    email: pickFirst(formData.email, ''),
  };
}

function toJobXml(item) {
  return [
    '  <job>',
    `    <Nummer>${toCdata(item.nummer)}</Nummer>`,
    `    <Datum>${toCdata(item.datum)}</Datum>`,
    `    <Titel>${toCdata(item.titel)}</Titel>`,
    `    <Plaats>${toCdata(item.plaats)}</Plaats>`,
    `    <Omschrijving>${toCdata(item.omschrijving)}</Omschrijving>`,
    `    <Functie>${toCdata(item.functie)}</Functie>`,
    `    <FunctieEisen>${toCdata(item.functieEisen)}</FunctieEisen>`,
    `    <WatWijBieden>${toCdata(item.watWijBieden)}</WatWijBieden>`,
    `    <Opleiding>${toCdata(item.opleiding)}</Opleiding>`,
    `    <CarriereNiveau>${toCdata(item.carriereNiveau)}</CarriereNiveau>`,
    `    <Dienstverband>${toCdata(item.dienstverband)}</Dienstverband>`,
    `    <LoonSalaris>${toCdata(item.salaris)}</LoonSalaris>`,
    `    <AantalUur>${toCdata(item.uren)}</AantalUur>`,
    `    <Contract>${toCdata(item.contract)}</Contract>`,
    `    <SollicitatieUrl>${toCdata(item.sollicitatieUrl)}</SollicitatieUrl>`,
    `    <Email>${toCdata(item.email)}</Email>`,
    '  </job>',
  ].join('\n');
}

async function generateJobsFeedXml() {
  const { data, error } = await supabase
    .from('drafts')
    .select('id, created_at, form_data, titel, plaats, omschrijving_nl, functie_eisen, wat_wij_bieden, salaris, uren, contract, sollicitatie_url')
    .eq('type', 'vacature')
    .eq('status', 'actief')
    .order('updated_at', { ascending: false })
    .limit(5000);

  if (error) {
    throw error;
  }

  const items = (data || []).map(mapDraftToFeedItem);
  const jobsXml = items.map(toJobXml).join('\n');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<jobs>',
    jobsXml,
    '</jobs>',
  ].join('\n');
}

module.exports = {
  generateJobsFeedXml,
};

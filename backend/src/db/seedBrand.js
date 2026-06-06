const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '..', '.env'),
  override: true,
});

const { supabase } = require('./client');

/**
 * Seed brand_settings met merkcontext afgeleid uit /docs/raw sources
 * en brand/brand-knowledge.md. Deze waarden voeden de contentgeneratie
 * (zie services/claude.js -> loadBrandContext) en het Merk instellingen scherm.
 */
const BRAND_SETTINGS = {
  bedrijfsnaam: 'Light Personeelsdiensten B.V.',

  tone_of_voice: [
    'Direct, nuchter en zelfverzekerd — de toon van een operator die de',
    'fabrieksvloer kent, geen corporate recruiter. Rotterdamse aanpak: korte',
    'lijnen, directe actie. Plat Nederlands, korte declaratieve zinnen',
    '("De productie moet draaien, punt."). Operationeel geloofwaardig: noem het',
    'echte werk (ploegendienst, snijhal, etiketteermachine, hygiëneregels,',
    'heftruck). Spreek opdrachtgevers aan met "u", kandidaten met "je/jij" —',
    'nooit wisselen binnen één tekst. Sentence case voor koppen en knoppen.',
    'Richting opdrachtgevers zakelijk en zonder hype of emoji; kandidaat-',
    'vacatures mogen luchtig en enthousiast zijn met een knipoog. Geen Engelse',
    'buzzwords, geen uitroeptekens-spam.',
  ].join(' '),

  aanbod_werknemers: [
    'Werk in productie, logistiek en schoonmaak in de regio Rotterdam, met de',
    'pluimvee-/voedingsindustrie als kern. Eerlijk loon conform ABU CAO',
    '(Fase A/B), één vast aanspreekpunt voor contract, salaris, reiskosten en',
    'loonstroken. Voor flexwerkers/arbeidsmigranten: huisvesting (woningen) en',
    'vervoer naar werklocaties geregeld. Persoonlijke begeleiding, korte lijnen',
    'en ruimte om door te groeien via scholing en begeleiding.',
  ].join(' '),

  aanbod_opdrachtgevers: [
    'Volledige ontzorging van het recruitmentproces: werving, selectie,',
    'screening en uitzenden tot en met salarisadministratie. Praktijkervaring',
    'in productie, logistiek en schoonmaak — wij kennen de sectoren van',
    'binnenuit. Snelheid en flexibiliteit zonder callcenters: direct contact',
    'met een vaste consultant die uw bedrijf kent. Focus op continuïteit, want',
    'elke lege plek in de ploegendienst kost direct geld. Aanvullend office',
    'support en HRM-advies. SNA-gecertificeerd. ABU CAO, betaaltermijn 14 dagen.',
  ].join(' '),

  doelgroep_werknemers: [
    'Echte doorzetters die gemotiveerd zijn productiewerk fulltime uit te',
    'voeren onder strenge veiligheids- en hygiënereglementen. Veel',
    'arbeidsmigranten (o.a. Pools) naast Nederlandse vakmensen: productie-',
    'medewerkers, heftruck-/chauffeurs en schoonmakers in en rond Rotterdam.',
  ].join(' '),

  doelgroep_opdrachtgevers: [
    'Bedrijven in voedingsproductie (vooral pluimvee/slachterijen), logistiek',
    'en schoonmaak in de regio Rotterdam (o.a. Rotterdam, Zevenhuizen,',
    'Dordrecht, Ridderkerk, Capelle, Barendrecht). HR- en operationeel',
    'verantwoordelijken die continuïteit in de ploegendienst nodig hebben en',
    'het recruitment volledig uit handen willen geven.',
  ].join(' '),

  configured_channels: JSON.stringify([
    'linkedin_jobs',
    'facebook_instagram',
    'wordpress',
  ]),
};

async function seedBrand() {
  const now = new Date().toISOString();
  const rows = Object.entries(BRAND_SETTINGS).map(([key, value]) => ({
    key,
    value,
    updated_at: now,
  }));

  const { error } = await supabase
    .from('brand_settings')
    .upsert(rows, { onConflict: 'key' });

  if (error) {
    throw error;
  }

  console.log(`Merkinstellingen gezaaid (${rows.length} sleutels).`);
}

seedBrand().catch((error) => {
  console.error('Seeden van merkinstellingen mislukt:', error.message);
  process.exit(1);
});

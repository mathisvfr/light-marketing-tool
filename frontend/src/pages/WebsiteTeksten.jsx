import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { CardLoading } from '../components/shared/Card';
import FormMessage from '../components/shared/FormMessage';
import './website-teksten.css';

const LONG_KEYS = [
  'hero.lead', 'about.intro', 'services.intro', 'contact.intro',
  'vacatures.intro', 'cta.body', 'blog.intro',
  'contact.audience1_body', 'contact.audience2_body',
  'tiles.tile1_body', 'tiles.tile2_body', 'tiles.tile3_body',
  'about.value1_body', 'about.value2_body', 'about.value3_body',
  'services.card1_body', 'services.card2_body', 'services.card3_body', 'services.card4_body',
  'vacatures.cta_body',
  'meta.home', 'meta.diensten', 'meta.over_ons', 'meta.contact', 'meta.vacatures', 'meta.blog',
];

const LOCALES = ['pl', 'en', 'bg', 'sk', 'lv', 'hu', 'ro', 'uk', 'de', 'es', 'ru'];

// ── Section metadata ──
const SECTION_META = {
  hero: {
    label: 'Hero (bovenaan de homepage)',
    description: 'De grote banner die bezoekers als eerste zien. Bevat koptekst, ondertitel en actieknoppen.',
  },
  tiles: {
    label: 'Tegels (USP-blokken)',
    description: 'De drie informatieblokken onder de hero die de kernwaarden van Light tonen.',
  },
  about: {
    label: 'Over ons',
    description: 'De "Over Light" pagina met introductietekst en kernwaarden.',
  },
  services: {
    label: 'Diensten',
    description: 'De dienstenpagina met kaarten per dienst (logistiek, productie, schoonmaak, etc.).',
  },
  vacatures: {
    label: 'Vacatures',
    description: 'De vacaturepagina-intro en call-to-action teksten.',
  },
  cta: {
    label: 'Call-to-Action',
    description: 'De CTA-sectie die op meerdere pagina\'s verschijnt.',
  },
  contact: {
    label: 'Contact',
    description: 'De contactpagina met teksten voor werkzoekenden en opdrachtgevers.',
  },
  blog: {
    label: 'Blog',
    description: 'De blogpagina-intro.',
  },
  meta: {
    label: 'SEO meta-beschrijvingen',
    description: 'De meta-descriptions die in Google-resultaten verschijnen. Houd ze onder 160 tekens.',
  },
  footer: {
    label: 'Footer',
    description: 'De teksten onderaan elke pagina.',
  },
  nav: {
    label: 'Navigatie',
    description: 'Menulinks en navigatielabels.',
  },
};

// ── Human-readable field labels ──
const FIELD_LABELS = {
  // Hero
  'hero.title': 'Koptekst',
  'hero.lead': 'Ondertitel / introductietekst',
  'hero.btn_vacatures': 'Knoptekst — Vacatures',
  'hero.btn_contact': 'Knoptekst — Contact',
  'hero.badge': 'Badge-tekst',
  // Tiles
  'tiles.tile1_title': 'Tegel 1 — Titel',
  'tiles.tile1_body': 'Tegel 1 — Tekst',
  'tiles.tile2_title': 'Tegel 2 — Titel',
  'tiles.tile2_body': 'Tegel 2 — Tekst',
  'tiles.tile3_title': 'Tegel 3 — Titel',
  'tiles.tile3_body': 'Tegel 3 — Tekst',
  // About
  'about.title': 'Paginatitel',
  'about.intro': 'Introductietekst',
  'about.value1_title': 'Waarde 1 — Titel',
  'about.value1_body': 'Waarde 1 — Tekst',
  'about.value2_title': 'Waarde 2 — Titel',
  'about.value2_body': 'Waarde 2 — Tekst',
  'about.value3_title': 'Waarde 3 — Titel',
  'about.value3_body': 'Waarde 3 — Tekst',
  // Services
  'services.title': 'Paginatitel',
  'services.intro': 'Introductietekst',
  'services.card1_title': 'Dienst 1 — Titel',
  'services.card1_body': 'Dienst 1 — Beschrijving',
  'services.card2_title': 'Dienst 2 — Titel',
  'services.card2_body': 'Dienst 2 — Beschrijving',
  'services.card3_title': 'Dienst 3 — Titel',
  'services.card3_body': 'Dienst 3 — Beschrijving',
  'services.card4_title': 'Dienst 4 — Titel',
  'services.card4_body': 'Dienst 4 — Beschrijving',
  // Vacatures
  'vacatures.title': 'Paginatitel',
  'vacatures.intro': 'Introductietekst',
  'vacatures.cta_title': 'CTA — Titel',
  'vacatures.cta_body': 'CTA — Tekst',
  'vacatures.cta_btn': 'CTA — Knoptekst',
  // CTA
  'cta.title': 'Titel',
  'cta.body': 'Tekst',
  'cta.btn': 'Knoptekst',
  // Contact
  'contact.title': 'Paginatitel',
  'contact.intro': 'Introductietekst',
  'contact.audience1_title': 'Doelgroep 1 — Titel',
  'contact.audience1_body': 'Doelgroep 1 — Tekst',
  'contact.audience2_title': 'Doelgroep 2 — Titel',
  'contact.audience2_body': 'Doelgroep 2 — Tekst',
  // Blog
  'blog.title': 'Paginatitel',
  'blog.intro': 'Introductietekst',
  // Meta
  'meta.home': 'Homepage',
  'meta.diensten': 'Diensten',
  'meta.over_ons': 'Over ons',
  'meta.contact': 'Contact',
  'meta.vacatures': 'Vacatures',
  'meta.blog': 'Blog',
  // Nav
  'nav.home': 'Home',
  'nav.diensten': 'Diensten',
  'nav.over_ons': 'Over ons',
  'nav.vacatures': 'Vacatures',
  'nav.blog': 'Blog',
  'nav.contact': 'Contact',
  // Footer
  'footer.tagline': 'Slogan',
  'footer.copyright': 'Copyright',
};

function getFieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // Fallback: humanize the key part after the dot
  const parts = key.split('.');
  return parts.slice(1).join(' ').replace(/_/g, ' ');
}

function getSectionMeta(name) {
  const key = (name || '').toLowerCase().replace(/\s+/g, '');
  // Try exact match first, then normalized lowercase lookup
  if (SECTION_META[name]) return SECTION_META[name];
  // Map known backend variants to our keys
  const ALIASES = { 'overons': 'about', 'diensten': 'services', 'calltoaction': 'cta', 'navigatie': 'nav' };
  const resolved = ALIASES[key] || key;
  return SECTION_META[resolved] || { label: name, description: '' };
}

export default function WebsiteTeksten() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [edits, setEdits] = useState({});
  const [openSections, setOpenSections] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  const textsQuery = useQuery({
    queryKey: ['website-texts'],
    queryFn: () => api('/website-texts'),
  });

  const statusQuery = useQuery({
    queryKey: ['website-texts-translation-status'],
    queryFn: async () => {
      const data = await api('/website-texts/translation-status');
      // Stop polling when all translations are complete.
      // Handled inside queryFn (an event callback) to avoid calling
      // setState in a render body or effect.
      if (data && (!data.pending || data.pending.length === 0)) {
        setIsTranslating(false);
        queryClient.invalidateQueries({ queryKey: ['website-texts'] });
      }
      return data;
    },
    refetchInterval: isTranslating ? 3000 : false,
    enabled: isTranslating,
  });

  const pendingKeys = useMemo(
    () => statusQuery.data?.pending || [],
    [statusQuery.data]
  );

  const sections = useMemo(
    () => textsQuery.data?.sections || {},
    [textsQuery.data]
  );

  const getServerValue = useCallback(
    (key) => {
      for (const sectionKeys of Object.values(sections)) {
        if (sectionKeys[key]?.nl !== undefined) {
          return sectionKeys[key].nl;
        }
      }
      return '';
    },
    [sections]
  );

  const getValueForKey = useCallback(
    (key) => {
      if (Object.prototype.hasOwnProperty.call(edits, key)) {
        return edits[key];
      }
      return getServerValue(key);
    },
    [edits, getServerValue]
  );

  const getLocalesForKey = useCallback(
    (key) => {
      for (const sectionKeys of Object.values(sections)) {
        if (sectionKeys[key]) {
          return sectionKeys[key];
        }
      }
      return {};
    },
    [sections]
  );

  const sectionTranslationStatus = useMemo(() => {
    if (!statusQuery.data) return {};
    const result = {};
    for (const [sectionName, keys] of Object.entries(sections)) {
      const sectionPending = keys
        ? Object.keys(keys).filter((k) => pendingKeys.includes(k))
        : [];
      result[sectionName] = sectionPending.length > 0 ? 'translating' : 'complete';
    }
    return result;
  }, [sections, statusQuery.data, pendingKeys]);

  const saveMutation = useMutation({
    mutationFn: (texts) =>
      api('/website-texts', {
        method: 'PUT',
        body: JSON.stringify({ texts }),
      }),
  });

  function toggleSection(name) {
    setOpenSections((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function updateField(key, value) {
    setEdits((prev) => ({ ...prev, [key]: value }));
  }

  function resetField(key) {
    setEdits((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const changedTexts = {};
    for (const [key, value] of Object.entries(edits)) {
      changedTexts[key] = value;
    }

    if (Object.keys(changedTexts).length === 0) {
      setError('Geen wijzigingen om op te slaan.');
      return;
    }

    try {
      await saveMutation.mutateAsync(changedTexts);
      setSuccess('Teksten opgeslagen. Vertalingen worden bijgewerkt...');
      setEdits({});
      setIsTranslating(true);
      queryClient.invalidateQueries({ queryKey: ['website-texts'] });
      queryClient.invalidateQueries({ queryKey: ['website-texts-translation-status'] });
    } catch (err) {
      setError(err.message || 'Opslaan mislukt.');
    }
  }

  if (role !== 'owner') {
    return <p>Alleen eigenaren hebben toegang tot deze pagina.</p>;
  }

  if (textsQuery.isLoading) {
    return <CardLoading message="Website teksten worden geladen..." rows={6} />;
  }

  if (textsQuery.isError) {
    return <FormMessage variant="error">Kon website teksten niet laden.</FormMessage>;
  }

  const hasEdits = Object.keys(edits).length > 0;
  const editCount = Object.keys(edits).length;

  return (
    <div className="wt-layout">
      <div className="wt-header">
        <div>
          <h2>Website teksten</h2>
          <p className="wt-subtitle">Bewerk de teksten die op de website verschijnen. Wijzigingen worden automatisch vertaald naar alle talen.</p>
        </div>
        <button
          type="button"
          className="wt-save-btn"
          disabled={!hasEdits || saveMutation.isPending}
          onClick={handleSave}
        >
          {saveMutation.isPending ? 'Opslaan...' : hasEdits ? `Opslaan (${editCount})` : 'Opslaan'}
        </button>
      </div>

      <FormMessage variant="error">{error}</FormMessage>
      <FormMessage variant="success">{success}</FormMessage>

      {isTranslating && (
        <div className="wt-translation-banner">
          <span className="spinner" />
          Vertalingen worden bijgewerkt voor {LOCALES.length} talen...
          {pendingKeys.length > 0 && ` (${pendingKeys.length} teksten in behandeling)`}
        </div>
      )}

      {Object.entries(sections).map(([sectionName, sectionKeys]) => {
        const isOpen = openSections[sectionName] ?? false;
        const keys = Object.keys(sectionKeys);
        const meta = getSectionMeta(sectionName);
        const translationStatus = sectionTranslationStatus[sectionName];
        const sectionEditCount = keys.filter((k) => Object.prototype.hasOwnProperty.call(edits, k)).length;

        return (
          <div key={sectionName} className={`wt-section${isOpen ? ' wt-section-open' : ''}`}>
            <button
              type="button"
              className="wt-section-toggle"
              onClick={() => toggleSection(sectionName)}
              aria-expanded={isOpen}
            >
              <div className="wt-section-header">
                <div className="wt-section-header-left">
                  <span className="wt-section-name">{meta.label}</span>
                  <span className="wt-section-count">{keys.length} velden</span>
                  {sectionEditCount > 0 && (
                    <span className="wt-section-edited">{sectionEditCount} gewijzigd</span>
                  )}
                  {isTranslating && translationStatus === 'translating' && (
                    <span className="wt-section-status translating">vertalen...</span>
                  )}
                  {isTranslating && translationStatus === 'complete' && (
                    <span className="wt-section-status complete">vertaald</span>
                  )}
                </div>
                <span className={`wt-section-toggle-icon ${isOpen ? 'open' : ''}`}>
                  &#9654;
                </span>
              </div>
              {meta.description && (
                <span className="wt-section-desc">{meta.description}</span>
              )}
            </button>

            {isOpen && (
              <div className="wt-section-body">
                {keys.map((key) => {
                  const isLong = LONG_KEYS.includes(key);
                  const value = getValueForKey(key);
                  const serverValue = getServerValue(key);
                  const isEdited = Object.prototype.hasOwnProperty.call(edits, key);
                  const locales = getLocalesForKey(key);
                  const isMeta = key.startsWith('meta.');

                  return (
                    <div key={key} className={`wt-field${isEdited ? ' wt-field-edited' : ''}`}>
                      <div className="wt-field-header">
                        <label className="wt-field-title" htmlFor={`wt-${key}`}>{getFieldLabel(key)}</label>
                        <span className="wt-field-key">{key}</span>
                        {isEdited && (
                          <button
                            type="button"
                            className="wt-field-reset"
                            onClick={() => resetField(key)}
                            title="Wijziging ongedaan maken"
                          >
                            ongedaan maken
                          </button>
                        )}
                      </div>
                      {isEdited && serverValue && (
                        <div className="wt-field-original">
                          <span className="wt-field-original-label">Huidige tekst:</span>
                          {serverValue}
                        </div>
                      )}
                      {isLong ? (
                        <textarea
                          id={`wt-${key}`}
                          rows={3}
                          value={value}
                          onChange={(e) => updateField(key, e.target.value)}
                          maxLength={isMeta ? 160 : undefined}
                        />
                      ) : (
                        <input
                          id={`wt-${key}`}
                          type="text"
                          value={value}
                          onChange={(e) => updateField(key, e.target.value)}
                        />
                      )}
                      {isMeta && (
                        <span className={`wt-field-charcount${(value || '').length > 160 ? ' over' : ''}`}>
                          {(value || '').length}/160
                        </span>
                      )}
                      <div className="wt-locale-pills">
                        <span className={`wt-locale-pill ${locales.nl ? 'has-value' : ''}`}>
                          nl
                        </span>
                        {LOCALES.map((loc) => (
                          <span
                            key={loc}
                            className={`wt-locale-pill ${locales[loc] ? 'has-value' : ''}`}
                            title={locales[loc] || `Geen ${loc} vertaling`}
                          >
                            {loc}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {hasEdits && (
        <div className="wt-header">
          <span />
          <button
            type="button"
            className="wt-save-btn"
            disabled={saveMutation.isPending}
            onClick={handleSave}
          >
            {saveMutation.isPending ? 'Opslaan...' : `Opslaan (${editCount})`}
          </button>
        </div>
      )}
    </div>
  );
}

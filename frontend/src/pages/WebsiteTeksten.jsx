import { useCallback, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import { CardLoading } from '../components/shared/Card';
import FormMessage from '../components/shared/FormMessage';
import HeroPreview from '../components/website-teksten/HeroPreview';
import TilesPreview from '../components/website-teksten/TilesPreview';
import AboutPreview from '../components/website-teksten/AboutPreview';
import ServicesPreview from '../components/website-teksten/ServicesPreview';
import ContactPreview from '../components/website-teksten/ContactPreview';
import VacaturesPreview from '../components/website-teksten/VacaturesPreview';
import CtaPreview from '../components/website-teksten/CtaPreview';
import BlogPreview from '../components/website-teksten/BlogPreview';
import SeoPreview from '../components/website-teksten/SeoPreview';
import FooterPreview from '../components/website-teksten/FooterPreview';
import NavPreview from '../components/website-teksten/NavPreview';
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

const SECTION_ORDER = ['hero', 'tiles', 'about', 'services', 'contact', 'vacatures', 'cta', 'blog', 'meta', 'footer', 'nav'];

const SECTION_META = {
  hero: { label: 'Hero', icon: '\u2B50' },
  tiles: { label: 'Tegels', icon: '\u25A6' },
  about: { label: 'Over ons', icon: '\u2139' },
  services: { label: 'Diensten', icon: '\u2699' },
  contact: { label: 'Contact', icon: '\u2709' },
  vacatures: { label: 'Vacatures', icon: '\u2696' },
  cta: { label: 'Call-to-Action', icon: '\u2794' },
  blog: { label: 'Blog', icon: '\u270E' },
  meta: { label: 'SEO', icon: '\u2315' },
  footer: { label: 'Footer', icon: '\u2587' },
  nav: { label: 'Navigatie', icon: '\u2630' },
};

const SECTION_ALIASES = { overons: 'about', diensten: 'services', calltoaction: 'cta', navigatie: 'nav' };

const PREVIEW_MAP = {
  hero: HeroPreview,
  tiles: TilesPreview,
  about: AboutPreview,
  services: ServicesPreview,
  contact: ContactPreview,
  vacatures: VacaturesPreview,
  cta: CtaPreview,
  blog: BlogPreview,
  meta: SeoPreview,
  footer: FooterPreview,
  nav: NavPreview,
};

const FIELD_LABELS = {
  'hero.title': 'Koptekst',
  'hero.lead': 'Ondertitel / introductietekst',
  'hero.btn_vacatures': 'Knoptekst — Vacatures',
  'hero.btn_contact': 'Knoptekst — Contact',
  'hero.badge': 'Badge-tekst',
  'tiles.tile1_title': 'Tegel 1 — Titel',
  'tiles.tile1_body': 'Tegel 1 — Tekst',
  'tiles.tile2_title': 'Tegel 2 — Titel',
  'tiles.tile2_body': 'Tegel 2 — Tekst',
  'tiles.tile3_title': 'Tegel 3 — Titel',
  'tiles.tile3_body': 'Tegel 3 — Tekst',
  'about.title': 'Paginatitel',
  'about.intro': 'Introductietekst',
  'about.value1_title': 'Waarde 1 — Titel',
  'about.value1_body': 'Waarde 1 — Tekst',
  'about.value2_title': 'Waarde 2 — Titel',
  'about.value2_body': 'Waarde 2 — Tekst',
  'about.value3_title': 'Waarde 3 — Titel',
  'about.value3_body': 'Waarde 3 — Tekst',
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
  'vacatures.title': 'Paginatitel',
  'vacatures.intro': 'Introductietekst',
  'vacatures.cta_title': 'CTA — Titel',
  'vacatures.cta_body': 'CTA — Tekst',
  'vacatures.cta_btn': 'CTA — Knoptekst',
  'cta.title': 'Titel',
  'cta.body': 'Tekst',
  'cta.btn': 'Knoptekst',
  'contact.title': 'Paginatitel',
  'contact.intro': 'Introductietekst',
  'contact.audience1_title': 'Doelgroep 1 — Titel',
  'contact.audience1_body': 'Doelgroep 1 — Tekst',
  'contact.audience2_title': 'Doelgroep 2 — Titel',
  'contact.audience2_body': 'Doelgroep 2 — Tekst',
  'blog.title': 'Paginatitel',
  'blog.intro': 'Introductietekst',
  'meta.home': 'Homepage',
  'meta.diensten': 'Diensten',
  'meta.over_ons': 'Over ons',
  'meta.contact': 'Contact',
  'meta.vacatures': 'Vacatures',
  'meta.blog': 'Blog',
  'nav.home': 'Home',
  'nav.diensten': 'Diensten',
  'nav.over_ons': 'Over ons',
  'nav.vacatures': 'Vacatures',
  'nav.blog': 'Blog',
  'nav.contact': 'Contact',
  'footer.tagline': 'Slogan',
  'footer.copyright': 'Copyright',
};

function getFieldLabel(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const parts = key.split('.');
  return parts.slice(1).join(' ').replace(/_/g, ' ');
}

function resolveSection(name) {
  const key = (name || '').toLowerCase().replace(/\s+/g, '');
  return SECTION_ALIASES[key] || key;
}

export default function WebsiteTeksten() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [edits, setEdits] = useState({});
  const [activeSection, setActiveSection] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const sectionRefs = useRef({});

  const textsQuery = useQuery({
    queryKey: ['website-texts'],
    queryFn: () => api('/website-texts'),
  });

  const statusQuery = useQuery({
    queryKey: ['website-texts-translation-status'],
    queryFn: async () => {
      const data = await api('/website-texts/translation-status');
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

  // Ordered section names: prefer SECTION_ORDER, then append any extras
  const orderedSectionNames = useMemo(() => {
    const resolved = {};
    for (const rawName of Object.keys(sections)) {
      const norm = resolveSection(rawName);
      resolved[norm] = rawName;
    }
    const ordered = [];
    for (const s of SECTION_ORDER) {
      if (resolved[s]) {
        ordered.push(resolved[s]);
        delete resolved[s];
      }
    }
    // Append any remaining sections not in our predefined order
    for (const rawName of Object.values(resolved)) {
      ordered.push(rawName);
    }
    return ordered;
  }, [sections]);

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

  function scrollToSection(sectionName) {
    setActiveSection(sectionName);
    const el = sectionRefs.current[sectionName];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  // If no active section yet, default to first
  const currentActive = activeSection || orderedSectionNames[0] || null;

  return (
    <div className="wt-page">
      {/* Top bar */}
      <div className="wt-topbar">
        <div className="wt-topbar-left">
          <h2 className="wt-page-title">Website teksten</h2>
          <p className="wt-page-subtitle">Bewerk teksten, zie direct hoe ze eruitzien op de website</p>
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
          <span className="wt-spinner" />
          Vertalingen worden bijgewerkt voor {LOCALES.length} talen...
          {pendingKeys.length > 0 && ` (${pendingKeys.length} in behandeling)`}
        </div>
      )}

      <div className="wt-split">
        {/* Section sidebar */}
        <nav className="wt-sidebar">
          {orderedSectionNames.map((sectionName) => {
            const norm = resolveSection(sectionName);
            const meta = SECTION_META[norm] || { label: sectionName, icon: '\u25CF' };
            const isActive = currentActive === sectionName;
            const keys = sections[sectionName] ? Object.keys(sections[sectionName]) : [];
            const sectionEditCount = keys.filter((k) => Object.prototype.hasOwnProperty.call(edits, k)).length;
            const translationStatus = sectionTranslationStatus[sectionName];

            return (
              <button
                key={sectionName}
                type="button"
                className={`wt-sidebar-item${isActive ? ' active' : ''}`}
                onClick={() => scrollToSection(sectionName)}
              >
                <span className="wt-sidebar-icon">{meta.icon}</span>
                <span className="wt-sidebar-label">{meta.label}</span>
                {sectionEditCount > 0 && (
                  <span className="wt-sidebar-badge edit">{sectionEditCount}</span>
                )}
                {isTranslating && translationStatus === 'translating' && (
                  <span className="wt-sidebar-badge translating" title="Vertalen...">...</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Main content area */}
        <div className="wt-main">
          {orderedSectionNames.map((sectionName) => {
            const norm = resolveSection(sectionName);
            const meta = SECTION_META[norm] || { label: sectionName, icon: '\u25CF' };
            const sectionKeys = sections[sectionName] || {};
            const keys = Object.keys(sectionKeys);
            const PreviewComponent = PREVIEW_MAP[norm];

            return (
              <section
                key={sectionName}
                ref={(el) => { sectionRefs.current[sectionName] = el; }}
                className="wt-section-block"
              >
                {/* Section header */}
                <div className="wt-section-label">
                  <span className="wt-section-label-icon">{meta.icon}</span>
                  <span>{meta.label}</span>
                  <span className="wt-section-field-count">{keys.length} velden</span>
                </div>

                {/* Visual preview */}
                {PreviewComponent && (
                  <div className="wt-preview-wrap">
                    <PreviewComponent getValue={getValueForKey} />
                  </div>
                )}

                {/* Edit fields */}
                <div className="wt-fields">
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
                          <div className="wt-locale-pills">
                            <span className={`wt-locale-pill${locales.nl ? ' has-value' : ''}`}>nl</span>
                            {LOCALES.map((loc) => (
                              <span
                                key={loc}
                                className={`wt-locale-pill${locales[loc] ? ' has-value' : ''}`}
                                title={locales[loc] || `Geen ${loc} vertaling`}
                              >
                                {loc}
                              </span>
                            ))}
                          </div>
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
                            <span className="wt-field-original-label">Was:</span>
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
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {/* Sticky bottom save bar when edits exist */}
      {hasEdits && (
        <div className="wt-sticky-save">
          <span className="wt-sticky-save-text">{editCount} wijziging{editCount !== 1 ? 'en' : ''} niet opgeslagen</span>
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

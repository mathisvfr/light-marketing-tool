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
  hero: { label: 'Bovenaan de homepage', icon: '\u2B50' },
  tiles: { label: 'Drie informatieblokken', icon: '\u25A6' },
  about: { label: 'Over ons', icon: '\u2139' },
  services: { label: 'Diensten', icon: '\u2699' },
  contact: { label: 'Contact', icon: '\u2709' },
  vacatures: { label: 'Vacatures', icon: '\u2696' },
  cta: { label: 'Oproep tot actie', icon: '\u2794' },
  blog: { label: 'Blog', icon: '\u270E' },
  meta: { label: 'Google-teksten', icon: '\u2315' },
  footer: { label: 'Onderkant pagina', icon: '\u2587' },
  nav: { label: 'Menu', icon: '\u2630' },
};

const SECTION_ALIASES = { overons: 'about', diensten: 'services', calltoaction: 'cta', navigatie: 'nav' };

// Map sections to website pages so the live preview iframe navigates to the right page
const SECTION_URLS = {
  hero: '/',
  tiles: '/',
  cta: '/',
  about: '/over-ons',
  services: '/diensten',
  contact: '/contact',
  vacatures: '/vacatures',
  blog: '/blog',
  meta: '/',
  footer: '/',
  nav: '/',
};
const WEBSITE_BASE = 'https://lightpersoneelsdiensten.nl';

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
  // Hero
  'hero.eyebrow': 'Kleine tekst boven de titel (bijv. "Uitzendbureau")',
  'hero.title': 'Koptekst',
  'hero.lead': 'Korte beschrijving onder de titel',
  'hero.btn_vacatures': 'Knoptekst — Vacatures',
  'hero.btn_opdrachtgevers': 'Knoptekst — Opdrachtgevers',
  'hero.btn_contact': 'Knoptekst — Contact',
  'hero.badge': 'Klein label bovenaan (bijv. "SNA-gecertificeerd")',
  'hero.sna_badge': 'SNA-keurmerk tekst',
  'hero.sna_sub': 'SNA-ondertitel',
  'hero.sector_productie': 'Sector — Productie',
  'hero.sector_logistiek': 'Sector — Logistiek',
  'hero.sector_schoonmaak': 'Sector — Schoonmaak',
  'tiles.tile1_title': 'Tegel 1 — Titel',
  'tiles.tile1_body': 'Tegel 1 — Tekst',
  'tiles.tile2_title': 'Tegel 2 — Titel',
  'tiles.tile2_body': 'Tegel 2 — Tekst',
  'tiles.tile3_title': 'Tegel 3 — Titel',
  'tiles.tile3_body': 'Tegel 3 — Tekst',
  // Over ons
  'about.eyebrow': 'Kleine tekst boven de titel',
  'about.title': 'Paginatitel',
  'about.intro': 'Introductietekst',
  'about.value1_title': 'Kernwaarde 1 — Titel',
  'about.value1_body': 'Kernwaarde 1 — Tekst',
  'about.value2_title': 'Kernwaarde 2 — Titel',
  'about.value2_body': 'Kernwaarde 2 — Tekst',
  'about.value3_title': 'Kernwaarde 3 — Titel',
  'about.value3_body': 'Kernwaarde 3 — Tekst',
  'about.offer_eyebrow': 'Kleine tekst boven "Wat bieden wij"',
  'about.offer_title': '"Wat bieden wij" — Titel',
  'about.check1': 'Voordeel 1',
  'about.check2': 'Voordeel 2',
  'about.check3': 'Voordeel 3',
  'about.check4': 'Voordeel 4',
  // Diensten
  'services.eyebrow': 'Kleine tekst boven de titel',
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
  'vacatures.eyebrow': 'Kleine tekst boven de titel',
  'vacatures.title': 'Paginatitel',
  'vacatures.intro': 'Introductietekst',
  'vacatures.cta_title': 'Oproep onderaan — Titel',
  'vacatures.cta_body': 'Oproep onderaan — Tekst',
  'vacatures.cta_btn': 'Oproep onderaan — Knoptekst',
  // Oproep tot actie (rode balk)
  'cta.statement': 'Uitspraak / statement',
  'cta.body': 'Tekst',
  'cta.btn': 'Knoptekst',
  'vacancy_feed.eyebrow': 'Kleine tekst boven vacatures-blok',
  'vacancy_feed.title': 'Vacatures-blok — Titel',
  // Contact
  'contact.eyebrow': 'Kleine tekst boven de titel',
  'contact.title': 'Paginatitel',
  'contact.intro': 'Introductietekst',
  'contact.audience1_tag': 'Kaart 1 — Label (bijv. "Werkzoekenden")',
  'contact.audience1_title': 'Kaart 1 — Titel',
  'contact.audience1_body': 'Kaart 1 — Tekst',
  'contact.audience2_tag': 'Kaart 2 — Label (bijv. "Opdrachtgevers")',
  'contact.audience2_title': 'Kaart 2 — Titel',
  'contact.audience2_body': 'Kaart 2 — Tekst',
  'contact.details_eyebrow': 'Kleine tekst boven contactgegevens',
  'contact.details_title': 'Contactgegevens — Titel',
  // Blog
  'blog.eyebrow': 'Kleine tekst boven de titel',
  'blog.title': 'Paginatitel',
  'blog.intro': 'Introductietekst',
  // Google-teksten (wat mensen zien in zoekresultaten)
  'meta.home': 'Homepage',
  'meta.diensten': 'Diensten',
  'meta.over_ons': 'Over ons',
  'meta.contact': 'Contact',
  'meta.vacatures': 'Vacatures',
  'meta.blog': 'Blog',
  // Menu
  'nav.home': 'Home',
  'nav.diensten': 'Diensten',
  'nav.over_ons': 'Over ons',
  'nav.vacatures': 'Vacatures',
  'nav.blog': 'Blog',
  'nav.contact': 'Contact',
  // Onderkant pagina
  'footer.tagline': 'Slogan onderaan de pagina',
  'footer.copyright': 'Copyrighttekst',
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
  const [iframeBust, setIframeBust] = useState(0);
  // Toggle-knop is verwijderd; het live-website-paneel staat altijd open.
  const showIframe = true;
  const iframeRef = useRef(null);
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
      setSuccess('Teksten opgeslagen. Vertalingen worden bijgewerkt... De website wordt binnen een minuut bijgewerkt.');
      setEdits({});
      setIsTranslating(true);
      queryClient.invalidateQueries({ queryKey: ['website-texts'] });
      queryClient.invalidateQueries({ queryKey: ['website-texts-translation-status'] });
      // Refresh the live preview iframe after a short delay (website cache = 60s)
      setTimeout(() => setIframeBust((n) => n + 1), 5000);
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

  // Iframe URL follows the active section
  const iframePath = SECTION_URLS[resolveSection(currentActive || '')] || '/';
  const iframeSrc = `${WEBSITE_BASE}${iframePath}?_cb=${iframeBust}`;

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

      <div className="wt-layout">
        {/* Live website preview */}
        <div className={`wt-iframe-panel${showIframe ? '' : ' collapsed'}`}>
          <div className="wt-iframe-header">
            <span className="wt-iframe-title">Live website</span>
            <button
              type="button"
              className="wt-iframe-refresh"
              onClick={() => setIframeBust((n) => n + 1)}
              title="Ververs preview"
            >
              ↻
            </button>
          </div>
          {showIframe && (
            <iframe
              ref={iframeRef}
              src={iframeSrc}
              className="wt-iframe"
              title="Website preview"
            />
          )}
        </div>

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
                    const isMeta = key.startsWith('meta.');

                    return (
                      <div key={key} className={`wt-field${isEdited ? ' wt-field-edited' : ''}`}>
                        <div className="wt-field-header">
                          <label className="wt-field-title" htmlFor={`wt-${key}`}>{getFieldLabel(key)}</label>
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
      </div>{/* close wt-layout */}

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

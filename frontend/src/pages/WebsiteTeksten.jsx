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

function friendlyLabel(key) {
  // "hero.btn_vacatures" → "btn vacatures"
  const parts = key.split('.');
  return parts.slice(1).join('.').replace(/_/g, ' ');
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
    queryFn: () => api('/website-texts/translation-status'),
    refetchInterval: isTranslating ? 3000 : false,
    enabled: isTranslating,
  });

  const pendingKeys = useMemo(
    () => statusQuery.data?.pending || [],
    [statusQuery.data]
  );

  // Stop polling when all translations are complete
  if (isTranslating && statusQuery.data && pendingKeys.length === 0) {
    // All done — stop polling on next tick
    setTimeout(() => {
      setIsTranslating(false);
      queryClient.invalidateQueries({ queryKey: ['website-texts'] });
    }, 0);
  }

  const sections = useMemo(
    () => textsQuery.data?.sections || {},
    [textsQuery.data]
  );

  // Merge server data with local edits for display
  const getValueForKey = useCallback(
    (key) => {
      if (Object.prototype.hasOwnProperty.call(edits, key)) {
        return edits[key];
      }
      // Find the NL value from sections
      for (const sectionKeys of Object.values(sections)) {
        if (sectionKeys[key]?.nl !== undefined) {
          return sectionKeys[key].nl;
        }
      }
      return '';
    },
    [edits, sections]
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

  // Track which sections have pending translations
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

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    // Collect all current NL values (server + edits)
    const allTexts = {};
    for (const sectionKeys of Object.values(sections)) {
      for (const [key, locales] of Object.entries(sectionKeys)) {
        if (Object.prototype.hasOwnProperty.call(edits, key)) {
          allTexts[key] = edits[key];
        } else if (locales.nl !== undefined) {
          allTexts[key] = locales.nl;
        }
      }
    }

    // Only send keys that have edits
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

  return (
    <div className="wt-layout">
      <div className="wt-header">
        <h2>Website teksten beheren</h2>
        <button
          type="button"
          className="wt-save-btn"
          disabled={!hasEdits || saveMutation.isPending}
          onClick={handleSave}
        >
          {saveMutation.isPending ? 'Opslaan...' : 'Opslaan'}
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
        const translationStatus = sectionTranslationStatus[sectionName];

        return (
          <div key={sectionName} className="wt-section">
            <button
              type="button"
              className="wt-section-toggle"
              onClick={() => toggleSection(sectionName)}
              aria-expanded={isOpen}
            >
              <span className="wt-section-header">
                {sectionName}
                <span className="wt-field-label">({keys.length})</span>
                {isTranslating && translationStatus === 'translating' && (
                  <span className="wt-section-status translating">vertalen...</span>
                )}
                {isTranslating && translationStatus === 'complete' && (
                  <span className="wt-section-status complete">vertaald</span>
                )}
              </span>
              <span className={`wt-section-toggle-icon ${isOpen ? 'open' : ''}`}>
                &#9654;
              </span>
            </button>

            {isOpen && (
              <div className="wt-section-body">
                {keys.map((key) => {
                  const isLong = LONG_KEYS.includes(key);
                  const value = getValueForKey(key);
                  const locales = getLocalesForKey(key);

                  return (
                    <div key={key} className="wt-field">
                      <span className="wt-field-label">{friendlyLabel(key)}</span>
                      {isLong ? (
                        <textarea
                          rows={3}
                          value={value}
                          onChange={(e) => updateField(key, e.target.value)}
                        />
                      ) : (
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => updateField(key, e.target.value)}
                        />
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
            {saveMutation.isPending ? 'Opslaan...' : 'Opslaan'}
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAutosaveDraft, formatSavedAt } from '../hooks/useAutosaveDraft';
import GenerationProgress from '../components/shared/GenerationProgress';
import VersionHistoryPicker from '../components/shared/VersionHistoryPicker';
import { api } from '../lib/api';
import MediaPicker from '../components/shared/MediaPicker';
import './vacature-plaatsen.css';

const DEFAULT_FORM = {
  functietitel: '',
  locatie: 'Rotterdam',
  urenPerWeek: '',
  startdatum: '',
  korteOmschrijving: '',
  talen: [],
  contract: '',
  email: 'vacature@lightpersoneelsdiensten.nl',
  template: 'vacancy',
};

const TEMPLATE_OPTIONS = [
  { key: 'vacancy', label: 'Vacaturekaart (feed)' },
  { key: 'story', label: 'Story (verticaal, Instagram)' },
];

// Extra kandidaat-talen. NL is de basis en blijft altijd aan.
const LANGUAGES = [
  { code: 'pl', label: 'Pools', native: 'Polski' },
  { code: 'bg', label: 'Bulgaars', native: 'Български' },
  { code: 'sk', label: 'Slowaaks', native: 'Slovenčina' },
  { code: 'lv', label: 'Lets', native: 'Latviešu' },
  { code: 'en', label: 'Engels', native: 'English' },
  { code: 'hu', label: 'Hongaars', native: 'Magyar' },
  { code: 'ro', label: 'Roemeens', native: 'Română' },
  { code: 'uk', label: 'Oekraïens', native: 'Українська' },
];

const TRANSLATION_FIELDS = [
  { key: 'omschrijving', label: 'Omschrijving' },
  { key: 'functie_eisen', label: 'Functie-eisen' },
  { key: 'wat_wij_bieden', label: 'Wat wij bieden' },
  { key: 'social', label: 'Social post' },
];

function langLabel(code) {
  const entry = LANGUAGES.find((item) => item.code === code);
  return entry ? entry.label : code.toUpperCase();
}

function createTabs(content, selectedLangs) {
  const tabs = [
    { key: 'omschrijving_nl', label: 'Omschrijving NL' },
    { key: 'functie_eisen', label: 'Functie-eisen NL' },
    { key: 'wat_wij_bieden', label: 'Wat wij bieden NL' },
    { key: 'social_nl', label: 'Social post NL' },
  ];

  const translations = content?.translations || {};
  for (const lang of selectedLangs) {
    const entry = translations[lang];
    const ready = Boolean(entry && (entry.omschrijving || entry.functie_eisen || entry.wat_wij_bieden || entry.social));
    for (const field of TRANSLATION_FIELDS) {
      tabs.push({
        key: `tr:${lang}:${field.key}`,
        label: `${field.label} ${langLabel(lang)}`,
        pending: !ready,
      });
    }
  }

  return tabs;
}

function readTab(content, tabKey) {
  if (!tabKey.startsWith('tr:')) {
    return content[tabKey] || '';
  }
  const [, lang, field] = tabKey.split(':');
  return content?.translations?.[lang]?.[field] || '';
}

export default function VacaturePlaatsen() {
  const { role, user, refreshSession } = useAuth();
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draftId');
  const [draftId, setDraftId] = useState(draftIdParam);
  const [formEdits, setFormEdits] = useState({});
  const [contentEdits, setContentEdits] = useState({});
  const [criticusOverride, setCriticusOverride] = useState({
    passed: undefined,
    notes: undefined,
  });
  const [activeTab, setActiveTab] = useState('omschrijving_nl');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [imagePath, setImagePath] = useState('');
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [steeringNotes, setSteeringNotes] = useState('');
  const [documentText, setDocumentText] = useState('');
  const [documentFilename, setDocumentFilename] = useState('');
  const [documentUploading, setDocumentUploading] = useState(false);

  const existingDraftQuery = useQuery({
    queryKey: ['draft-detail-vacature', draftIdParam],
    queryFn: () => api(`/drafts/${draftIdParam}`),
    enabled: Boolean(draftIdParam),
  });

  const loadedDraft = existingDraftQuery.data?.draft;

  // Sync imagePath met geladen draft (alleen bij eerste load)
  const [imageInitialized, setImageInitialized] = useState(false);
  if (loadedDraft && !imageInitialized) {
    setImagePath(loadedDraft.image_path || '');
    setImageInitialized(true);
  }

  const form = useMemo(
    () => ({
      ...DEFAULT_FORM,
      ...(loadedDraft?.form_data || {}),
      ...formEdits,
    }),
    [loadedDraft, formEdits]
  );

  // Merge server translations with any local edits (contentEdits.translations
  // overrides field-by-field, per language). Local edits alleen zichtbaar zolang
  // ze niet zijn opgeslagen; na save komt de nieuwe server-versie terug via de
  // query en overschrijft ze.
  const content = useMemo(() => {
    const serverTranslations = loadedDraft?.translations || {};
    const editTranslations = contentEdits.translations || {};
    const mergedTranslations = { ...serverTranslations };
    for (const [lang, fields] of Object.entries(editTranslations)) {
      mergedTranslations[lang] = { ...(mergedTranslations[lang] || {}), ...fields };
    }
    return {
      omschrijving_nl: loadedDraft?.omschrijving_nl || '',
      functie_eisen: loadedDraft?.functie_eisen || '',
      wat_wij_bieden: loadedDraft?.wat_wij_bieden || '',
      social_nl: loadedDraft?.social_nl || '',
      ...contentEdits,
      translations: mergedTranslations,
    };
  }, [loadedDraft, contentEdits]);

  const criticusPassed =
    typeof criticusOverride.passed === 'boolean'
      ? criticusOverride.passed
      : typeof loadedDraft?.criticus_passed === 'boolean'
      ? loadedDraft.criticus_passed
      : null;

  const criticusNotes =
    typeof criticusOverride.notes === 'string'
      ? criticusOverride.notes
      : loadedDraft?.criticus_notes || '';

  const effectiveDraftId = draftId || draftIdParam;

  const autosave = useAutosaveDraft(effectiveDraftId, form);

  // Poll voor achtergrond-tasks: criticus, image render, én per-taal vertalingen.
  // Elke poll ververst existingDraftQuery zodat translations vanzelf in de UI
  // verschijnen zodra ze klaar zijn. Interval loopt tot alles binnen is of tot
  // ~10 minuten (bovengrens tegen eeuwig doorlopen); de manuele "Ververs"-knop
  // in de UI is de escape voor uitschieters.
  const selectedLangsForPoll = Array.isArray(loadedDraft?.form_data?.talen)
    ? loadedDraft.form_data.talen
    : [];
  const missingTranslations = selectedLangsForPoll.filter((lang) => {
    const entry = loadedDraft?.translations?.[lang];
    return !entry || !(entry.omschrijving || entry.functie_eisen || entry.wat_wij_bieden || entry.social);
  });
  const pollGaveUpRef = useRef(false);

  const pollCountRef = useRef(0);
  useEffect(() => {
    const needsCriticus = criticusPassed === null;
    const needsImage = !imagePath;
    const needsTranslations = missingTranslations.length > 0;
    if ((!needsCriticus && !needsImage && !needsTranslations) || !effectiveDraftId || isGenerating) {
      pollCountRef.current = 0;
      pollGaveUpRef.current = false;
      return;
    }

    const interval = setInterval(async () => {
      pollCountRef.current += 1;
      // 10 minuten cap: 200 iteraties * 3s. Vertalingen zouden ruim binnen
      // 2 min klaar moeten zijn; deze cap is puur een safety net.
      if (pollCountRef.current > 200) {
        pollGaveUpRef.current = true;
        clearInterval(interval);
        return;
      }

      try {
        const result = await api(`/drafts/${effectiveDraftId}`);
        const draft = result?.draft;
        if (draft?.image_path) {
          setImagePath(draft.image_path);
        }
        if (typeof draft?.criticus_passed === 'boolean') {
          setCriticusOverride({
            passed: draft.criticus_passed,
            notes: draft.criticus_notes || '',
          });
        }
        // Refetch so translations in loadedDraft update — the useMemo picks
        // them up and new tabs appear zonder handmatige refresh.
        if (needsTranslations) {
          existingDraftQuery.refetch();
        }
      } catch {
        // Ignore poll errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [criticusPassed, imagePath, effectiveDraftId, isGenerating, missingTranslations.length]);

  // Referenced by the "Ververs vertalingen" button — forces een re-fetch en
  // reset de teller zodat het poll-loop opnieuw op gang komt als het gestopt was.
  function refreshTranslationsNow() {
    pollCountRef.current = 0;
    pollGaveUpRef.current = false;
    existingDraftQuery.refetch();
  }

  const selectedLangs = Array.isArray(form.talen) ? form.talen : [];
  const tabs = useMemo(() => createTabs(content, selectedLangs), [content, selectedLangs]);

  const saveMutation = useMutation({
    mutationFn: (status) =>
      api(`/drafts/${effectiveDraftId}`, {
        method: 'PUT',
        body: JSON.stringify({
          omschrijving_nl: content.omschrijving_nl,
          functie_eisen: content.functie_eisen,
          wat_wij_bieden: content.wat_wij_bieden,
          social_nl: content.social_nl,
          translations: content.translations || {},
          image_path: imagePath || null,
          criticus_passed: criticusPassed,
          criticus_notes: criticusNotes,
          status,
        }),
      }),
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: () => api(`/drafts/${effectiveDraftId}/submit`, { method: 'POST' }),
  });

  function updateField(key, value) {
    setFormEdits((prev) => ({ ...prev, [key]: value }));
  }

  async function handlePreUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Afbeelding kon niet worden gelezen.'));
        reader.readAsDataURL(file);
      });

      const uploaded = await api('/media/upload', {
        method: 'POST',
        body: JSON.stringify({ dataUrl, altText: file.name }),
      });

      setImagePath(uploaded?.item?.path || '');
      setImageInitialized(true);
      setSuccess('Afbeelding geüpload. Deze wordt gebruikt in plaats van een gegenereerde afbeelding.');
    } catch (err) {
      setError(err.message || 'Uploaden van afbeelding is mislukt.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleDocumentUpload(event) {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setError('');
    setSuccess('');
    setDocumentUploading(true);

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'));
        reader.readAsDataURL(file);
      });

      const result = await api('/uploads/extract-text', {
        method: 'POST',
        body: JSON.stringify({ dataUrl, filename: file.name }),
      });

      setDocumentText(result?.text || '');
      setDocumentFilename(result?.filename || file.name);

      // Auto-fill velden die uit het document te halen zijn — alleen als het
      // formulierveld nog leeg is, zodat handmatige input van de recruiter
      // nooit overschreven wordt.
      const extracted = result?.fields || {};
      const applied = [];
      const patch = {};
      const isEmpty = (v) => v === undefined || v === null || String(v).trim() === '';
      const FIELD_LABELS = {
        functietitel: 'functietitel',
        locatie: 'locatie',
        urenPerWeek: 'uren per week',
        contract: 'contract',
        salaris: 'salaris',
        startdatum: 'startdatum',
      };
      for (const [key, label] of Object.entries(FIELD_LABELS)) {
        if (extracted[key] !== undefined && isEmpty(form[key])) {
          patch[key] = extracted[key];
          applied.push(label);
        }
      }
      if (Object.keys(patch).length > 0) {
        setFormEdits((prev) => ({ ...prev, ...patch }));
      }

      const baseMsg = 'Document ingelezen. Tekst wordt meegenomen bij het genereren.';
      setSuccess(applied.length > 0 ? `${baseMsg} Automatisch ingevuld: ${applied.join(', ')}.` : baseMsg);
    } catch (err) {
      setError(err.message || 'Uitlezen van document is mislukt.');
    } finally {
      setDocumentUploading(false);
      event.target.value = '';
    }
  }

  function clearDocument() {
    setDocumentText('');
    setDocumentFilename('');
  }

  async function handleGenerate(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    setError('');
    setSuccess('');

    if (form.korteOmschrijving.length > 2000) {
      setError('Korte omschrijving mag maximaal 2000 tekens bevatten.');
      return;
    }

    const hasDocument = Boolean(documentText.trim());
    if (!form.korteOmschrijving.trim() && !hasDocument) {
      setError('Vul een korte omschrijving in of upload een document.');
      return;
    }

    if (!form.contract) {
      setError('Contract is verplicht.');
      return;
    }

    setIsGenerating(true);

    const steeringText = steeringNotes.trim();
    const docText = documentText.trim();
    const combinedChunks = [
      form.korteOmschrijving,
      docText ? `Klantbriefing / notitie (${documentFilename || 'document'}):\n${docText}` : '',
      steeringText ? `Extra sturing: ${steeringText}` : '',
    ].filter((chunk) => chunk && String(chunk).trim());

    const generationForm =
      combinedChunks.length > 1
        ? { ...form, korteOmschrijving: combinedChunks.join('\n\n') }
        : form;

    try {
      let targetDraftId = draftId;

      if (!targetDraftId) {
        const created = await api('/drafts', {
          method: 'POST',
          body: JSON.stringify({ formData: generationForm }),
        });

        targetDraftId = created?.draft?.id;
        setDraftId(targetDraftId);

        if (!user?.onboarded_at) {
          refreshSession();
        }
      }

      // Persist a pre-uploaded image before generating so the backend uses it
      // instead of rendering a Satori afbeelding.
      if (imagePath) {
        await api(`/drafts/${targetDraftId}`, {
          method: 'PUT',
          body: JSON.stringify({ image_path: imagePath, status: 'draft' }),
        });
      }

      const generated = await api(`/drafts/${targetDraftId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ formData: generationForm }),
      });

      const nextContent = {
        omschrijving_nl: generated?.draft?.omschrijving_nl || '',
        functie_eisen: generated?.draft?.functie_eisen || '',
        wat_wij_bieden: generated?.draft?.wat_wij_bieden || '',
        social_nl: generated?.draft?.social_nl || '',
        translations: generated?.draft?.translations || {},
      };

      setContentEdits(nextContent);
      setCriticusOverride({
        passed:
          typeof generated?.draft?.criticus_passed === 'boolean'
            ? generated.draft.criticus_passed
            : null,
        notes: generated?.draft?.criticus_notes || '',
      });
      setActiveTab('omschrijving_nl');
      setSuccess('Concept succesvol gegenereerd.');
      setSteeringNotes('');
    } catch (err) {
      setError(err.message || 'Genereren is mislukt.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveDraft() {
    setError('');
    setSuccess('');

    try {
      await saveMutation.mutateAsync('draft');
      setSuccess('Concept opgeslagen.');
    } catch (err) {
      setError(err.message || 'Opslaan is mislukt.');
    }
  }

  async function handleSubmitForApproval() {
    setError('');
    setSuccess('');

    try {
      await saveMutation.mutateAsync('draft');
      await submitForApprovalMutation.mutateAsync();
      setSuccess('Concept ingediend ter goedkeuring.');
    } catch (err) {
      setError(err.message || 'Indienen is mislukt.');
    }
  }

  async function handleApprove() {
    setError('');
    setSuccess('');

    try {
      await saveMutation.mutateAsync('draft');
      await api(`/drafts/${effectiveDraftId}/approve`, { method: 'POST' });
      setSuccess('Vacature is goedgekeurd en staat nu op actief (in feed).');
    } catch (err) {
      setError(err.message || 'Goedkeuren is mislukt.');
    }
  }

  const isBusy =
    isGenerating ||
    saveMutation.isPending ||
    submitForApprovalMutation.isPending;

  if (existingDraftQuery.isLoading) {
    return <p>Concept wordt geladen...</p>;
  }

  if (role === 'viewer') {
    return (
      <div className="vacature-layout">
        <div className="viewer-readonly-banner">
          Je hebt leesrechten. Je kunt geen vacatures aanmaken of bewerken.
        </div>
      </div>
    );
  }

  return (
    <div className="vacature-layout">
      <form className="vacature-form" onSubmit={handleGenerate}>
        {effectiveDraftId ? (
          <div className={`autosave-indicator${autosave.error ? ' error' : ''}`}>
            {autosave.isSaving
              ? 'Opslaan...'
              : autosave.error
              ? autosave.error
              : formatSavedAt(autosave.savedAt)}
          </div>
        ) : null}
        <div className="vacature-grid">
          <label className="vacature-field">
            Functietitel
            <input
              value={form.functietitel}
              onChange={(event) => updateField('functietitel', event.target.value)}
              required
            />
          </label>

          <label className="vacature-field">
            Locatie
            <input
              value={form.locatie}
              onChange={(event) => updateField('locatie', event.target.value)}
            />
          </label>

          <label className="vacature-field">
            Uren per week
            <input
              type="number"
              min="1"
              value={form.urenPerWeek}
              onChange={(event) => updateField('urenPerWeek', event.target.value)}
              required
            />
          </label>

          <label className="vacature-field">
            Startdatum
            <input
              type="date"
              value={form.startdatum}
              onChange={(event) => updateField('startdatum', event.target.value)}
            />
          </label>
        </div>

        <label className="vacature-field">
          Korte omschrijving {documentText ? <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(optioneel — document geüpload)</span> : null}
          <textarea
            value={form.korteOmschrijving}
            onChange={(event) => updateField('korteOmschrijving', event.target.value)}
            maxLength={2000}
            rows={6}
            required={!documentText}
          />
          <small>{form.korteOmschrijving.length}/2000 tekens</small>
        </label>

        <div className="vacature-field">
          <span>Klantbriefing of notitie (Word/PDF, optioneel)</span>
          {!documentText ? (
            <>
              <input
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.pdf,application/pdf"
                onChange={handleDocumentUpload}
                disabled={isBusy || documentUploading}
              />
              <small>
                {documentUploading
                  ? 'Document wordt ingelezen...'
                  : 'Upload een .docx of .pdf. De tekst wordt bij de briefing gevoegd voor Claude.'}
              </small>
            </>
          ) : (
            <div className="vacature-doc-block">
              <div className="vacature-doc-meta">
                <strong>{documentFilename || 'Document'}</strong>
                <span>{documentText.length} tekens ingelezen</span>
                <button
                  type="button"
                  className="vacature-remove-image"
                  onClick={clearDocument}
                  disabled={isBusy}
                >
                  Document verwijderen
                </button>
              </div>
              <textarea
                value={documentText}
                onChange={(event) => setDocumentText(event.target.value)}
                rows={8}
                disabled={isBusy}
              />
              <small>Je kunt de tekst hieronder aanpassen of inkorten voor je genereert.</small>
            </div>
          )}
        </div>

        <div className="vacature-field">
          <span>Visualisatie</span>
          <div className="vacature-language" role="group" aria-label="Visualisatiekeuze">
            {TEMPLATE_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                className={(form.template || 'vacancy') === option.key ? 'active' : ''}
                onClick={() => updateField('template', option.key)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="vacature-field">
          <span>Talen</span>
          <div className="vacature-language-list" role="group" aria-label="Extra talen naast Nederlands">
            <span className="vacature-lang-fixed" aria-label="Nederlands is altijd geselecteerd">
              Nederlands (basis)
            </span>
            {LANGUAGES.map((lang) => {
              const checked = selectedLangs.includes(lang.code);
              return (
                <label
                  key={lang.code}
                  className={`vacature-lang-check${checked ? ' checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const nextTalen = event.target.checked
                        ? [...selectedLangs, lang.code]
                        : selectedLangs.filter((code) => code !== lang.code);
                      updateField('talen', nextTalen);
                    }}
                  />
                  <span>
                    {lang.label} <em>({lang.native})</em>
                  </span>
                </label>
              );
            })}
          </div>
          <small>
            Nederlands is altijd de basis. Extra talen worden op de achtergrond gegenereerd en verschijnen als tabs zodra ze klaar zijn.
          </small>
        </div>

        <label className="vacature-field">
          Contract
          <input
            value={form.contract}
            onChange={(event) => updateField('contract', event.target.value)}
            placeholder="Bijv. Fulltime"
            required
          />
        </label>

        <label className="vacature-field">
          Salaris
          <input
            value={form.salaris || ''}
            onChange={(event) => updateField('salaris', event.target.value)}
            placeholder="Bijv. €14,- p/u of conform CAO (leeg = conform CAO)"
          />
        </label>

        <label className="vacature-field">
          Sollicitatie URL
          <input
            type="url"
            value={form.sollicitatie_url || ''}
            onChange={(event) => updateField('sollicitatie_url', event.target.value)}
            placeholder="https://"
          />
        </label>

        <label className="vacature-field">
          E-mailadres sollicitaties
          <input
            type="email"
            value={form.email || ''}
            onChange={(event) => updateField('email', event.target.value)}
            placeholder="recruiter@lightpersoneelsdiensten.nl"
          />
        </label>

        <label className="vacature-field">
          Eigen afbeelding (optioneel)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handlePreUpload}
            disabled={isBusy}
          />
          <small>Upload je eigen foto; laat leeg om automatisch een afbeelding te genereren.</small>
        </label>

        {/* Pre-upload preview: alleen zichtbaar vóór er een draft is. Na
            genereren neemt de preview-sectie hieronder de afbeelding over,
            zodat we 'm niet twee keer tonen. */}
        {imagePath && !effectiveDraftId ? (
          <div className="vacature-image-block">
            <img src={imagePath} alt="Geüploade afbeelding" className="vacature-preview-image" />
            <button
              type="button"
              className="vacature-remove-image"
              onClick={() => setImagePath('')}
              disabled={isBusy}
            >
              Afbeelding verwijderen
            </button>
          </div>
        ) : null}

        <div className="form-actions">
          <button type="submit" disabled={isBusy}>
            Concept genereren
          </button>
        </div>
      </form>

      <GenerationProgress active={isGenerating} />

      {effectiveDraftId && !isGenerating ? (
        <section className="vacature-preview">
          <h3>Voorbeeld en bewerken</h3>

          {criticusPassed === null && effectiveDraftId ? (
            <div className="skeleton">Criticus controleren...</div>
          ) : criticusPassed !== null ? (
            <div className={`criticus-box ${criticusPassed ? 'pass' : 'fail'}`}>
              <strong>{criticusPassed ? 'Criticus: akkoord' : 'Criticus: aandacht nodig'}</strong>
              <p>{criticusNotes || 'Geen opmerkingen.'}</p>
            </div>
          ) : null}

          <div className="vacature-regenerate">
            <label className="vacature-field">
              Niet helemaal wat je zoekt? Vertel de AI wat je anders wilt.
              <textarea
                value={steeringNotes}
                onChange={(event) => setSteeringNotes(event.target.value)}
                rows={2}
                placeholder="Bijv. Meer nadruk op vervoer, korter, minder formeel..."
                disabled={isBusy}
              />
            </label>
            <button
              type="button"
              onClick={() => handleGenerate()}
              disabled={isBusy}
            >
              Opnieuw genereren
            </button>
          </div>

          <VersionHistoryPicker
            draftId={effectiveDraftId}
            history={loadedDraft?.generation_history || []}
            draftType="vacature"
            onRestored={(restored) => {
              if (!restored) return;
              // Oude snapshots kunnen nog *_pl velden hebben; vertaal ze naar
              // translations.pl zodat de restore ook onder de nieuwe structuur werkt.
              const restoredTranslations = restored.translations && typeof restored.translations === 'object'
                ? { ...restored.translations }
                : {};
              if (restored.omschrijving_pl || restored.functie_eisen_pl || restored.wat_wij_bieden_pl || restored.social_pl) {
                restoredTranslations.pl = {
                  omschrijving: restored.omschrijving_pl || restoredTranslations.pl?.omschrijving || '',
                  functie_eisen: restored.functie_eisen_pl || restoredTranslations.pl?.functie_eisen || '',
                  wat_wij_bieden: restored.wat_wij_bieden_pl || restoredTranslations.pl?.wat_wij_bieden || '',
                  social: restored.social_pl || restoredTranslations.pl?.social || '',
                };
              }
              setContentEdits({
                omschrijving_nl: restored.omschrijving_nl || '',
                functie_eisen: restored.functie_eisen || '',
                wat_wij_bieden: restored.wat_wij_bieden || '',
                social_nl: restored.social_nl || '',
                translations: restoredTranslations,
              });
              existingDraftQuery.refetch();
            }}
          />

          <div className="preview-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${activeTab === tab.key ? 'active' : ''}${tab.pending ? ' pending' : ''}`}
                onClick={() => setActiveTab(tab.key)}
                disabled={tab.pending}
                title={tab.pending ? 'Vertaling wordt nog gegenereerd...' : undefined}
              >
                {tab.label}{tab.pending ? ' …' : ''}
              </button>
            ))}
            {missingTranslations.length > 0 ? (
              <button
                type="button"
                className="preview-tab-refresh"
                onClick={refreshTranslationsNow}
                title="Handmatig controleren of vertalingen al binnen zijn"
              >
                ↻ Ververs vertalingen
              </button>
            ) : null}
          </div>

          <div className="preview-pane">
            <textarea
              value={readTab(content, activeTab)}
              onChange={(event) => {
                const value = event.target.value;
                if (!activeTab.startsWith('tr:')) {
                  setContentEdits((prev) => ({ ...prev, [activeTab]: value }));
                  return;
                }
                const [, lang, field] = activeTab.split(':');
                setContentEdits((prev) => ({
                  ...prev,
                  translations: {
                    ...(prev.translations || {}),
                    [lang]: { ...(prev.translations?.[lang] || {}), [field]: value },
                  },
                }));
              }}
            />
            <button
              type="button"
              className="copy-text-btn"
              onClick={() => {
                navigator.clipboard.writeText(readTab(content, activeTab));
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? 'Gekopieerd!' : 'Kopieer tekst'}
            </button>
          </div>

          <div className="vacature-image-block">
            <p className="vacature-label">Afbeelding (optioneel)</p>
            {imagePath ? (
              <img src={imagePath} alt="Vacature afbeelding" className="vacature-preview-image" />
            ) : null}
            <button
              type="button"
              className="vacature-pick-image"
              onClick={() => setMediaPickerOpen(true)}
              disabled={isBusy}
            >
              {imagePath ? 'Andere afbeelding kiezen' : 'Afbeelding kiezen uit bibliotheek'}
            </button>
            {imagePath ? (
              <button
                type="button"
                className="vacature-remove-image"
                onClick={() => setImagePath('')}
                disabled={isBusy}
              >
                Afbeelding verwijderen
              </button>
            ) : null}
          </div>

          <MediaPicker
            open={mediaPickerOpen}
            onSelect={(path) => setImagePath(path)}
            onClose={() => setMediaPickerOpen(false)}
          />

          <div className="form-actions">
            <button type="button" onClick={handleSaveDraft} disabled={isBusy}>
              Opslaan als concept
            </button>

            {role === 'recruiter' ? (
              <button type="button" onClick={handleSubmitForApproval} disabled={isBusy}>
                Indienen ter goedkeuring
              </button>
            ) : null}

            {role === 'owner' ? (
              <button type="button" onClick={handleApprove} disabled={isBusy}>
                Goedkeuren
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
      {success ? <p>{success}</p> : null}
    </div>
  );
}

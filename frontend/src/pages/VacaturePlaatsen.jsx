import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import MediaPicker from '../components/shared/MediaPicker';
import './vacature-plaatsen.css';

const DEFAULT_FORM = {
  functietitel: '',
  locatie: 'Rotterdam',
  urenPerWeek: '',
  startdatum: '',
  korteOmschrijving: '',
  taal: 'NL',
  contract: '',
};

function createTabs(content) {
  const tabs = [
    { key: 'omschrijving_nl', label: 'Omschrijving NL' },
    { key: 'functie_eisen', label: 'Functie-eisen NL' },
    { key: 'wat_wij_bieden', label: 'Wat wij bieden NL' },
    { key: 'social_nl', label: 'Social post NL' },
  ];

  if (content.omschrijving_pl) {
    tabs.push({ key: 'omschrijving_pl', label: 'Omschrijving PL' });
  }

  if (content.social_pl) {
    tabs.push({ key: 'social_pl', label: 'Social post PL' });
  }

  return tabs;
}

export default function VacaturePlaatsen() {
  const { role } = useAuth();
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

  const content = useMemo(
    () => ({
      omschrijving_nl: loadedDraft?.omschrijving_nl || '',
      functie_eisen: loadedDraft?.functie_eisen || '',
      wat_wij_bieden: loadedDraft?.wat_wij_bieden || '',
      omschrijving_pl: loadedDraft?.omschrijving_pl || '',
      social_nl: loadedDraft?.social_nl || '',
      social_pl: loadedDraft?.social_pl || '',
      ...contentEdits,
    }),
    [loadedDraft, contentEdits]
  );

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

  const tabs = useMemo(() => createTabs(content), [content]);

  const saveMutation = useMutation({
    mutationFn: (status) =>
      api(`/drafts/${effectiveDraftId}`, {
        method: 'PUT',
        body: JSON.stringify({
          omschrijving_nl: content.omschrijving_nl,
          functie_eisen: content.functie_eisen,
          wat_wij_bieden: content.wat_wij_bieden,
          omschrijving_pl: content.omschrijving_pl,
          social_nl: content.social_nl,
          social_pl: content.social_pl,
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

  async function handleGenerate(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.korteOmschrijving.length > 400) {
      setError('Korte omschrijving mag maximaal 400 tekens bevatten.');
      return;
    }

    if (!form.contract) {
      setError('Contract is verplicht.');
      return;
    }

    setIsGenerating(true);

    try {
      let targetDraftId = draftId;

      if (!targetDraftId) {
        const created = await api('/drafts', {
          method: 'POST',
          body: JSON.stringify({ formData: form }),
        });

        targetDraftId = created?.draft?.id;
        setDraftId(targetDraftId);
      }

      const generated = await api(`/drafts/${targetDraftId}/generate`, {
        method: 'POST',
      });

      const nextContent = {
        omschrijving_nl: generated?.draft?.omschrijving_nl || '',
        functie_eisen: generated?.draft?.functie_eisen || '',
        wat_wij_bieden: generated?.draft?.wat_wij_bieden || '',
        omschrijving_pl: generated?.draft?.omschrijving_pl || '',
        social_nl: generated?.draft?.social_nl || '',
        social_pl: generated?.draft?.social_pl || '',
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
          Korte omschrijving
          <textarea
            value={form.korteOmschrijving}
            onChange={(event) => updateField('korteOmschrijving', event.target.value)}
            maxLength={400}
            rows={4}
            required
          />
          <small>{form.korteOmschrijving.length}/400 tekens</small>
        </label>

        <div className="vacature-field">
          <span>Taal</span>
          <div className="vacature-language" role="group" aria-label="Taalkeuze">
            {[['NL', 'NL'], ['NL+PL', 'NL + PL'], ['PL', 'PL']].map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={form.taal === value ? 'active' : ''}
                onClick={() => updateField('taal', value)}
              >
                {label}
              </button>
            ))}
          </div>
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

        <div className="form-actions">
          <button type="submit" disabled={isBusy}>
            Concept genereren
          </button>
        </div>
      </form>

      {isGenerating ? <div className="skeleton">Concept wordt gegenereerd...</div> : null}

      {effectiveDraftId && !isGenerating ? (
        <section className="vacature-preview">
          <h3>Voorbeeld en bewerken</h3>

          {criticusPassed !== null ? (
            <div className={`criticus-box ${criticusPassed ? 'pass' : 'fail'}`}>
              <strong>{criticusPassed ? 'Criticus: akkoord' : 'Criticus: aandacht nodig'}</strong>
              <p>{criticusNotes || 'Geen opmerkingen.'}</p>
            </div>
          ) : null}

          <div className="preview-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? 'active' : ''}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="preview-pane">
            <textarea
              value={content[activeTab] || ''}
              onChange={(event) =>
                setContentEdits((prev) => ({
                  ...prev,
                  [activeTab]: event.target.value,
                }))
              }
            />
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

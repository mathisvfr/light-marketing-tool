import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAutosaveDraft, formatSavedAt } from '../hooks/useAutosaveDraft';
import { api } from '../lib/api';
import MediaPicker from '../components/shared/MediaPicker';
import PlatformPreview from '../components/shared/PlatformPreview';
import GenerationProgress from '../components/shared/GenerationProgress';
import VersionHistoryPicker from '../components/shared/VersionHistoryPicker';
import './marketing-post.css';

const CHANNEL_OPTIONS = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'instagram', label: 'Instagram' },
];

const PREVIEW_TABS = [
  { key: 'linkedin_post', label: 'LinkedIn' },
  { key: 'social_nl', label: 'Facebook' },
  { key: 'instagram_caption', label: 'Instagram' },
];

const DEFAULT_FORM = {
  onderwerp: '',
  type: 'Opdrachtgevers',
  kanalen: [],
  template: 'statement',
};

const TEMPLATE_OPTIONS = [
  { key: 'statement', label: 'Statement (tekst op merk)' },
  { key: 'photo-feature', label: 'Foto met tekst' },
];

export default function MarketingPost() {
  const { role, user, refreshSession } = useAuth();
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draftId');
  const [draftId, setDraftId] = useState(draftIdParam);
  const [formEdits, setFormEdits] = useState({});
  const [contentEdits, setContentEdits] = useState({});
  const [imagePathOverride, setImagePathOverride] = useState(undefined);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [criticusOverride, setCriticusOverride] = useState({
    passed: undefined,
    notes: undefined,
  });
  const [activeTab, setActiveTab] = useState('linkedin_post');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [steeringNotes, setSteeringNotes] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');

  const brandQuery = useQuery({
    queryKey: ['brand-settings'],
    queryFn: () => api('/brand'),
  });

  const existingDraftQuery = useQuery({
    queryKey: ['draft-detail-marketing', draftIdParam],
    queryFn: () => api(`/drafts/${draftIdParam}`),
    enabled: Boolean(draftIdParam),
  });

  const loadedDraft = existingDraftQuery.data?.draft;

  const form = useMemo(
    () => ({
      ...DEFAULT_FORM,
      ...(loadedDraft?.form_data || {}),
      ...formEdits,
      kanalen: Array.isArray(formEdits.kanalen)
        ? formEdits.kanalen
        : Array.isArray(loadedDraft?.form_data?.kanalen)
        ? loadedDraft.form_data.kanalen
        : DEFAULT_FORM.kanalen,
    }),
    [loadedDraft, formEdits]
  );

  const content = useMemo(
    () => ({
      linkedin_post: loadedDraft?.linkedin_post || '',
      social_nl: loadedDraft?.social_nl || '',
      instagram_caption: loadedDraft?.instagram_caption || '',
      ...contentEdits,
    }),
    [loadedDraft, contentEdits]
  );

  const imagePath =
    typeof imagePathOverride === 'string' ? imagePathOverride : loadedDraft?.image_path || '';

  const autosave = useAutosaveDraft(draftId, form);

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

  // Poll for the background criticus result AND the rendered image. These finish
  // independently, so we keep polling until both have arrived (bounded), rather
  // than stopping as soon as criticus resolves — otherwise a slower image render
  // would never appear without a manual reload.
  const pollCountRef = useRef(0);
  useEffect(() => {
    const needsCriticus = criticusPassed === null;
    const needsImage = !imagePath;
    if ((!needsCriticus && !needsImage) || !effectiveDraftId || isGenerating) {
      pollCountRef.current = 0;
      return;
    }

    const interval = setInterval(async () => {
      pollCountRef.current += 1;
      if (pollCountRef.current > 8) {
        clearInterval(interval);
        return;
      }

      try {
        const result = await api(`/drafts/${effectiveDraftId}`);
        const draft = result?.draft;
        if (draft?.image_path) {
          setImagePathOverride(draft.image_path);
        }
        if (typeof draft?.criticus_passed === 'boolean') {
          setCriticusOverride({
            passed: draft.criticus_passed,
            notes: draft.criticus_notes || '',
          });
        }
      } catch {
        // Ignore poll errors
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [criticusPassed, imagePath, effectiveDraftId, isGenerating]);

  const apiStatus = brandQuery.data?.apiStatus || {};

  function isChannelEnabled(key) {
    if (key === 'facebook' || key === 'instagram') {
      return Boolean(apiStatus.facebook_instagram);
    }

    return Boolean(apiStatus[key]);
  }

  const saveMutation = useMutation({
    mutationFn: (status) =>
      api(`/drafts/${effectiveDraftId}`, {
        method: 'PUT',
        body: JSON.stringify({
          linkedin_post: content.linkedin_post,
          social_nl: content.social_nl,
          instagram_caption: content.instagram_caption,
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

  const publishMutation = useMutation({
    mutationFn: (dueAt) =>
      api(`/publish/${effectiveDraftId}`, {
        method: 'POST',
        body: JSON.stringify(dueAt ? { dueAt } : {}),
      }),
  });

  function updateField(key, value) {
    setFormEdits((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChannel(channelKey) {
    setFormEdits((prev) => {
      const current = Array.isArray(prev.kanalen) ? prev.kanalen : form.kanalen;
      const exists = current.includes(channelKey);
      if (exists) {
        return { ...prev, kanalen: current.filter((item) => item !== channelKey) };
      }

      return { ...prev, kanalen: [...current, channelKey] };
    });
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

      setImagePathOverride(uploaded?.item?.path || '');
      setSuccess('Afbeelding geüpload. Deze wordt gebruikt in plaats van een gegenereerde afbeelding.');
    } catch (err) {
      setError(err.message || 'Uploaden van afbeelding is mislukt.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleUploadOverride(event) {
    const file = event.target.files?.[0];
    if (!file || !effectiveDraftId) {
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

      const uploaded = await api(`/drafts/${effectiveDraftId}/image-override`, {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      });

      setImagePathOverride(uploaded?.draft?.image_path || '');
      setSuccess('Afbeelding succesvol overschreven.');
    } catch (err) {
      setError(err.message || 'Uploaden van afbeelding is mislukt.');
    } finally {
      event.target.value = '';
    }
  }

  async function handleGenerate(event) {
    if (event && typeof event.preventDefault === 'function') {
      event.preventDefault();
    }
    setError('');
    setSuccess('');

    if (form.kanalen.length === 0) {
      setError('Kies minimaal een kanaal.');
      return;
    }

    setIsGenerating(true);

    // Fold optional steering into beschrijving so the existing prompt reads it.
    const steeringText = steeringNotes.trim();
    const generationForm = steeringText
      ? {
          ...form,
          beschrijving: [form.beschrijving, `Extra sturing van gebruiker: ${steeringText}`]
            .filter((chunk) => chunk && String(chunk).trim())
            .join('\n\n'),
        }
      : form;

    try {
      let targetDraftId = draftId;

      if (!targetDraftId) {
        const created = await api('/drafts', {
          method: 'POST',
          body: JSON.stringify({
            type: 'marketing-post',
            formData: generationForm,
          }),
        });

        targetDraftId = created?.draft?.id;
        setDraftId(targetDraftId);

        // If this was the caller's first draft, backend just set onboarded_at.
        // Refresh session so the dashboard checklist hides on the next visit.
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

      setContentEdits({
        linkedin_post: generated?.draft?.linkedin_post || '',
        social_nl: generated?.draft?.social_nl || '',
        instagram_caption: generated?.draft?.instagram_caption || '',
      });
      setImagePathOverride(generated?.draft?.image_path || '');
      setCriticusOverride({
        passed:
          typeof generated?.draft?.criticus_passed === 'boolean'
            ? generated.draft.criticus_passed
            : null,
        notes: generated?.draft?.criticus_notes || '',
      });
      const channelToTab = { linkedin: 'linkedin_post', facebook: 'social_nl', instagram: 'instagram_caption' };
      const firstTab = form.kanalen.map((k) => channelToTab[k]).find(Boolean) || 'linkedin_post';
      setActiveTab(firstTab);
      setSuccess('Marketingconcept succesvol gegenereerd.');
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

  // Converts the datetime-local input value to a UTC ISO string. The picker
  // returns wall-clock time in the user's browser timezone (no offset), so we
  // rely on Date() interpreting it as local time when constructing the ISO.
  function resolveDueAt() {
    if (!scheduleAt) return null;
    const parsed = new Date(scheduleAt);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  function formatScheduleLabel(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleString('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  async function handleApproveAndPublish() {
    setError('');
    setSuccess('');
    const dueAt = resolveDueAt();

    try {
      await saveMutation.mutateAsync('draft');
      await api(`/drafts/${effectiveDraftId}/approve`, { method: 'POST' });
    } catch (err) {
      setError(err.message || 'Goedkeuren is mislukt.');
      return;
    }

    try {
      await publishMutation.mutateAsync(dueAt);
      setSuccess(
        dueAt
          ? `Marketingpost is goedgekeurd en ingepland via Buffer voor ${formatScheduleLabel(dueAt)}.`
          : 'Marketingpost is goedgekeurd en gepubliceerd op gekoppelde kanalen.'
      );
      setScheduleAt('');
    } catch (err) {
      setError(
        `Goedgekeurd, maar publiceren is mislukt: ${err.message || 'Onbekende fout.'} Controleer de kanaalinstellingen in Merk instellingen en probeer opnieuw.`
      );
    }
  }

  async function handleRetryPublish() {
    setError('');
    setSuccess('');
    const dueAt = resolveDueAt();

    try {
      await publishMutation.mutateAsync(dueAt);
      setSuccess(
        dueAt
          ? `Ingepland via Buffer voor ${formatScheduleLabel(dueAt)}.`
          : 'Marketingpost is succesvol gepubliceerd.'
      );
      setScheduleAt('');
    } catch (err) {
      setError(`Publiceren mislukt: ${err.message || 'Controleer kanaalinstellingen.'}`);
    }
  }

  const isBusy =
    isGenerating ||
    saveMutation.isPending ||
    submitForApprovalMutation.isPending ||
    publishMutation.isPending;

  if (existingDraftQuery.isLoading) {
    return <p>Concept wordt geladen...</p>;
  }

  if (role === 'viewer') {
    return (
      <div className="marketing-layout">
        <div className="viewer-readonly-banner">
          Je hebt leesrechten. Je kunt geen marketingposts aanmaken of bewerken.
        </div>
      </div>
    );
  }

  const autosaveLabel = autosave.isSaving
    ? 'Opslaan...'
    : autosave.error
    ? autosave.error
    : formatSavedAt(autosave.savedAt);

  return (
    <div className="marketing-layout">
      <form className="marketing-form" onSubmit={handleGenerate}>
        {draftId && autosaveLabel ? (
          <div className={`autosave-indicator${autosave.error ? ' error' : ''}`}>
            {autosaveLabel}
          </div>
        ) : null}
        <label className="marketing-field">
          Onderwerp
          <input
            value={form.onderwerp}
            onChange={(event) => updateField('onderwerp', event.target.value)}
            required
          />
        </label>

        <label className="marketing-field">
          Aanvullende context (optioneel)
          <textarea
            value={form.beschrijving || ''}
            onChange={(event) => updateField('beschrijving', event.target.value)}
            rows={3}
            placeholder="Extra context voor de AI, bijv. aanleiding, specifieke boodschap of doelgroep..."
          />
        </label>

        <div className="marketing-field">
          <span>Type</span>
          <div className="marketing-radio-group">
            {['Opdrachtgevers', 'Kandidaten'].map((value) => {
              const checked = form.type === value;
              return (
                <label
                  key={value}
                  className={`marketing-radio-item${checked ? ' checked' : ''}`}
                >
                  <input
                    type="radio"
                    name="marketing-type"
                    checked={checked}
                    onChange={() => updateField('type', value)}
                  />
                  {value}
                </label>
              );
            })}
          </div>
        </div>

        <div className="marketing-field">
          <span>Visualisatie</span>
          <div className="marketing-radio-group">
            {TEMPLATE_OPTIONS.map((option) => {
              const checked = (form.template || 'statement') === option.key;
              return (
                <label
                  key={option.key}
                  className={`marketing-radio-item${checked ? ' checked' : ''}`}
                >
                  <input
                    type="radio"
                    name="marketing-template"
                    checked={checked}
                    onChange={() => updateField('template', option.key)}
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="marketing-field">
          <span>Kanalen</span>
          <div className="marketing-channel-group">
            {CHANNEL_OPTIONS.map((channel) => {
              const disabled = !isChannelEnabled(channel.key);
              const checked = form.kanalen.includes(channel.key);

              return (
                <label
                  key={channel.key}
                  className={`marketing-channel-item${disabled ? ' disabled' : ''}${checked ? ' checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleChannel(channel.key)}
                    disabled={disabled}
                  />
                  {channel.label}
                </label>
              );
            })}
          </div>
        </div>

        <label className="marketing-field">
          Eigen afbeelding (optioneel)
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handlePreUpload}
            disabled={isBusy}
          />
          <small>Upload je eigen foto; laat leeg om automatisch een afbeelding te genereren.</small>
        </label>

        {imagePath ? (
          <div className="marketing-image-block">
            <img src={imagePath} alt="Geüploade afbeelding" className="marketing-preview-image" />
            <button
              type="button"
              className="marketing-pick-image"
              onClick={() => setImagePathOverride('')}
              disabled={isBusy}
            >
              Afbeelding verwijderen
            </button>
          </div>
        ) : null}

        <div className="marketing-actions">
          <button type="submit" disabled={isBusy || brandQuery.isLoading}>
            Concept genereren
          </button>
        </div>
      </form>

      <GenerationProgress active={isGenerating} />


      {effectiveDraftId && !isGenerating ? (
        <section className="marketing-preview">
          <h3>Voorbeeld en bewerken</h3>

          {criticusPassed === null && effectiveDraftId ? (
            <div className="marketing-skeleton">Criticus controleren...</div>
          ) : criticusPassed !== null ? (
            <div className={`marketing-criticus ${criticusPassed ? 'pass' : 'fail'}`}>
              <strong>{criticusPassed ? 'Criticus: akkoord' : 'Criticus: aandacht nodig'}</strong>
              <p>{criticusNotes || 'Geen opmerkingen.'}</p>
            </div>
          ) : null}

          <div className="marketing-regenerate">
            <label className="marketing-field">
              Niet helemaal wat je zoekt? Vertel de AI wat je anders wilt.
              <textarea
                value={steeringNotes}
                onChange={(event) => setSteeringNotes(event.target.value)}
                rows={2}
                placeholder="Bijv. Meer nadruk op flexibiliteit, korter, minder formeel..."
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
            draftType="marketing-post"
            onRestored={(restored) => {
              if (!restored) return;
              setContentEdits({
                linkedin_post: restored.linkedin_post || '',
                social_nl: restored.social_nl || '',
                instagram_caption: restored.instagram_caption || '',
              });
              existingDraftQuery.refetch();
            }}
          />

          <div className="marketing-tabs">
            {PREVIEW_TABS.filter((tab) => {
              if (tab.key === 'linkedin_post') return form.kanalen.includes('linkedin');
              if (tab.key === 'social_nl') return form.kanalen.includes('facebook');
              if (tab.key === 'instagram_caption') return form.kanalen.includes('instagram');
              return true;
            }).map((tab) => (
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

          <textarea
            value={content[activeTab] || ''}
            onChange={(event) =>
              setContentEdits((prev) => ({
                ...prev,
                [activeTab]: event.target.value,
              }))
            }
          />

          <PlatformPreview
            platform={
              activeTab === 'linkedin_post'
                ? 'linkedin'
                : activeTab === 'social_nl'
                ? 'facebook'
                : activeTab === 'instagram_caption'
                ? 'instagram'
                : null
            }
            text={content[activeTab] || ''}
            imagePath={imagePath}
            brandName={brandQuery.data?.settings?.company_name || 'Light Personeelsdiensten'}
          />

          <button
            type="button"
            className="copy-text-btn"
            onClick={() => {
              navigator.clipboard.writeText(content[activeTab] || '');
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? 'Gekopieerd!' : 'Kopieer tekst'}
          </button>

          <div className="marketing-image-block">
            <p className="marketing-label">Afbeelding preview</p>
            {imagePath ? (
              <img src={imagePath} alt="Marketing preview" className="marketing-preview-image" />
            ) : (
              <p className="marketing-muted">Nog geen afbeelding geselecteerd.</p>
            )}

            <button
              type="button"
              className="marketing-pick-image"
              onClick={() => setMediaPickerOpen(true)}
              disabled={isBusy}
            >
              {imagePath ? 'Andere afbeelding kiezen' : 'Afbeelding kiezen uit bibliotheek'}
            </button>
          </div>

          <MediaPicker
            open={mediaPickerOpen}
            onSelect={(path) => setImagePathOverride(path)}
            onClose={() => setMediaPickerOpen(false)}
          />

          {role === 'owner' ? (
            <PatternPickerBlock
              form={form}
              scheduleAt={scheduleAt}
              setScheduleAt={setScheduleAt}
              resolveDueAt={resolveDueAt}
              formatScheduleLabel={formatScheduleLabel}
              isBusy={isBusy}
            />
          ) : null}

          <div className="marketing-actions">
            <button type="button" onClick={handleSaveDraft} disabled={isBusy}>
              Opslaan als concept
            </button>

            {role === 'recruiter' ? (
              <button type="button" onClick={handleSubmitForApproval} disabled={isBusy}>
                Indienen ter goedkeuring
              </button>
            ) : null}

            {role === 'owner' && loadedDraft?.status === 'approved' ? (
              <button type="button" onClick={handleRetryPublish} disabled={isBusy}>
                {scheduleAt ? 'Inplannen via Buffer' : 'Opnieuw publiceren'}
              </button>
            ) : null}

            {role === 'owner' && loadedDraft?.status !== 'approved' ? (
              <button type="button" onClick={handleApproveAndPublish} disabled={isBusy}>
                {scheduleAt ? 'Goedkeuren en inplannen' : 'Goedkeuren en publiceren'}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {error ? <p className="marketing-error">{error}</p> : null}
      {success ? <p>{success}</p> : null}
    </div>
  );
}

// Owner-only block: shows a datetime-local picker + a dropdown of active
// publication patterns whose channel matches at least one selected kanaal.
// Picking a pattern resolves its next-slot on demand (batched on dropdown
// open) and prefills the datetime input so the user can confirm before
// committing. This is the "Inplannen via patroon" flow from Slice 2.
function PatternPickerBlock({ form, scheduleAt, setScheduleAt, resolveDueAt, formatScheduleLabel, isBusy }) {
  const [selectedPattern, setSelectedPattern] = useState('');
  const [resolvingPattern, setResolvingPattern] = useState(false);
  const [patternError, setPatternError] = useState('');

  const patternsQuery = useQuery({
    queryKey: ['publication-patterns'],
    queryFn: () => api('/patterns'),
  });

  const kanalen = Array.isArray(form.kanalen) ? form.kanalen : [];
  const matchingPatterns = useMemo(() => {
    const all = patternsQuery.data?.patterns || [];
    return all.filter((p) => p.isActive && kanalen.includes(p.channel));
  }, [patternsQuery.data, kanalen]);

  async function applyPattern(patternId) {
    setSelectedPattern(patternId);
    if (!patternId) return;
    setPatternError('');
    setResolvingPattern(true);
    try {
      const result = await api(`/patterns/${patternId}/next-slot`);
      const next = result?.nextSlot;
      if (!next) throw new Error('Geen datum ontvangen.');
      // Convert UTC ISO to a datetime-local wall-clock in Europe/Amsterdam.
      // Intl formatting gets us the parts; the input eats YYYY-MM-DDTHH:MM.
      const parts = Object.fromEntries(
        new Intl.DateTimeFormat('en-GB', {
          timeZone: 'Europe/Amsterdam',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
          .formatToParts(new Date(next))
          .map((p) => [p.type, p.value])
      );
      setScheduleAt(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`);
    } catch (err) {
      setPatternError(err?.message || 'Kon volgend moment niet ophalen.');
    } finally {
      setResolvingPattern(false);
    }
  }

  return (
    <div className="marketing-schedule">
      <label className="marketing-field">
        Publicatiemoment (optioneel)
        <input
          type="datetime-local"
          value={scheduleAt}
          onChange={(event) => {
            setScheduleAt(event.target.value);
            setSelectedPattern('');
          }}
          disabled={isBusy}
        />
      </label>

      {matchingPatterns.length > 0 ? (
        <label className="marketing-field">
          Inplannen via patroon
          <select
            value={selectedPattern}
            onChange={(event) => applyPattern(event.target.value)}
            disabled={isBusy || resolvingPattern}
          >
            <option value="">— Geen patroon —</option>
            {matchingPatterns.map((pattern) => (
              <option key={pattern.id} value={pattern.id}>
                {pattern.name} ({pattern.channel} · {String(pattern.timeOfDay).slice(0, 5)})
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="marketing-muted">
          Geen actieve patronen voor de gekozen kanalen. Maak er één aan in{' '}
          <a href="/publicatiepatronen">Publicatiepatronen</a>.
        </p>
      )}

      <p className="marketing-muted">
        {scheduleAt
          ? `Wordt via Buffer ingepland voor ${formatScheduleLabel(resolveDueAt())}.`
          : 'Leeg = direct in Buffer-wachtrij.'}
      </p>

      {resolvingPattern ? <p className="marketing-muted">Volgend moment ophalen...</p> : null}
      {patternError ? <p className="marketing-error">{patternError}</p> : null}
    </div>
  );
}

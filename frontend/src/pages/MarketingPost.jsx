import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import './marketing-post.css';

const CHANNEL_OPTIONS = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'facebook_instagram', label: 'Facebook/Instagram' },
];

const DEFAULT_FORM = {
  onderwerp: '',
  type: 'Opdrachtgevers',
  kanalen: [],
};

export default function MarketingPost() {
  const { role } = useAuth();
  const [searchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draftId');
  const [draftId, setDraftId] = useState(draftIdParam);
  const [formEdits, setFormEdits] = useState({});
  const [contentEdits, setContentEdits] = useState({});
  const [imagePathOverride, setImagePathOverride] = useState(undefined);
  const [criticusOverride, setCriticusOverride] = useState({
    passed: undefined,
    notes: undefined,
  });
  const [activeTab, setActiveTab] = useState('linkedin_post');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

  const configuredChannels = brandQuery.data?.configuredChannels || CHANNEL_OPTIONS.map((c) => c.key);

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
    mutationFn: () => api(`/publish/${effectiveDraftId}`, { method: 'POST' }),
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
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.kanalen.length === 0) {
      setError('Kies minimaal een kanaal.');
      return;
    }

    setIsGenerating(true);

    try {
      let targetDraftId = draftId;

      if (!targetDraftId) {
        const created = await api('/drafts', {
          method: 'POST',
          body: JSON.stringify({
            type: 'marketing-post',
            formData: form,
          }),
        });

        targetDraftId = created?.draft?.id;
        setDraftId(targetDraftId);
      }

      const generated = await api(`/drafts/${targetDraftId}/generate`, { method: 'POST' });

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
      setActiveTab('linkedin_post');
      setSuccess('Marketingconcept succesvol gegenereerd.');
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

  async function handleApproveAndPublish() {
    setError('');
    setSuccess('');

    try {
      await saveMutation.mutateAsync('draft');
      await api(`/drafts/${effectiveDraftId}/approve`, { method: 'POST' });
      await publishMutation.mutateAsync();
      setSuccess('Marketingpost is goedgekeurd en gepubliceerd op gekoppelde kanalen.');
    } catch (err) {
      setError(err.message || 'Publiceren is mislukt.');
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

  return (
    <div className="marketing-layout">
      <form className="marketing-form" onSubmit={handleGenerate}>
        <label className="marketing-field">
          Onderwerp
          <input
            value={form.onderwerp}
            onChange={(event) => updateField('onderwerp', event.target.value)}
            required
          />
        </label>

        <div className="marketing-field">
          <span>Type</span>
          <div className="marketing-radio-group">
            {['Opdrachtgevers', 'Kandidaten'].map((value) => (
              <label key={value} className="marketing-radio-item">
                <input
                  type="radio"
                  name="marketing-type"
                  checked={form.type === value}
                  onChange={() => updateField('type', value)}
                />
                {value}
              </label>
            ))}
          </div>
        </div>

        <div className="marketing-field">
          <span>Kanalen</span>
          <div className="marketing-channel-group">
            {CHANNEL_OPTIONS.map((channel) => {
              const disabled = !configuredChannels.includes(channel.key);

              return (
                <label
                  key={channel.key}
                  className={`marketing-channel-item${disabled ? ' disabled' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={form.kanalen.includes(channel.key)}
                    onChange={() => toggleChannel(channel.key)}
                    disabled={disabled}
                  />
                  {channel.label}
                </label>
              );
            })}
          </div>
        </div>

        <div className="marketing-actions">
          <button type="submit" disabled={isBusy || brandQuery.isLoading}>
            Concept genereren
          </button>
        </div>
      </form>

      {isGenerating ? <div className="marketing-skeleton">Concept wordt gegenereerd...</div> : null}

      {effectiveDraftId && !isGenerating ? (
        <section className="marketing-preview">
          <h3>Voorbeeld en bewerken</h3>

          {criticusPassed !== null ? (
            <div className={`marketing-criticus ${criticusPassed ? 'pass' : 'fail'}`}>
              <strong>{criticusPassed ? 'Criticus: akkoord' : 'Criticus: aandacht nodig'}</strong>
              <p>{criticusNotes || 'Geen opmerkingen.'}</p>
            </div>
          ) : null}

          <div className="marketing-tabs">
            <button
              type="button"
              className={activeTab === 'linkedin_post' ? 'active' : ''}
              onClick={() => setActiveTab('linkedin_post')}
            >
              LinkedIn post
            </button>
            <button
              type="button"
              className={activeTab === 'social_nl' ? 'active' : ''}
              onClick={() => setActiveTab('social_nl')}
            >
              Facebook post
            </button>
            <button
              type="button"
              className={activeTab === 'instagram_caption' ? 'active' : ''}
              onClick={() => setActiveTab('instagram_caption')}
            >
              Instagram caption
            </button>
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

          <div className="marketing-image-block">
            <p className="marketing-label">Afbeelding preview</p>
            {imagePath ? (
              <img src={imagePath} alt="Marketing preview" className="marketing-preview-image" />
            ) : (
              <p className="marketing-muted">Nog geen afbeelding beschikbaar.</p>
            )}

            {role === 'owner' ? (
              <label className="marketing-upload">
                Eigen afbeelding uploaden (override)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleUploadOverride}
                  disabled={isBusy}
                />
              </label>
            ) : null}
          </div>

          <div className="marketing-actions">
            <button type="button" onClick={handleSaveDraft} disabled={isBusy}>
              Opslaan als concept
            </button>

            {role === 'recruiter' ? (
              <button type="button" onClick={handleSubmitForApproval} disabled={isBusy}>
                Indienen ter goedkeuring
              </button>
            ) : null}

            {role === 'owner' ? (
              <button type="button" onClick={handleApproveAndPublish} disabled={isBusy}>
                Goedkeuren en publiceren
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

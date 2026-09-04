import { useMemo, useRef, useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useAutosaveDraft, formatSavedAt } from '../hooks/useAutosaveDraft';
import useImagePath from '../hooks/useImagePath';
import useCriticus from '../hooks/useCriticus';
import { api } from '../lib/api';
import GenerationProgress from '../components/shared/GenerationProgress';
import StatusBadge from '../components/shared/StatusBadge';
import StatusStrip from '../components/shared/StatusStrip';
import StickyFooter from '../components/shared/StickyFooter';
import FormMessage from '../components/shared/FormMessage';
import '../components/shared/status-strip.css';
import '../components/shared/toast.css';
import './blog-aanmaken.css';

const BLOG_CATEGORIES = [
  'Uitzendwerk',
  'Bedrijfsnieuws',
  'Voor werkzoekenden',
  'Voor opdrachtgevers',
  'Wet- en regelgeving',
];

const DEFAULT_FORM = {
  onderwerp: '',
  categorie: 'Uitzendwerk',
  toon: '',
};

export default function BlogAanmaken() {
  const { role, user, refreshSession } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const draftIdParam = searchParams.get('draftId');
  const [draftId, setDraftId] = useState(draftIdParam);
  const [formEdits, setFormEdits] = useState({});
  const [contentEdits, setContentEdits] = useState({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const existingDraftQuery = useQuery({
    queryKey: ['draft-detail-blog', draftIdParam],
    queryFn: () => api(`/drafts/${draftIdParam}`),
    enabled: Boolean(draftIdParam),
  });

  const loadedDraft = existingDraftQuery.data?.draft;

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
      blog_titel: loadedDraft?.blog_titel || '',
      blog_html: loadedDraft?.blog_html || '',
      teaser: loadedDraft?.form_data?.teaser || '',
      lead: loadedDraft?.form_data?.lead || '',
      ...contentEdits,
    }),
    [loadedDraft, contentEdits]
  );

  const [imagePath, setImagePathOverride] = useImagePath(loadedDraft);
  const autosave = useAutosaveDraft(draftId, form);
  const {
    passed: criticusPassed,
    notes: criticusNotes,
    setOverride: setCriticusOverride,
  } = useCriticus(loadedDraft);

  const effectiveDraftId = draftId || draftIdParam;

  // Poll for background criticus + image
  const pollCountRef = useRef(0);
  useEffect(() => {
    const needsCriticus = criticusPassed === null;
    const needsImage = !imagePath;
    if ((!needsCriticus && !needsImage) || !effectiveDraftId || isGenerating) {
      pollCountRef.current = 0;
      return;
    }
    const interval = setInterval(() => {
      pollCountRef.current += 1;
      if (pollCountRef.current > 8) { clearInterval(interval); return; }
      if (!draftIdParam) return;
      existingDraftQuery.refetch();
    }, 2000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criticusPassed, imagePath, effectiveDraftId, isGenerating, draftIdParam]);

  const saveMutation = useMutation({
    mutationFn: (status) =>
      api(`/drafts/${effectiveDraftId}`, {
        method: 'PUT',
        body: JSON.stringify({
          blog_titel: content.blog_titel,
          blog_html: content.blog_html,
          form_data: {
            ...form,
            teaser: content.teaser,
            lead: content.lead,
          },
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
    mutationFn: () =>
      api(`/publish/${effectiveDraftId}`, {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  });

  function updateField(key, value) {
    setFormEdits((prev) => ({ ...prev, [key]: value }));
  }

  async function handleUploadOverride(event) {
    const file = event.target.files?.[0];
    if (!file || !effectiveDraftId) return;
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
    if (event?.preventDefault) event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.onderwerp.trim()) {
      setError('Vul een onderwerp in.');
      return;
    }

    setIsGenerating(true);

    try {
      let targetDraftId = draftId;

      if (!targetDraftId) {
        const created = await api('/drafts', {
          method: 'POST',
          body: JSON.stringify({ type: 'blog', formData: form }),
        });
        targetDraftId = created?.draft?.id;
        setDraftId(targetDraftId);
        setSearchParams(
          (prev) => { const next = new URLSearchParams(prev); next.set('draftId', targetDraftId); return next; },
          { replace: true }
        );
        if (!user?.onboarded_at) refreshSession();
      }

      const generated = await api(`/drafts/${targetDraftId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ formData: form }),
      });

      setContentEdits({
        blog_titel: generated?.draft?.blog_titel || '',
        blog_html: generated?.draft?.blog_html || '',
        teaser: generated?.draft?.form_data?.teaser || '',
        lead: generated?.draft?.form_data?.lead || '',
      });
      setImagePathOverride(generated?.draft?.image_path || '');
      setCriticusOverride({
        passed: typeof generated?.draft?.criticus_passed === 'boolean' ? generated.draft.criticus_passed : null,
        notes: generated?.draft?.criticus_notes || '',
      });
      setSuccess('Blogartikel succesvol gegenereerd.');
    } catch (err) {
      setError(err.message || 'Genereren is mislukt.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSaveDraft() {
    setError(''); setSuccess('');
    try {
      await saveMutation.mutateAsync('draft');
      setSuccess('Concept opgeslagen.');
    } catch (err) {
      setError(err.message || 'Opslaan is mislukt.');
    }
  }

  async function handleSubmitForApproval() {
    setError(''); setSuccess('');
    try {
      await saveMutation.mutateAsync('draft');
      await submitForApprovalMutation.mutateAsync();
      setSuccess('Blogartikel ingediend ter goedkeuring.');
    } catch (err) {
      setError(err.message || 'Indienen is mislukt.');
    }
  }

  async function handleApproveAndPublish() {
    setError(''); setSuccess('');
    try {
      await saveMutation.mutateAsync('draft');
      await api(`/drafts/${effectiveDraftId}/approve`, { method: 'POST' });
    } catch (err) {
      setError(err.message || 'Goedkeuren is mislukt.');
      return;
    }
    try {
      await publishMutation.mutateAsync();
      setSuccess('Blogartikel is goedgekeurd en gepubliceerd op de website.');
    } catch (err) {
      setError(`Goedgekeurd, maar publiceren is mislukt: ${err.message || 'Onbekende fout.'}`);
    }
  }

  const isBusy =
    isGenerating || saveMutation.isPending || submitForApprovalMutation.isPending || publishMutation.isPending;

  if (existingDraftQuery.isLoading) return <p>Concept wordt geladen...</p>;

  if (role === 'viewer') {
    return (
      <div className="blog-layout">
        <div className="viewer-readonly-banner">
          Je hebt leesrechten. Je kunt geen blogartikelen aanmaken of bewerken.
        </div>
      </div>
    );
  }

  const autosaveLabel = autosave.isSaving
    ? 'Opslaan...'
    : autosave.error
    ? autosave.error
    : formatSavedAt(autosave.savedAt);

  const hasContent = content.blog_titel || content.blog_html;
  const draftStatus = loadedDraft?.status || 'draft';

  return (
    <div className="blog-layout">
      {loadedDraft && <StatusStrip status={draftStatus} type="blog" />}

      <form className="blog-form" onSubmit={handleGenerate}>
        {draftId && autosaveLabel ? (
          <div className={`autosave-indicator${autosave.error ? ' error' : ''}`}>
            {autosaveLabel}
          </div>
        ) : null}

        <label className="blog-field">
          Onderwerp
          <textarea
            value={form.onderwerp}
            onChange={(e) => updateField('onderwerp', e.target.value)}
            placeholder="Bijv. Hoe werkt uitzenden in de logistiek?"
            rows={3}
            required
          />
        </label>

        <label className="blog-field">
          Categorie
          <select value={form.categorie} onChange={(e) => updateField('categorie', e.target.value)}>
            {BLOG_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </label>

        <label className="blog-field">
          Toon (optioneel)
          <input
            value={form.toon}
            onChange={(e) => updateField('toon', e.target.value)}
            placeholder="Bijv. informeel, gericht op starters"
          />
        </label>

        <FormMessage error={error} success={success} />

        <button type="submit" className="btn-primary" disabled={isBusy}>
          {isGenerating ? 'Bezig met genereren...' : draftId ? 'Opnieuw genereren' : 'Genereer blogartikel'}
        </button>
      </form>

      {isGenerating && <GenerationProgress label="Blogartikel wordt gegenereerd..." />}

      {hasContent && !isGenerating && (
        <div className="blog-preview">
          <h2 className="blog-preview-heading">Preview</h2>

          {criticusPassed !== null && (
            <div className={`criticus-result ${criticusPassed ? 'pass' : 'fail'}`}>
              <strong>Criticus:</strong>{' '}
              {criticusPassed ? 'Goedgekeurd' : 'Afgekeurd'}
              {criticusNotes ? ` — ${criticusNotes}` : ''}
            </div>
          )}

          <label className="blog-field">
            Titel
            <input
              value={content.blog_titel}
              onChange={(e) => setContentEdits((prev) => ({ ...prev, blog_titel: e.target.value }))}
            />
          </label>

          <label className="blog-field">
            Lead (openingszin)
            <textarea
              value={content.lead}
              onChange={(e) => setContentEdits((prev) => ({ ...prev, lead: e.target.value }))}
              rows={2}
            />
          </label>

          <label className="blog-field">
            Teaser (voor overzichtspagina)
            <textarea
              value={content.teaser}
              onChange={(e) => setContentEdits((prev) => ({ ...prev, teaser: e.target.value }))}
              rows={2}
              maxLength={220}
            />
            <span className="char-count">{content.teaser.length}/220</span>
          </label>

          <label className="blog-field">
            Inhoud (HTML)
            <textarea
              className="blog-html-editor"
              value={content.blog_html}
              onChange={(e) => setContentEdits((prev) => ({ ...prev, blog_html: e.target.value }))}
              rows={16}
            />
          </label>

          {imagePath && (
            <div className="blog-image-preview">
              <h3>Header afbeelding</h3>
              <img src={imagePath.startsWith('/') ? imagePath : `/${imagePath}`} alt="Blog header" />
            </div>
          )}

          <label className="blog-field">
            Afbeelding overschrijven
            <input type="file" accept="image/*" onChange={handleUploadOverride} disabled={!effectiveDraftId} />
          </label>

          <StickyFooter>
            <button type="button" className="btn-secondary" onClick={handleSaveDraft} disabled={isBusy}>
              Opslaan als concept
            </button>
            {role !== 'owner' && (
              <button type="button" className="btn-primary" onClick={handleSubmitForApproval} disabled={isBusy}>
                Indienen ter goedkeuring
              </button>
            )}
            {role === 'owner' && (
              <button type="button" className="btn-primary" onClick={handleApproveAndPublish} disabled={isBusy}>
                Goedkeuren en publiceren
              </button>
            )}
          </StickyFooter>
        </div>
      )}
    </div>
  );
}

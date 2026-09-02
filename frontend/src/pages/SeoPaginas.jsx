import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';

import FormMessage from '@/components/shared/FormMessage';
import StatusBadge from '@/components/shared/StatusBadge';
import Card, { CardHeader, CardBody } from '@/components/shared/Card';
import '@/components/shared/card.css';
import '@/components/shared/status-strip.css';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

// Utility-class helper — vervangt cn(...) uit @/lib/utils.
function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

// Tailwind-classes voor form-controls (matched met Login-migratie zodat vormen
// tool-breed identiek zijn).
const INPUT_CLASS =
  'border-input flex h-10 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] md:text-sm';
const TEXTAREA_CLASS =
  'border-input flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/40 focus-visible:ring-[3px] md:text-sm';
const LABEL_CLASS = 'text-sm font-display font-bold';
const BUTTON_PRIMARY =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-primary px-5 py-2 text-sm font-display font-extrabold text-primary-foreground shadow-xs outline-none transition-all hover:bg-brand-red-600 active:bg-brand-red-700 focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50';
const BUTTON_OUTLINE =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md border-2 border-primary bg-transparent px-5 py-2 text-sm font-display font-extrabold text-primary outline-none transition-all hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50';
const BUTTON_SECONDARY =
  'inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-md bg-grey-800 px-5 py-2 text-sm font-display font-extrabold text-white shadow-xs outline-none transition-all hover:bg-grey-900 focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50';
const BUTTON_GHOST =
  'inline-flex h-9 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3.5 py-2 text-sm font-display font-extrabold text-foreground outline-none transition-all hover:bg-grey-100 focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50';
const BUTTON_GHOST_SM = BUTTON_GHOST;

// Tab-trigger styling — matcht de gedeelde .preview-tabs button pattern via
// Tailwind zodat SeoPaginas visueel aansluit bij Vacature/Marketing tabs.
const TAB_TRIGGER =
  'inline-flex h-9 items-center rounded-md border-1.5 border-border-strong bg-grey-50 px-3 py-1.5 text-sm font-display font-semibold transition-colors hover:border-light-red-300 hover:bg-light-red-50';
const TAB_TRIGGER_ACTIVE = 'border-primary bg-primary text-primary-foreground font-bold';

const DOELGROEP_OPTIONS = [
  { key: 'werkzoekenden', label: 'Werkzoekenden' },
  { key: 'opdrachtgevers', label: 'Opdrachtgevers' },
];

const DEFAULT_FORM = {
  sector: '',
  locatie: 'Rotterdam',
  doelgroep: 'werkzoekenden',
  keywords: '',
};

const EMPTY_CONTENT = {
  metaTitle: '',
  metaDescription: '',
  h1: '',
  bodyHtml: '',
  keywords: '',
};

const PREVIEW_TABS = [
  { key: 'metaTitle', label: 'Meta titel' },
  { key: 'metaDescription', label: 'Meta omschrijving' },
  { key: 'h1', label: 'H1' },
  { key: 'bodyHtml', label: 'Body (HTML)' },
  { key: 'keywords', label: 'Zoekwoorden' },
];

function formatDate(value) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
}

function doelgroepLabel(key) {
  return DOELGROEP_OPTIONS.find((option) => option.key === key)?.label || key;
}

export default function SeoPaginas() {
  const { role, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const seoIdParam = searchParams.get('seoId');

  const [form, setForm] = useState(DEFAULT_FORM);
  const [pageId, setPageId] = useState(null);
  const [content, setContent] = useState(EMPTY_CONTENT);
  const [activeTab, setActiveTab] = useState('metaTitle');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const listQuery = useQuery({
    queryKey: ['seo-pages'],
    queryFn: () => api('/seo'),
  });

  useQuery({
    queryKey: ['seo-page-detail', seoIdParam],
    queryFn: () => api(`/seo/${seoIdParam}`),
    enabled: Boolean(seoIdParam),
    onSuccess: (result) => {
      const page = result?.page;
      if (!page) {
        return;
      }

      setPageId(page.id);
      setForm({
        sector: page.sector || '',
        locatie: page.locatie || 'Rotterdam',
        doelgroep: page.doelgroep || 'werkzoekenden',
        keywords: page.keywords || '',
      });
      setContent({
        metaTitle: page.metaTitle || '',
        metaDescription: page.metaDescription || '',
        h1: page.h1 || '',
        bodyHtml: page.bodyHtml || '',
        keywords: page.keywords || '',
      });
      setActiveTab('metaTitle');
    },
  });

  const saveMutation = useMutation({
    mutationFn: (status) =>
      api(`/seo/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify({ ...content, status }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seo-pages'] }),
  });

  const submitMutation = useMutation({
    mutationFn: () => api(`/seo/${pageId}/submit`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seo-pages'] }),
  });

  const publishMutation = useMutation({
    mutationFn: () => api(`/seo/${pageId}/publish`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seo-pages'] }),
  });

  const approveMutation = useMutation({
    mutationFn: (id) => api(`/seo/${id}/approve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seo-pages'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/seo/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seo-pages'] }),
  });

  const pages = listQuery.data?.pages || [];
  const hasContent = useMemo(
    () => Object.values(content).some((value) => value),
    [content],
  );

  function updateFormField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetEditor() {
    setPageId(null);
    setForm(DEFAULT_FORM);
    setContent(EMPTY_CONTENT);
    setError('');
    setSuccess('');
    if (seoIdParam) {
      setSearchParams({});
    }
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!form.sector.trim() || !form.locatie.trim()) {
      setError('Sector en locatie zijn verplicht.');
      return;
    }

    setIsGenerating(true);

    try {
      let targetId = pageId;

      if (!targetId) {
        const created = await api('/seo', {
          method: 'POST',
          body: JSON.stringify(form),
        });

        targetId = created?.page?.id;
        setPageId(targetId);
      }

      const generated = await api(`/seo/${targetId}/generate`, { method: 'POST' });
      const page = generated?.page;

      setContent({
        metaTitle: page?.metaTitle || '',
        metaDescription: page?.metaDescription || '',
        h1: page?.h1 || '',
        bodyHtml: page?.bodyHtml || '',
        keywords: page?.keywords || '',
      });
      setActiveTab('metaTitle');
      setSuccess('SEO-pagina succesvol gegenereerd.');
      queryClient.invalidateQueries({ queryKey: ['seo-pages'] });
    } catch (err) {
      setError(err.message || 'Genereren is mislukt.');
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleSave() {
    setError('');
    setSuccess('');
    try {
      await saveMutation.mutateAsync('draft');
      setSuccess('Pagina opgeslagen.');
    } catch (err) {
      setError(err.message || 'Opslaan is mislukt.');
    }
  }

  async function handleSubmit() {
    setError('');
    setSuccess('');
    try {
      await saveMutation.mutateAsync('draft');
      await submitMutation.mutateAsync();
      setSuccess('Pagina ingediend ter goedkeuring.');
    } catch (err) {
      setError(err.message || 'Indienen is mislukt.');
    }
  }

  async function handlePublish() {
    setError('');
    setSuccess('');
    try {
      await saveMutation.mutateAsync('approved');
      await publishMutation.mutateAsync();
      setSuccess('Pagina goedgekeurd. Publicatie naar de nieuwe website volgt zodra de koppeling actief is.');
    } catch (err) {
      setError(err.message || 'Publiceren is mislukt.');
    }
  }

  async function handleApprove(id) {
    setError('');
    try {
      await approveMutation.mutateAsync(id);
    } catch (err) {
      setError(err.message || 'Goedkeuren mislukt.');
    }
  }

  async function handleDelete(id) {
    setError('');
    if (!window.confirm('Weet je zeker dat je deze SEO-pagina wilt verwijderen?')) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(id);
      if (id === pageId) {
        resetEditor();
      }
    } catch (err) {
      setError(err.message || 'Verwijderen mislukt.');
    }
  }

  function handleEdit(id) {
    setSearchParams({ seoId: id });
  }

  const isBusy =
    isGenerating ||
    saveMutation.isPending ||
    submitMutation.isPending ||
    publishMutation.isPending;

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader
          title={pageId ? 'SEO-pagina bewerken' : 'Nieuwe SEO-pagina'}
          action={
            pageId ? (
              <button type="button" className={BUTTON_GHOST_SM} onClick={resetEditor}>
                Nieuwe pagina
              </button>
            ) : null
          }
        />
        <CardBody>
          <form className="grid gap-5" onSubmit={handleGenerate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label htmlFor="sector" className={LABEL_CLASS}>Sector</label>
                <input
                  id="sector"
                  placeholder="bv. Productie, Logistiek, Pluimvee"
                  value={form.sector}
                  onChange={(event) => updateFormField('sector', event.target.value)}
                  required
                  className={INPUT_CLASS}
                />
              </div>

              <div className="grid gap-2">
                <label htmlFor="locatie" className={LABEL_CLASS}>Locatie</label>
                <input
                  id="locatie"
                  value={form.locatie}
                  onChange={(event) => updateFormField('locatie', event.target.value)}
                  required
                  className={INPUT_CLASS}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <span className={LABEL_CLASS}>Doelgroep</span>
              <div className="inline-flex w-fit rounded-md border border-border p-1">
                {DOELGROEP_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => updateFormField('doelgroep', option.key)}
                    className={cx(
                      'rounded-sm px-4 py-1.5 text-sm font-display font-bold transition-colors',
                      form.doelgroep === option.key
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <label htmlFor="keywords" className={LABEL_CLASS}>Zoekwoorden (optioneel)</label>
              <input
                id="keywords"
                placeholder="komma-gescheiden, bv. uitzendbureau, productiewerk"
                value={form.keywords}
                onChange={(event) => updateFormField('keywords', event.target.value)}
                className={INPUT_CLASS}
              />
            </div>

            <FormMessage variant="error">{error}</FormMessage>

            <div className="flex justify-end">
              <button type="submit" disabled={isBusy} className={BUTTON_PRIMARY}>
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {pageId ? 'Opnieuw genereren' : 'Pagina aanmaken & genereren'}
              </button>
            </div>
          </form>
        </CardBody>
      </Card>

      {isGenerating ? (
        <Card>
          <CardBody>
            <div className="flex items-center gap-3 py-8 text-muted-foreground">
              <Loader2 className="size-5 animate-spin text-primary" />
              SEO-pagina wordt gegenereerd...
            </div>
          </CardBody>
        </Card>
      ) : null}

      {pageId && hasContent && !isGenerating ? (
        <Card>
          <CardHeader title="Voorbeeld en bewerken" />
          <CardBody>
            <div className="grid gap-4">
              {/* Tabs — plain button-group; matcht .preview-tabs pattern via Tailwind. */}
              <div className="flex flex-wrap gap-2" role="tablist">
                {PREVIEW_TABS.map((tab) => {
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTab(tab.key)}
                      className={cx(TAB_TRIGGER, isActive && TAB_TRIGGER_ACTIVE)}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'bodyHtml' ? (
                <textarea
                  className={cx(TEXTAREA_CLASS, 'min-h-72 font-mono text-sm')}
                  value={content.bodyHtml}
                  onChange={(event) =>
                    setContent((prev) => ({ ...prev, bodyHtml: event.target.value }))
                  }
                />
              ) : (
                <textarea
                  className={cx(
                    TEXTAREA_CLASS,
                    'font-mono text-sm',
                    activeTab === 'metaDescription' ? 'min-h-24' : 'min-h-16',
                  )}
                  value={content[activeTab] || ''}
                  onChange={(event) =>
                    setContent((prev) => ({ ...prev, [activeTab]: event.target.value }))
                  }
                />
              )}

              <FormMessage variant="success">{success}</FormMessage>

              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" onClick={handleSave} disabled={isBusy} className={BUTTON_OUTLINE}>
                  Opslaan als concept
                </button>

                {role === 'recruiter' ? (
                  <button type="button" onClick={handleSubmit} disabled={isBusy} className={BUTTON_SECONDARY}>
                    Indienen ter goedkeuring
                  </button>
                ) : null}

                {role === 'owner' ? (
                  <button type="button" onClick={handlePublish} disabled={isBusy} className={BUTTON_PRIMARY}>
                    Goedkeuren en publiceren
                  </button>
                ) : null}
              </div>
            </div>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="SEO-pagina's" />
        <CardBody>
          {listQuery.isLoading ? (
            <div className="card-loading">
              <div className="card-loading-skeleton">Laden...</div>
            </div>
          ) : listQuery.isError ? (
            <FormMessage variant="error">Kon SEO-pagina&apos;s niet laden.</FormMessage>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3 font-display font-semibold">Slug</th>
                    <th className="py-2 pr-3 font-display font-semibold">Sector</th>
                    <th className="py-2 pr-3 font-display font-semibold">Locatie</th>
                    <th className="py-2 pr-3 font-display font-semibold">Doelgroep</th>
                    <th className="py-2 pr-3 font-display font-semibold">Status</th>
                    <th className="py-2 pr-3 font-display font-semibold">Aangemaakt</th>
                    <th className="py-2 pr-3 font-display font-semibold">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {pages.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-4 text-muted-foreground">
                        Nog geen SEO-pagina&apos;s.
                      </td>
                    </tr>
                  ) : (
                    pages.map((page) => {
                      const isOwner = role === 'owner';
                      const isOwnDraft = role === 'recruiter' && page.createdBy === user?.id;

                      return (
                        <tr key={page.id} className="border-b border-border/60 align-top">
                          <td className="py-2 pr-3 font-mono text-xs whitespace-normal">/{page.slug}</td>
                          <td className="py-2 pr-3 font-medium">{page.sector}</td>
                          <td className="py-2 pr-3">{page.locatie}</td>
                          <td className="py-2 pr-3">
                            <span className="pill-base pill-tone-muted">{doelgroepLabel(page.doelgroep)}</span>
                          </td>
                          <td className="py-2 pr-3">
                            <StatusBadge status={page.status} />
                          </td>
                          <td className="py-2 pr-3">{formatDate(page.createdAt)}</td>
                          <td className="py-2 pr-3">
                            <div className="flex flex-wrap gap-2">
                              <button type="button" onClick={() => handleEdit(page.id)} className={BUTTON_GHOST_SM}>
                                Bewerken
                              </button>
                              {isOwner && page.status === 'pending_approval' ? (
                                <button
                                  type="button"
                                  onClick={() => handleApprove(page.id)}
                                  disabled={approveMutation.isPending}
                                  className={BUTTON_PRIMARY}
                                >
                                  Goedkeuren
                                </button>
                              ) : null}
                              {isOwner || isOwnDraft ? (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(page.id)}
                                  disabled={deleteMutation.isPending}
                                  className={BUTTON_OUTLINE}
                                >
                                  Verwijderen
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

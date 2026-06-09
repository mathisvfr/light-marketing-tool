import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';

import FormMessage from '@/components/shared/FormMessage';
import StatusBadge from '@/components/shared/StatusBadge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

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

  const detailQuery = useQuery({
    queryKey: ['seo-page-detail', seoIdParam],
    queryFn: () => api(`/seo/${seoIdParam}`),
    enabled: Boolean(seoIdParam),
  });

  useEffect(() => {
    const page = detailQuery.data?.page;

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
  }, [detailQuery.data]);

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
      setSuccess('Pagina goedgekeurd en gepubliceerd naar WordPress.');
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
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-lg">
              {pageId ? 'SEO-pagina bewerken' : 'Nieuwe SEO-pagina'}
            </CardTitle>
            {pageId ? (
              <Button variant="ghost" size="sm" onClick={resetEditor}>
                Nieuwe pagina
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleGenerate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="sector">Sector</Label>
                <Input
                  id="sector"
                  placeholder="bv. Productie, Logistiek, Pluimvee"
                  value={form.sector}
                  onChange={(event) => updateFormField('sector', event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="locatie">Locatie</Label>
                <Input
                  id="locatie"
                  value={form.locatie}
                  onChange={(event) => updateFormField('locatie', event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Doelgroep</Label>
              <div className="inline-flex w-fit rounded-md border border-border p-1">
                {DOELGROEP_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => updateFormField('doelgroep', option.key)}
                    className={cn(
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
              <Label htmlFor="keywords">Zoekwoorden (optioneel)</Label>
              <Input
                id="keywords"
                placeholder="komma-gescheiden, bv. uitzendbureau, productiewerk"
                value={form.keywords}
                onChange={(event) => updateFormField('keywords', event.target.value)}
              />
            </div>

            <FormMessage variant="error">{error}</FormMessage>

            <div className="flex justify-end">
              <Button type="submit" disabled={isBusy}>
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                {pageId ? 'Opnieuw genereren' : 'Pagina aanmaken & genereren'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isGenerating ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            SEO-pagina wordt gegenereerd...
          </CardContent>
        </Card>
      ) : null}

      {pageId && hasContent && !isGenerating ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Voorbeeld en bewerken</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap">
                {PREVIEW_TABS.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {activeTab === 'bodyHtml' ? (
              <Textarea
                className="min-h-72 font-mono text-sm"
                value={content.bodyHtml}
                onChange={(event) =>
                  setContent((prev) => ({ ...prev, bodyHtml: event.target.value }))
                }
              />
            ) : (
              <Textarea
                className={cn(
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
              <Button variant="outline" onClick={handleSave} disabled={isBusy}>
                Opslaan als concept
              </Button>

              {role === 'recruiter' ? (
                <Button variant="secondary" onClick={handleSubmit} disabled={isBusy}>
                  Indienen ter goedkeuring
                </Button>
              ) : null}

              {role === 'owner' ? (
                <Button onClick={handlePublish} disabled={isBusy}>
                  Goedkeuren en publiceren
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">SEO-pagina&apos;s</CardTitle>
        </CardHeader>
        <CardContent className="py-2">
          {listQuery.isLoading ? (
            <Skeleton className="h-32" />
          ) : listQuery.isError ? (
            <FormMessage variant="error">Kon SEO-pagina&apos;s niet laden.</FormMessage>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Locatie</TableHead>
                  <TableHead>Doelgroep</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aangemaakt</TableHead>
                  <TableHead>Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-muted-foreground">
                      Nog geen SEO-pagina&apos;s.
                    </TableCell>
                  </TableRow>
                ) : (
                  pages.map((page) => {
                    const isOwner = role === 'owner';
                    const isOwnDraft = role === 'recruiter' && page.createdBy === user?.id;

                    return (
                      <TableRow key={page.id}>
                        <TableCell className="font-mono text-xs whitespace-normal">
                          /{page.slug}
                        </TableCell>
                        <TableCell className="font-medium">{page.sector}</TableCell>
                        <TableCell>{page.locatie}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {doelgroepLabel(page.doelgroep)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={page.status} />
                        </TableCell>
                        <TableCell>{formatDate(page.createdAt)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(page.id)}
                            >
                              Bewerken
                            </Button>
                            {isOwner && page.status === 'pending_approval' ? (
                              <Button
                                size="sm"
                                onClick={() => handleApprove(page.id)}
                                disabled={approveMutation.isPending}
                              >
                                Goedkeuren
                              </Button>
                            ) : null}
                            {isOwner || isOwnDraft ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(page.id)}
                                disabled={deleteMutation.isPending}
                              >
                                Verwijderen
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

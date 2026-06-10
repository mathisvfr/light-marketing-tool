import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';

import FormMessage from '@/components/shared/FormMessage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

const CHANNEL_OPTIONS = [
  { key: 'linkedin_jobs', label: 'LinkedIn Jobs' },
  { key: 'indeed', label: 'Indeed' },
  { key: 'facebook_instagram', label: 'Facebook/Instagram' },
  { key: 'wordpress', label: 'WordPress' },
  { key: 'google_mijn_bedrijf', label: 'Google Mijn Bedrijf' },
];

const DEFAULT_FORM = {
  functietitel: '',
  locatie: 'Rotterdam',
  urenPerWeek: '',
  startdatum: '',
  korteOmschrijving: '',
  taal: 'Nederlands',
  kanalen: [],
};

function createTabs(content) {
  const tabs = [
    { key: 'content_nl', label: 'Vacature tekst NL' },
    { key: 'social_nl', label: 'Social post NL' },
  ];

  if (content.content_pl) {
    tabs.push({ key: 'content_pl', label: 'Vacature tekst PL' });
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
  const [form, setForm] = useState(DEFAULT_FORM);
  const [draftId, setDraftId] = useState(null);
  const [content, setContent] = useState({
    content_nl: '',
    social_nl: '',
    content_pl: '',
    social_pl: '',
  });
  const [activeTab, setActiveTab] = useState('content_nl');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const brandQuery = useQuery({
    queryKey: ['brand-settings'],
    queryFn: () => api('/brand'),
  });

  const existingDraftQuery = useQuery({
    queryKey: ['draft-detail-vacature', draftIdParam],
    queryFn: () => api(`/drafts/${draftIdParam}`),
    enabled: Boolean(draftIdParam),
  });

  useEffect(() => {
    const draft = existingDraftQuery.data?.draft;

    if (!draft) {
      return;
    }

    setDraftId(draft.id);
    setForm((prev) => ({
      ...prev,
      ...(draft.form_data || {}),
      kanalen: Array.isArray(draft.form_data?.kanalen) ? draft.form_data.kanalen : [],
    }));
    setContent({
      content_nl: draft.content_nl || '',
      social_nl: draft.social_nl || '',
      content_pl: draft.content_pl || '',
      social_pl: draft.social_pl || '',
    });
  }, [existingDraftQuery.data]);

  const configuredChannels =
    brandQuery.data?.configuredChannels || CHANNEL_OPTIONS.map((c) => c.key);

  const tabs = useMemo(() => createTabs(content), [content]);

  const saveMutation = useMutation({
    mutationFn: (status) =>
      api(`/drafts/${draftId}`, {
        method: 'PUT',
        body: JSON.stringify({
          content_nl: content.content_nl,
          social_nl: content.social_nl,
          content_pl: content.content_pl,
          social_pl: content.social_pl,
          status,
        }),
      }),
  });

  const submitForApprovalMutation = useMutation({
    mutationFn: () => api(`/drafts/${draftId}/submit`, { method: 'POST' }),
  });

  const publishMutation = useMutation({
    mutationFn: () => api(`/publish/${draftId}`, { method: 'POST' }),
  });

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChannel(channelKey) {
    setForm((prev) => {
      const exists = prev.kanalen.includes(channelKey);
      if (exists) {
        return { ...prev, kanalen: prev.kanalen.filter((item) => item !== channelKey) };
      }

      return { ...prev, kanalen: [...prev.kanalen, channelKey] };
    });
  }

  async function handleGenerate(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (form.korteOmschrijving.length > 400) {
      setError('Korte omschrijving mag maximaal 400 tekens bevatten.');
      return;
    }

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
          body: JSON.stringify({ formData: form }),
        });

        targetDraftId = created?.draft?.id;
        setDraftId(targetDraftId);
      }

      const generated = await api(`/drafts/${targetDraftId}/generate`, {
        method: 'POST',
      });

      const nextContent = {
        content_nl: generated?.draft?.content_nl || '',
        social_nl: generated?.draft?.social_nl || '',
        content_pl: generated?.draft?.content_pl || '',
        social_pl: generated?.draft?.social_pl || '',
      };

      setContent(nextContent);
      setActiveTab('content_nl');
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

  async function handleApproveAndPublish() {
    setError('');
    setSuccess('');

    try {
      await saveMutation.mutateAsync('approved');
      await publishMutation.mutateAsync();
      setSuccess('Concept goedgekeurd en gepubliceerd.');
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
    return <Skeleton className="h-64" />;
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Vacaturegegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleGenerate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="functietitel">Functietitel</Label>
                <Input
                  id="functietitel"
                  value={form.functietitel}
                  onChange={(event) => updateField('functietitel', event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="locatie">Locatie</Label>
                <Input
                  id="locatie"
                  value={form.locatie}
                  onChange={(event) => updateField('locatie', event.target.value)}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="urenPerWeek">Uren per week</Label>
                <Input
                  id="urenPerWeek"
                  type="number"
                  min="1"
                  value={form.urenPerWeek}
                  onChange={(event) => updateField('urenPerWeek', event.target.value)}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="startdatum">Startdatum</Label>
                <Input
                  id="startdatum"
                  type="date"
                  value={form.startdatum}
                  onChange={(event) => updateField('startdatum', event.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="korteOmschrijving">Korte omschrijving</Label>
              <Textarea
                id="korteOmschrijving"
                value={form.korteOmschrijving}
                onChange={(event) => updateField('korteOmschrijving', event.target.value)}
                maxLength={400}
                rows={4}
                required
              />
              <span className="text-right text-xs text-muted-foreground">
                {form.korteOmschrijving.length}/400 tekens
              </span>
            </div>

            <div className="grid gap-2">
              <Label>Taal</Label>
              <div className="inline-flex w-fit rounded-md border border-border p-1">
                {['Nederlands', 'Nederlands + Pools'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateField('taal', value)}
                    className={cn(
                      'rounded-sm px-4 py-1.5 text-sm font-display font-bold transition-colors',
                      form.taal === value
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Kanalen</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {CHANNEL_OPTIONS.map((channel) => {
                  const disabled = !configuredChannels.includes(channel.key);
                  return (
                    <label
                      key={channel.key}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm',
                        disabled
                          ? 'cursor-not-allowed opacity-50'
                          : 'cursor-pointer hover:border-brand-red-300',
                      )}
                    >
                      <Checkbox
                        checked={form.kanalen.includes(channel.key)}
                        onCheckedChange={() => toggleChannel(channel.key)}
                        disabled={disabled}
                      />
                      {channel.label}
                    </label>
                  );
                })}
              </div>
            </div>

            <FormMessage variant="error">{error}</FormMessage>

            <div className="flex justify-end">
              <Button type="submit" disabled={isBusy || brandQuery.isLoading}>
                {isGenerating ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                Concept genereren
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {isGenerating ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            Concept wordt gegenereerd...
          </CardContent>
        </Card>
      ) : null}

      {draftId && !isGenerating ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Voorbeeld en bewerken</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="flex-wrap">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.key} value={tab.key}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            <Textarea
              className="min-h-64 font-mono text-sm"
              value={content[activeTab] || ''}
              onChange={(event) =>
                setContent((prev) => ({
                  ...prev,
                  [activeTab]: event.target.value,
                }))
              }
            />

            <FormMessage variant="success">{success}</FormMessage>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={isBusy}>
                Opslaan als concept
              </Button>

              {role === 'recruiter' ? (
                <Button
                  variant="secondary"
                  onClick={handleSubmitForApproval}
                  disabled={isBusy}
                >
                  Indienen ter goedkeuring
                </Button>
              ) : null}

              {role === 'owner' ? (
                <Button onClick={handleApproveAndPublish} disabled={isBusy}>
                  Goedkeuren en publiceren
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!draftId ? <FormMessage variant="success">{success}</FormMessage> : null}
    </div>
  );
}

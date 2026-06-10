import { useEffect, useState } from 'react';
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
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'facebook_instagram', label: 'Facebook/Instagram' },
  { key: 'google_mijn_bedrijf', label: 'Google Mijn Bedrijf' },
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
  const [form, setForm] = useState(DEFAULT_FORM);
  const [draftId, setDraftId] = useState(null);
  const [activeTab, setActiveTab] = useState('linkedin_post');
  const [content, setContent] = useState({ linkedin_post: '', social_nl: '' });
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
      linkedin_post: draft.linkedin_post || '',
      social_nl: draft.social_nl || '',
    });
  }, [existingDraftQuery.data]);

  const configuredChannels =
    brandQuery.data?.configuredChannels || CHANNEL_OPTIONS.map((c) => c.key);

  const saveMutation = useMutation({
    mutationFn: (status) =>
      api(`/drafts/${draftId}`, {
        method: 'PUT',
        body: JSON.stringify({
          linkedin_post: content.linkedin_post,
          social_nl: content.social_nl,
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

      setContent({
        linkedin_post: generated?.draft?.linkedin_post || '',
        social_nl: generated?.draft?.social_nl || '',
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
          <CardTitle className="text-lg">Marketingpost</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-5" onSubmit={handleGenerate}>
            <div className="grid gap-2">
              <Label htmlFor="onderwerp">Onderwerp</Label>
              <Input
                id="onderwerp"
                value={form.onderwerp}
                onChange={(event) => updateField('onderwerp', event.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label>Type</Label>
              <div className="inline-flex w-fit rounded-md border border-border p-1">
                {['Opdrachtgevers', 'Kandidaten'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => updateField('type', value)}
                    className={cn(
                      'rounded-sm px-4 py-1.5 text-sm font-display font-bold transition-colors',
                      form.type === value
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
              <TabsList>
                <TabsTrigger value="linkedin_post">LinkedIn post</TabsTrigger>
                <TabsTrigger value="social_nl">Facebook/Instagram post</TabsTrigger>
              </TabsList>
            </Tabs>

            <Textarea
              className="min-h-56 font-mono text-sm"
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

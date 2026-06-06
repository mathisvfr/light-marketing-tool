import { useEffect, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import FormMessage from '@/components/shared/FormMessage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';

const CHANNEL_OPTIONS = [
  { key: 'linkedin_jobs', label: 'LinkedIn Jobs' },
  { key: 'indeed', label: 'Indeed' },
  { key: 'facebook_instagram', label: 'Facebook/Instagram' },
  { key: 'wordpress', label: 'WordPress' },
  { key: 'linkedin', label: 'LinkedIn (marketing)' },
];

const TEXT_FIELDS = [
  { key: 'bedrijfsnaam', label: 'Bedrijfsnaam', multiline: false },
  { key: 'tone_of_voice', label: 'Tone of voice', multiline: true },
  { key: 'aanbod_werknemers', label: 'Wat bieden wij werknemers', multiline: true },
  { key: 'aanbod_opdrachtgevers', label: 'Wat bieden wij opdrachtgevers', multiline: true },
  { key: 'doelgroep_werknemers', label: 'Doelgroep werknemers', multiline: true },
  { key: 'doelgroep_opdrachtgevers', label: 'Doelgroep opdrachtgevers', multiline: true },
];

const DEFAULT_SETTINGS = {
  bedrijfsnaam: '',
  tone_of_voice: '',
  aanbod_werknemers: '',
  aanbod_opdrachtgevers: '',
  doelgroep_werknemers: '',
  doelgroep_opdrachtgevers: '',
};

function getApiLabel(key) {
  const labels = {
    linkedin_jobs: 'LinkedIn Jobs webhook',
    indeed: 'Indeed webhook',
    facebook_instagram: 'Facebook/Instagram webhook',
    wordpress: 'WordPress webhook',
    linkedin: 'LinkedIn marketing webhook',
    anthropic: 'Anthropic API',
  };

  return labels[key] || key;
}

export default function MerkInstellingen() {
  const { role } = useAuth();
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [configuredChannels, setConfiguredChannels] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const brandQuery = useQuery({
    queryKey: ['brand-settings-owner'],
    queryFn: () => api('/brand'),
    enabled: role === 'owner',
  });

  useEffect(() => {
    if (!brandQuery.data) {
      return;
    }

    setSettings({
      bedrijfsnaam: brandQuery.data.settings?.bedrijfsnaam || '',
      tone_of_voice: brandQuery.data.settings?.tone_of_voice || '',
      aanbod_werknemers: brandQuery.data.settings?.aanbod_werknemers || '',
      aanbod_opdrachtgevers: brandQuery.data.settings?.aanbod_opdrachtgevers || '',
      doelgroep_werknemers: brandQuery.data.settings?.doelgroep_werknemers || '',
      doelgroep_opdrachtgevers: brandQuery.data.settings?.doelgroep_opdrachtgevers || '',
    });

    setConfiguredChannels(brandQuery.data.configuredChannels || []);
  }, [brandQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api('/brand', {
        method: 'PUT',
        body: JSON.stringify({
          settings,
          configuredChannels,
        }),
      }),
  });

  function updateField(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChannel(channelKey) {
    setConfiguredChannels((prev) => {
      if (prev.includes(channelKey)) {
        return prev.filter((item) => item !== channelKey);
      }

      return [...prev, channelKey];
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await saveMutation.mutateAsync();
      setSuccess('Merk instellingen opgeslagen.');
    } catch (err) {
      setError(err.message || 'Opslaan mislukt.');
    }
  }

  if (role !== 'owner') {
    return <p className="text-muted-foreground">Alleen eigenaren hebben toegang tot deze pagina.</p>;
  }

  if (brandQuery.isLoading) {
    return <Skeleton className="h-96" />;
  }

  if (brandQuery.isError) {
    return <FormMessage variant="error">Kon merk instellingen niet laden.</FormMessage>;
  }

  const apiStatus = brandQuery.data?.apiStatus || {};

  return (
    <form className="grid gap-6" onSubmit={handleSave}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Merkprofiel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5">
          {TEXT_FIELDS.map((field) => (
            <div key={field.key} className="grid gap-2">
              <Label htmlFor={`brand-${field.key}`}>{field.label}</Label>
              {field.multiline ? (
                <Textarea
                  id={`brand-${field.key}`}
                  rows={3}
                  value={settings[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                />
              ) : (
                <Input
                  id={`brand-${field.key}`}
                  value={settings[field.key]}
                  onChange={(event) => updateField(field.key, event.target.value)}
                />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Geconfigureerde kanalen</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {CHANNEL_OPTIONS.map((channel) => (
              <label
                key={channel.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2.5 text-sm hover:border-brand-red-300"
              >
                <Checkbox
                  checked={configuredChannels.includes(channel.key)}
                  onCheckedChange={() => toggleChannel(channel.key)}
                />
                {channel.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">API status</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(apiStatus).length === 0 ? (
            <p className="text-muted-foreground">Geen API-status beschikbaar.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {Object.entries(apiStatus).map(([key, isOk]) => (
                <div
                  key={key}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2.5 text-sm"
                >
                  <span>{getApiLabel(key)}</span>
                  <Badge
                    className={
                      isOk
                        ? 'border-transparent bg-success/15 text-success'
                        : 'border-transparent bg-destructive/15 text-destructive'
                    }
                  >
                    {isOk ? 'Verbonden' : 'Niet verbonden'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FormMessage variant="error">{error}</FormMessage>
      <FormMessage variant="success">{success}</FormMessage>

      <div className="flex justify-end">
        <Button type="submit" disabled={saveMutation.isPending}>
          Opslaan
        </Button>
      </div>
    </form>
  );
}

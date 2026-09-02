import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import Card, { CardHeader } from '../components/shared/Card';
import ChannelStatus from '../components/shared/ChannelStatus';
import FormMessage from '../components/shared/FormMessage';
import '../components/shared/card.css';
import '../components/shared/status-strip.css';
import '../components/shared/toast.css';
import './merk-instellingen.css';

const PROVIDER_OPTIONS = [
  { key: 'buffer', label: 'Buffer (LinkedIn/Facebook/Instagram)' },
];

const DEFAULT_SETTINGS = {
  bedrijfsnaam: '',
  tone_of_voice: '',
  aanbod_werknemers: '',
  aanbod_opdrachtgevers: '',
  doelgroep_werknemers: '',
  doelgroep_opdrachtgevers: '',
};

function getCredentialState(provider) {
  if (!provider?.hasAccessToken) {
    return 'disconnected';
  }

  if (!provider?.expiresAt) {
    return 'connected';
  }

  const expiresAt = new Date(provider.expiresAt);
  if (Number.isNaN(expiresAt.getTime())) {
    return 'connected';
  }

  const daysLeft = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (daysLeft <= 7) {
    return 'expiring';
  }

  return 'connected';
}

// getCredentialLabel is verwijderd — <ChannelStatus namespace="integrations">
// haalt het label uit /api/meta/statuses.

export default function MerkInstellingen() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [settingsEdits, setSettingsEdits] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const brandQuery = useQuery({
    queryKey: ['brand-settings-owner'],
    queryFn: () => api('/brand'),
  });

  const integrationsQuery = useQuery({
    queryKey: ['integrations-status-owner'],
    queryFn: () => api('/integrations'),
    enabled: role === 'owner',
  });

  const settings = useMemo(
    () => ({
      ...DEFAULT_SETTINGS,
      ...(brandQuery.data?.settings || {}),
      ...settingsEdits,
    }),
    [brandQuery.data, settingsEdits]
  );

  const providersByKey = useMemo(() => {
    const map = new Map();
    for (const provider of integrationsQuery.data?.providers || []) {
      map.set(provider.provider, provider);
    }

    return map;
  }, [integrationsQuery.data]);

  const bufferMetadata = providersByKey.get('buffer')?.metadata || {};

  const saveMutation = useMutation({
    mutationFn: () =>
      api('/brand', {
        method: 'PUT',
        body: JSON.stringify({
          settings,
        }),
      }),
  });

  const refreshBufferMutation = useMutation({
    mutationFn: () => api('/integrations/buffer/refresh-channels', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-status-owner'] });
    },
  });

  async function handleRefreshBufferChannels() {
    setError('');
    setSuccess('');

    try {
      const result = await refreshBufferMutation.mutateAsync();
      const found = Object.keys(result?.summary?.channelIds || {});
      setSuccess(
        found.length > 0
          ? `Buffer-kanalen bijgewerkt: ${found.join(', ')}.`
          : 'Geen Buffer-kanalen gevonden. Koppel LinkedIn/Facebook/Instagram eerst binnen Buffer.'
      );
    } catch (err) {
      setError(err.message || 'Buffer-kanalen verversen mislukt.');
    }
  }

  function updateField(key, value) {
    setSettingsEdits((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(event) {
    event.preventDefault();
    setError('');
    setSuccess('');

    try {
      await saveMutation.mutateAsync();
      setSuccess('Merk instellingen opgeslagen.');
      queryClient.invalidateQueries({ queryKey: ['brand-settings-owner'] });
    } catch (err) {
      setError(err.message || 'Opslaan mislukt.');
    }
  }

  if (role !== 'owner') {
    return <p>Alleen eigenaren hebben toegang tot deze pagina.</p>;
  }

  if (brandQuery.isLoading) {
    return <p>Merk instellingen worden geladen...</p>;
  }

  if (brandQuery.isError) {
    return <FormMessage variant="error">Kon merk instellingen niet laden.</FormMessage>;
  }

  return (
    <div className="brand-layout">
      <form className="brand-form" onSubmit={handleSave}>
        <label className="brand-field">
          Bedrijfsnaam
          <input
            value={settings.bedrijfsnaam}
            onChange={(event) => updateField('bedrijfsnaam', event.target.value)}
          />
        </label>

        <label className="brand-field">
          Tone of voice
          <textarea
            rows={3}
            value={settings.tone_of_voice}
            onChange={(event) => updateField('tone_of_voice', event.target.value)}
          />
        </label>

        <label className="brand-field">
          Wat bieden wij werknemers
          <textarea
            rows={3}
            value={settings.aanbod_werknemers}
            onChange={(event) => updateField('aanbod_werknemers', event.target.value)}
          />
        </label>

        <label className="brand-field">
          Wat bieden wij opdrachtgevers
          <textarea
            rows={3}
            value={settings.aanbod_opdrachtgevers}
            onChange={(event) => updateField('aanbod_opdrachtgevers', event.target.value)}
          />
        </label>

        <label className="brand-field">
          Doelgroep werknemers
          <textarea
            rows={3}
            value={settings.doelgroep_werknemers}
            onChange={(event) => updateField('doelgroep_werknemers', event.target.value)}
          />
        </label>

        <label className="brand-field">
          Doelgroep opdrachtgevers
          <textarea
            rows={3}
            value={settings.doelgroep_opdrachtgevers}
            onChange={(event) => updateField('doelgroep_opdrachtgevers', event.target.value)}
          />
        </label>

        <button type="submit" disabled={saveMutation.isPending}>
          Opslaan
        </button>
      </form>

      <Card className="brand-integrations">
        <CardHeader title="Kanaalkoppelingen" />
        {bufferMetadata.organizationName ? (
          <p className="brand-meta">
            Buffer organisatie: {bufferMetadata.organizationName}
            {bufferMetadata.channelNames?.linkedin
              ? ` · LinkedIn: ${bufferMetadata.channelNames.linkedin}`
              : ''}
            {bufferMetadata.channelNames?.facebook
              ? ` · Facebook: ${bufferMetadata.channelNames.facebook}`
              : ''}
            {bufferMetadata.channelNames?.instagram
              ? ` · Instagram: ${bufferMetadata.channelNames.instagram}`
              : ''}
          </p>
        ) : null}
        <div className="integration-grid">
          {PROVIDER_OPTIONS.map((provider) => {
            const row = providersByKey.get(provider.key);
            const state = getCredentialState(row);

            return (
              <Card key={provider.key} padding="sm" className="integration-card">
                <h4>{provider.label}</h4>
                <p>
                  Status: <ChannelStatus status={state} namespace="integrations" />
                </p>
                <p className="integration-hint">
                  Wordt beheerd via serverconfiguratie (.env).
                </p>
                {provider.key === 'buffer' ? (
                  <button
                    type="button"
                    onClick={handleRefreshBufferChannels}
                    disabled={refreshBufferMutation.isPending || state === 'disconnected'}
                  >
                    {refreshBufferMutation.isPending
                      ? 'Bezig met verversen...'
                      : 'Kanalen verversen'}
                  </button>
                ) : null}
              </Card>
            );
          })}
        </div>
      </Card>

      <FormMessage variant="error">{error}</FormMessage>
      <FormMessage variant="success">{success}</FormMessage>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { api } from '../lib/api';
import './merk-instellingen.css';

const CHANNEL_OPTIONS = [
  { key: 'linkedin_jobs', label: 'LinkedIn Jobs' },
  { key: 'indeed', label: 'Indeed' },
  { key: 'facebook_instagram', label: 'Facebook/Instagram' },
  { key: 'wordpress', label: 'WordPress' },
  { key: 'linkedin', label: 'LinkedIn (marketing)' },
];

const PROVIDER_OPTIONS = [
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'meta', label: 'Meta (Facebook/Instagram)' },
  { key: 'wordpress', label: 'WordPress' },
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

function getCredentialLabel(state) {
  if (state === 'connected') {
    return 'Verbonden';
  }

  if (state === 'expiring') {
    return 'Verloopt binnenkort';
  }

  return 'Opnieuw koppelen';
}

export default function MerkInstellingen() {
  const queryClient = useQueryClient();
  const { role } = useAuth();
  const [settingsEdits, setSettingsEdits] = useState({});
  const [configuredChannelsEdits, setConfiguredChannelsEdits] = useState(undefined);
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

  const configuredChannels =
    Array.isArray(configuredChannelsEdits)
      ? configuredChannelsEdits
      : brandQuery.data?.configuredChannels || [];

  const providersByKey = useMemo(() => {
    const map = new Map();
    for (const provider of integrationsQuery.data?.providers || []) {
      map.set(provider.provider, provider);
    }

    return map;
  }, [integrationsQuery.data]);

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

  const connectMutation = useMutation({
    mutationFn: ({ provider, accessToken, expiresAt }) =>
      api(`/integrations/${provider}`, {
        method: 'PUT',
        body: JSON.stringify({
          accessToken,
          expiresAt: expiresAt || null,
          metadata: {},
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integrations-status-owner'] });
    },
  });

  function updateField(key, value) {
    setSettingsEdits((prev) => ({ ...prev, [key]: value }));
  }

  function toggleChannel(channelKey) {
    setConfiguredChannelsEdits((prev) => {
      const source = Array.isArray(prev)
        ? prev
        : brandQuery.data?.configuredChannels || [];

      if (source.includes(channelKey)) {
        return source.filter((item) => item !== channelKey);
      }

      return [...source, channelKey];
    });
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

  async function handleConnect(providerKey, providerLabel) {
    setError('');
    setSuccess('');

    const accessToken = window.prompt(`${providerLabel}: plak access token`);
    if (!accessToken) {
      return;
    }

    const expiresAtInput = window.prompt(
      `${providerLabel}: vervaldatum (optioneel, ISO formaat, bv 2026-07-31T00:00:00Z)`
    );

    try {
      await connectMutation.mutateAsync({
        provider: providerKey,
        accessToken: accessToken.trim(),
        expiresAt: expiresAtInput ? expiresAtInput.trim() : null,
      });
      setSuccess(`${providerLabel} is bijgewerkt.`);
    } catch (err) {
      setError(err.message || 'Koppelen mislukt.');
    }
  }

  if (role !== 'owner') {
    return <p>Alleen eigenaren hebben toegang tot deze pagina.</p>;
  }

  if (brandQuery.isLoading) {
    return <p>Merk instellingen worden geladen...</p>;
  }

  if (brandQuery.isError) {
    return <p className="brand-error">Kon merk instellingen niet laden.</p>;
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

        <div className="brand-field">
          <span>Geconfigureerde kanalen</span>
          <div className="brand-channels">
            {CHANNEL_OPTIONS.map((channel) => (
              <label key={channel.key} className="brand-channel-item">
                <input
                  type="checkbox"
                  checked={configuredChannels.includes(channel.key)}
                  onChange={() => toggleChannel(channel.key)}
                />
                {channel.label}
              </label>
            ))}
          </div>
        </div>

        <button type="submit" disabled={saveMutation.isPending}>
          Opslaan
        </button>
      </form>

      <section className="brand-integrations">
        <h3>Kanaalkoppelingen</h3>
        <div className="integration-grid">
          {PROVIDER_OPTIONS.map((provider) => {
            const row = providersByKey.get(provider.key);
            const state = getCredentialState(row);
            const stateLabel = getCredentialLabel(state);
            const buttonLabel = state === 'disconnected' ? 'Koppelen' : 'Opnieuw koppelen';

            return (
              <article key={provider.key} className="integration-card">
                <h4>{provider.label}</h4>
                <p>
                  Status:{' '}
                  <span className={`integration-pill ${state}`}>
                    {stateLabel}
                  </span>
                </p>
                <button
                  type="button"
                  onClick={() => handleConnect(provider.key, provider.label)}
                  disabled={connectMutation.isPending || integrationsQuery.isLoading}
                >
                  {buttonLabel}
                </button>
              </article>
            );
          })}
        </div>
      </section>

      {error ? <p className="brand-error">{error}</p> : null}
      {success ? <p>{success}</p> : null}
    </div>
  );
}

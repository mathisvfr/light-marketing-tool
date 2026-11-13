import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import Card, { CardHeader, CardBody } from '../shared/Card';

function deriveFormState(data) {
  if (!data) {
    return {
      frequency: 'disabled',
      recipients: '',
      include_sections: ['vacatures', 'marketing', 'website'],
      include_ai_insights: true,
      day_of_month: 28,
      hour: 8,
    };
  }
  return {
    frequency: data.frequency || 'disabled',
    recipients: (data.recipients || []).join(', '),
    include_sections: data.include_sections || ['vacatures', 'marketing', 'website'],
    include_ai_insights: data.include_ai_insights !== false,
    day_of_month: data.day_of_month || 28,
    hour: data.hour ?? 8,
  };
}

export default function EmailReportSettings() {
  const queryClient = useQueryClient();
  // Track the data version we've synced from to detect external changes.
  const [syncedData, setSyncedData] = useState(null);
  const [form, setForm] = useState(() => deriveFormState(null));

  const configQuery = useQuery({
    queryKey: ['email-report-config'],
    queryFn: () => api('/rapportage/email-config'),
  });

  // Sync form from server data when query resolves (replaces useEffect).
  if (configQuery.data && configQuery.data !== syncedData) {
    setSyncedData(configQuery.data);
    setForm(deriveFormState(configQuery.data));
  }

  const saveMutation = useMutation({
    mutationFn: (body) => api('/rapportage/email-config', { method: 'PUT', body: JSON.stringify(body) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['email-report-config'] }),
  });

  const testMutation = useMutation({
    mutationFn: () => api('/rapportage/email-config/test', { method: 'POST' }),
  });

  function handleSave() {
    const recipients = form.recipients
      .split(/[,;\s]+/)
      .map((r) => r.trim())
      .filter((r) => r.includes('@'));

    saveMutation.mutate({
      frequency: form.frequency,
      recipients,
      include_sections: form.include_sections,
      include_ai_insights: form.include_ai_insights,
      day_of_month: form.day_of_month,
      hour: form.hour,
    });
  }

  function toggleSection(section) {
    setForm((prev) => {
      const sections = prev.include_sections.includes(section)
        ? prev.include_sections.filter((s) => s !== section)
        : [...prev.include_sections, section];
      return { ...prev, include_sections: sections };
    });
  }

  if (configQuery.isLoading) return null;

  return (
    <Card>
      <CardHeader title="E-mail rapportage" />
      <CardBody>
        <div className="rapportage-email-form">
          <div className="rapportage-email-field">
            <label htmlFor="email-frequency">Frequentie</label>
            <select
              id="email-frequency"
              value={form.frequency}
              onChange={(e) => setForm((prev) => ({ ...prev, frequency: e.target.value }))}
            >
              <option value="disabled">Uitgeschakeld</option>
              <option value="monthly">Maandelijks</option>
            </select>
          </div>

          {form.frequency !== 'disabled' && (
            <>
              <div className="rapportage-email-field">
                <label htmlFor="email-recipients">Ontvangers (komma-gescheiden)</label>
                <input
                  id="email-recipients"
                  type="text"
                  value={form.recipients}
                  onChange={(e) => setForm((prev) => ({ ...prev, recipients: e.target.value }))}
                  placeholder="vacature@lightpersoneelsdiensten.nl"
                />
              </div>

              <div className="rapportage-email-field">
                <label>Secties in rapport</label>
                <div className="rapportage-email-checks">
                  {['vacatures', 'marketing', 'website'].map((s) => (
                    <label key={s} className="rapportage-email-check">
                      <input
                        type="checkbox"
                        checked={form.include_sections.includes(s)}
                        onChange={() => toggleSection(s)}
                      />
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="rapportage-email-field">
                <label className="rapportage-email-check">
                  <input
                    type="checkbox"
                    checked={form.include_ai_insights}
                    onChange={(e) => setForm((prev) => ({ ...prev, include_ai_insights: e.target.checked }))}
                  />
                  AI-inzichten toevoegen
                </label>
              </div>

              <div className="rapportage-email-row">
                <div className="rapportage-email-field">
                  <label htmlFor="email-day">Dag van de maand</label>
                  <select
                    id="email-day"
                    value={form.day_of_month}
                    onChange={(e) => setForm((prev) => ({ ...prev, day_of_month: Number(e.target.value) }))}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="rapportage-email-field">
                  <label htmlFor="email-hour">Tijdstip</label>
                  <select
                    id="email-hour"
                    value={form.hour}
                    onChange={(e) => setForm((prev) => ({ ...prev, hour: Number(e.target.value) }))}
                  >
                    {Array.from({ length: 13 }, (_, i) => i + 6).map((h) => (
                      <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          <div className="rapportage-email-actions">
            <button
              type="button"
              className="btn-primary"
              disabled={saveMutation.isPending}
              onClick={handleSave}
            >
              {saveMutation.isPending ? 'Opslaan...' : 'Opslaan'}
            </button>

            {form.frequency !== 'disabled' && (
              <button
                type="button"
                className="btn-secondary"
                disabled={testMutation.isPending}
                onClick={() => testMutation.mutate()}
              >
                {testMutation.isPending ? 'Versturen...' : 'Test e-mail versturen'}
              </button>
            )}
          </div>

          {saveMutation.isSuccess && (
            <p className="rapportage-email-feedback rapportage-email-success">Instellingen opgeslagen.</p>
          )}
          {saveMutation.isError && (
            <p className="rapportage-email-feedback rapportage-email-error">
              {saveMutation.error?.message || 'Opslaan mislukt.'}
            </p>
          )}
          {testMutation.isSuccess && (
            <p className="rapportage-email-feedback rapportage-email-success">Test-e-mail verstuurd.</p>
          )}
          {testMutation.isError && (
            <p className="rapportage-email-feedback rapportage-email-error">
              {testMutation.error?.message || 'Verzenden mislukt.'}
            </p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

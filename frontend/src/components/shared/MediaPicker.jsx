import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import './MediaPicker.css';

const SOURCE_TABS = [
  { key: 'all', label: 'Alle' },
  { key: 'upload', label: "Foto's" },
  { key: 'generated', label: 'Gegenereerd' },
];

export default function MediaPicker({ open, onSelect, onClose }) {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [sourceTab, setSourceTab] = useState('all');
  const [search, setSearch] = useState('');
  const [generateForm, setGenerateForm] = useState({ onderwerp: '', caption: '' });
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [localError, setLocalError] = useState('');

  const params = new URLSearchParams();
  if (sourceTab !== 'all') params.set('source', sourceTab);
  if (search.trim()) params.set('search', search.trim());

  const mediaQuery = useQuery({
    queryKey: ['media-library', sourceTab, search],
    queryFn: () => api(`/media?${params.toString()}`),
    enabled: open,
  });

  const uploadMutation = useMutation({
    mutationFn: ({ dataUrl, altText }) =>
      api('/media/upload', {
        method: 'POST',
        body: JSON.stringify({ dataUrl, altText }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      setLocalError('');
    },
    onError: (err) => setLocalError(err.message || 'Uploaden mislukt.'),
  });

  const generateMutation = useMutation({
    mutationFn: (fields) =>
      api('/media/generate', {
        method: 'POST',
        body: JSON.stringify(fields),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
      setShowGenerateForm(false);
      setGenerateForm({ onderwerp: '', caption: '' });
      setLocalError('');
      onSelect(data.item.path);
      onClose();
    },
    onError: (err) => setLocalError(err.message || 'Genereren mislukt.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api(`/media/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-library'] });
    },
    onError: (err) => setLocalError(err.message || 'Verwijderen mislukt.'),
  });

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalError('');

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'));
        reader.readAsDataURL(file);
      });

      await uploadMutation.mutateAsync({ dataUrl, altText: file.name.replace(/\.[^.]+$/, '') });
    } finally {
      event.target.value = '';
    }
  }

  function handleSelect(item) {
    onSelect(item.path);
    onClose();
  }

  function handleGenerate(event) {
    event.preventDefault();
    generateMutation.mutate({
      onderwerp: generateForm.onderwerp,
      caption: generateForm.caption,
      altText: generateForm.onderwerp,
    });
  }

  const isBusy = uploadMutation.isPending || generateMutation.isPending || deleteMutation.isPending;
  const items = mediaQuery.data?.items || [];

  if (!open) return null;

  return (
    <div className="mp-overlay" onClick={onClose}>
      <div className="mp-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mp-header">
          <h2>Contentbibliotheek</h2>
          <button className="mp-close" onClick={onClose} type="button" aria-label="Sluiten">
            ✕
          </button>
        </div>

        {localError ? <p className="mp-error">{localError}</p> : null}

        <div className="mp-toolbar">
          <div className="mp-tabs">
            {SOURCE_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`mp-tab${sourceTab === tab.key ? ' active' : ''}`}
                onClick={() => setSourceTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <input
            className="mp-search"
            type="search"
            placeholder="Zoeken..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="mp-actions">
            <button
              type="button"
              className="mp-btn-secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isBusy}
            >
              Foto uploaden
            </button>
            <button
              type="button"
              className="mp-btn-primary"
              onClick={() => setShowGenerateForm((v) => !v)}
              disabled={isBusy}
            >
              Nieuw genereren
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {showGenerateForm ? (
          <form className="mp-generate-form" onSubmit={handleGenerate}>
            <label>
              Onderwerp
              <input
                value={generateForm.onderwerp}
                onChange={(e) => setGenerateForm((f) => ({ ...f, onderwerp: e.target.value }))}
                placeholder="Bijv. Werken bij Light"
                required
              />
            </label>
            <label>
              Onderschrift (optioneel)
              <input
                value={generateForm.caption}
                onChange={(e) => setGenerateForm((f) => ({ ...f, caption: e.target.value }))}
                placeholder="Bijv. Betrouwbaar personeel in Rotterdam"
              />
            </label>
            <div className="mp-generate-actions">
              <button type="submit" disabled={isBusy}>
                {generateMutation.isPending ? 'Genereren...' : 'Genereer en selecteer'}
              </button>
              <button type="button" onClick={() => setShowGenerateForm(false)}>
                Annuleren
              </button>
            </div>
          </form>
        ) : null}

        {uploadMutation.isPending ? (
          <p className="mp-loading">Foto wordt geüpload...</p>
        ) : null}

        {mediaQuery.isLoading ? (
          <p className="mp-loading">Bibliotheek wordt geladen...</p>
        ) : items.length === 0 ? (
          <p className="mp-empty">Geen afbeeldingen gevonden. Upload een foto of genereer een nieuwe afbeelding.</p>
        ) : (
          <div className="mp-grid">
            {items.map((item) => (
              <div key={item.id} className="mp-item">
                <button
                  type="button"
                  className="mp-item-select"
                  onClick={() => handleSelect(item)}
                  title="Selecteer"
                >
                  <img src={item.path} alt={item.alt_text || item.filename} loading="lazy" />
                  <div className="mp-item-overlay">
                    <span>Selecteren</span>
                  </div>
                </button>
                <div className="mp-item-meta">
                  <span className="mp-item-name" title={item.alt_text || item.filename}>
                    {item.alt_text || item.filename}
                  </span>
                  <span className={`mp-item-badge ${item.source}`}>
                    {item.source === 'upload' ? 'foto' : 'gegenereerd'}
                  </span>
                  {role === 'owner' ? (
                    <button
                      type="button"
                      className="mp-item-delete"
                      onClick={() => deleteMutation.mutate(item.id)}
                      disabled={isBusy}
                      title="Verwijderen"
                      aria-label="Verwijderen"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

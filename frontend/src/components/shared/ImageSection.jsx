import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import './ImageSection.css';

const UNSPLASH_APP = 'light_marketing_tool';

const TABS = [
  { key: 'unsplash', label: 'Unsplash' },
  { key: 'library', label: 'Bibliotheek' },
  { key: 'upload', label: 'Upload' },
  { key: 'generate', label: 'Genereer' },
];

export default function ImageSection({ imagePath, onSelect, suggestedTerms, disabled }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Unsplash availability
  const statusQuery = useQuery({
    queryKey: ['unsplash-status'],
    queryFn: () => api('/unsplash/status'),
    staleTime: 5 * 60 * 1000,
  });
  const unsplashAvailable = statusQuery.data?.available === true;

  const defaultTab = unsplashAvailable ? 'unsplash' : 'library';
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [unsplashResults, setUnsplashResults] = useState([]);
  const [unsplashTotal, setUnsplashTotal] = useState(0);
  const [unsplashPage, setUnsplashPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  const [generateForm, setGenerateForm] = useState({ onderwerp: '', caption: '' });
  const [localError, setLocalError] = useState('');
  const [selectedAttribution, setSelectedAttribution] = useState(null);

  // If unsplash becomes unavailable after mount, switch tab
  if (statusQuery.isFetched && !unsplashAvailable && activeTab === 'unsplash') {
    setActiveTab('library');
  }

  // Auto-search when new suggestedTerms arrive from generation.
  const prevFirstTermRef = useRef(null);
  const firstTerm = suggestedTerms?.[0] || null;
  if (firstTerm && unsplashAvailable && firstTerm !== prevFirstTermRef.current) {
    prevFirstTermRef.current = firstTerm;
    setSearchQuery(firstTerm);
    setActiveTab('unsplash');
    // Defer the async search to after commit
    queueMicrotask(() => doSearch(firstTerm, 1));
  }

  async function doSearch(query, page = 1) {
    if (!query.trim()) return;
    setIsSearching(true);
    setLocalError('');
    try {
      const params = new URLSearchParams({ query: query.trim(), page: String(page), orientation: 'landscape' });
      const data = await api(`/unsplash/search?${params.toString()}`);
      if (page === 1) {
        setUnsplashResults(data.results || []);
      } else {
        setUnsplashResults((prev) => [...prev, ...(data.results || [])]);
      }
      setUnsplashTotal(data.total || 0);
      setUnsplashPage(page);
    } catch (err) {
      setLocalError(err.message || 'Unsplash zoeken mislukt.');
    } finally {
      setIsSearching(false);
    }
  }

  function handleSearchInput(value) {
    setSearchQuery(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) doSearch(value, 1);
    }, 400);
  }

  async function handleUnsplashSelect(photo) {
    setLocalError('');
    try {
      const result = await api('/media/unsplash-select', {
        method: 'POST',
        body: JSON.stringify({
          unsplashPhotoId: photo.id,
          url: photo.urls.regular,
          altText: photo.alt_description || '',
          photographer: photo.user.name,
          photographerUrl: photo.user.link,
          downloadLocation: photo.download_location,
        }),
      });
      setSelectedAttribution({
        name: photo.user.name,
        link: photo.user.link,
      });
      onSelect(result.item.path);
    } catch (err) {
      setLocalError(err.message || 'Selecteren mislukt.');
    }
  }

  // Library
  const libraryQuery = useQuery({
    queryKey: ['media-library-imgsection', librarySearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (librarySearch.trim()) params.set('search', librarySearch.trim());
      return api(`/media?${params.toString()}`);
    },
    enabled: activeTab === 'library',
  });

  function handleLibrarySelect(item) {
    if (item.source === 'unsplash' && item.unsplash_photographer) {
      setSelectedAttribution({
        name: item.unsplash_photographer,
        link: item.unsplash_photographer_url || '#',
      });
    } else {
      setSelectedAttribution(null);
    }
    onSelect(item.path);
  }

  // Upload
  const uploadMutation = useMutation({
    mutationFn: ({ dataUrl, altText }) =>
      api('/media/upload', {
        method: 'POST',
        body: JSON.stringify({ dataUrl, altText }),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['media-library-imgsection'] });
      setSelectedAttribution(null);
      onSelect(data.item.path);
      setLocalError('');
    },
    onError: (err) => setLocalError(err.message || 'Uploaden mislukt.'),
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

  // Generate
  const generateMutation = useMutation({
    mutationFn: (fields) =>
      api('/media/generate', {
        method: 'POST',
        body: JSON.stringify(fields),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['media-library-imgsection'] });
      setGenerateForm({ onderwerp: '', caption: '' });
      setSelectedAttribution(null);
      onSelect(data.item.path);
      setLocalError('');
    },
    onError: (err) => setLocalError(err.message || 'Genereren mislukt.'),
  });

  function handleGenerate(event) {
    event.preventDefault();
    generateMutation.mutate({
      onderwerp: generateForm.onderwerp,
      caption: generateForm.caption,
      altText: generateForm.onderwerp,
    });
  }

  const isBusy = disabled || uploadMutation.isPending || generateMutation.isPending;
  const visibleTabs = unsplashAvailable ? TABS : TABS.filter((t) => t.key !== 'unsplash');

  // Check if current image is from Unsplash (for attribution display)
  const isUnsplashImage = imagePath && imagePath.includes('images.unsplash.com');

  return (
    <div className="is-section">
      <label className="is-label">Afbeelding</label>

      {localError ? <p className="is-error">{localError}</p> : null}

      {/* Selected image preview */}
      {imagePath ? (
        <div className="is-selected">
          <img src={imagePath} alt="Geselecteerde afbeelding" className="is-selected-img" />
          <div className="is-selected-info">
            {selectedAttribution || isUnsplashImage ? (
              <UnsplashAttribution attribution={selectedAttribution} />
            ) : null}
            <button
              type="button"
              className="is-remove-btn"
              onClick={() => {
                setSelectedAttribution(null);
                onSelect('');
              }}
              disabled={isBusy}
            >
              Verwijderen
            </button>
          </div>
        </div>
      ) : null}

      {/* Tabs */}
      <div className="is-tabs">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`is-tab${activeTab === tab.key ? ' active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Unsplash tab */}
      {activeTab === 'unsplash' && unsplashAvailable ? (
        <div className="is-panel">
          {suggestedTerms?.length > 0 ? (
            <div className="is-chips">
              {suggestedTerms.map((term) => (
                <button
                  key={term}
                  type="button"
                  className={`is-chip${searchQuery === term ? ' active' : ''}`}
                  onClick={() => {
                    setSearchQuery(term);
                    doSearch(term, 1);
                  }}
                >
                  {term}
                </button>
              ))}
            </div>
          ) : null}

          <input
            type="search"
            className="is-search"
            placeholder="Zoek op Unsplash..."
            value={searchQuery}
            onChange={(e) => handleSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                doSearch(searchQuery, 1);
              }
            }}
          />

          {isSearching && unsplashResults.length === 0 ? (
            <p className="is-loading">Zoeken...</p>
          ) : unsplashResults.length === 0 && searchQuery ? (
            <p className="is-empty">Geen foto's gevonden. Probeer andere zoektermen.</p>
          ) : (
            <>
              <div className="is-grid">
                {unsplashResults.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    className="is-photo"
                    onClick={() => handleUnsplashSelect(photo)}
                    disabled={isBusy}
                  >
                    <img src={photo.urls.small} alt={photo.alt_description || ''} loading="lazy" />
                    <div className="is-photo-overlay">
                      <span>Selecteren</span>
                    </div>
                    <span className="is-photo-credit">{photo.user.name}</span>
                  </button>
                ))}
              </div>
              {unsplashResults.length > 0 && unsplashResults.length < unsplashTotal ? (
                <button
                  type="button"
                  className="is-load-more"
                  onClick={() => doSearch(searchQuery, unsplashPage + 1)}
                  disabled={isSearching}
                >
                  {isSearching ? 'Laden...' : 'Meer laden'}
                </button>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {/* Library tab */}
      {activeTab === 'library' ? (
        <div className="is-panel">
          <input
            type="search"
            className="is-search"
            placeholder="Zoeken in bibliotheek..."
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
          />
          {libraryQuery.isLoading ? (
            <p className="is-loading">Laden...</p>
          ) : (libraryQuery.data?.items || []).length === 0 ? (
            <p className="is-empty">Geen afbeeldingen in de bibliotheek.</p>
          ) : (
            <div className="is-grid">
              {(libraryQuery.data?.items || []).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="is-photo"
                  onClick={() => handleLibrarySelect(item)}
                  disabled={isBusy}
                >
                  <img src={item.path} alt={item.alt_text || item.filename} loading="lazy" />
                  <div className="is-photo-overlay">
                    <span>Selecteren</span>
                  </div>
                  <span className={`is-photo-badge ${item.source}`}>
                    {item.source === 'upload' ? 'foto' : item.source === 'unsplash' ? 'unsplash' : 'gegenereerd'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {/* Upload tab */}
      {activeTab === 'upload' ? (
        <div className="is-panel">
          <div
            className="is-dropzone"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('dragover'); }}
            onDragLeave={(e) => e.currentTarget.classList.remove('dragover')}
            onDrop={(e) => {
              e.preventDefault();
              e.currentTarget.classList.remove('dragover');
              const file = e.dataTransfer.files?.[0];
              if (file) {
                const dt = new DataTransfer();
                dt.items.add(file);
                fileInputRef.current.files = dt.files;
                fileInputRef.current.dispatchEvent(new Event('change', { bubbles: true }));
              }
            }}
          >
            <p className="is-dropzone-text">
              {uploadMutation.isPending
                ? 'Uploaden...'
                : 'Sleep een afbeelding hierheen of klik om te uploaden'}
            </p>
            <p className="is-dropzone-hint">PNG, JPG of WEBP (max 10MB)</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>
      ) : null}

      {/* Generate tab */}
      {activeTab === 'generate' ? (
        <div className="is-panel">
          <form className="is-generate-form" onSubmit={handleGenerate}>
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
            <button type="submit" disabled={isBusy}>
              {generateMutation.isPending ? 'Genereren...' : 'Genereer afbeelding'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function UnsplashAttribution({ attribution }) {
  if (!attribution) {
    return <span className="is-attribution">Foto via Unsplash</span>;
  }
  const unsplashUrl = `https://unsplash.com/?utm_source=${UNSPLASH_APP}&utm_medium=referral`;
  return (
    <span className="is-attribution">
      Foto door{' '}
      <a href={attribution.link} target="_blank" rel="noopener noreferrer">
        {attribution.name}
      </a>
      {' '}op{' '}
      <a href={unsplashUrl} target="_blank" rel="noopener noreferrer">
        Unsplash
      </a>
    </span>
  );
}

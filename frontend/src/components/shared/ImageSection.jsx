import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import './ImageSection.css';

const UNSPLASH_APP = 'light_marketing_tool';

const STANDARD_FILTERS = [
  { nl: 'Logistiek', en: 'logistics warehouse' },
  { nl: 'Magazijn', en: 'warehouse workers' },
  { nl: 'Schoonmaak', en: 'cleaning service professional' },
  { nl: 'Kantoor', en: 'office work' },
  { nl: 'Rotterdam', en: 'Rotterdam Netherlands' },
  { nl: 'Teamwork', en: 'team working together' },
];

/**
 * Compact image field + modal picker.
 *
 * Props:
 *  - imagePath        current selected image
 *  - onSelect(path)   callback when an image is chosen
 *  - suggestions      pre-fetched Unsplash results from generate response
 *  - searchTerms      AI-suggested search terms (string[])
 *  - disabled         true during generation / save
 */
export default function ImageSection({ imagePath, onSelect, suggestions, searchTerms, disabled }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedAttribution, setSelectedAttribution] = useState(null);

  const isUnsplashImage = imagePath && imagePath.includes('images.unsplash.com');

  function handleSelect(path, attribution) {
    onSelect(path);
    setSelectedAttribution(attribution || null);
    setModalOpen(false);
  }

  return (
    <div className="is-field">
      <label className="is-field-label">Afbeelding</label>

      {imagePath ? (
        <div className="is-preview">
          <img src={imagePath} alt="Geselecteerde afbeelding" className="is-preview-img" />
          <div className="is-preview-bar">
            {selectedAttribution || isUnsplashImage ? (
              <UnsplashAttribution attribution={selectedAttribution} />
            ) : <span />}
            <div className="is-preview-btns">
              <button type="button" className="is-btn-outline" onClick={() => setModalOpen(true)} disabled={disabled}>
                Wijzigen
              </button>
              <button type="button" className="is-btn-danger" onClick={() => { setSelectedAttribution(null); onSelect(''); }} disabled={disabled}>
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="is-choose-btn" onClick={() => setModalOpen(true)} disabled={disabled}>
          Kies afbeelding...
        </button>
      )}

      {modalOpen ? (
        <ImagePickerModal
          onSelect={handleSelect}
          onClose={() => setModalOpen(false)}
          suggestions={suggestions}
          searchTerms={searchTerms}
          disabled={disabled}
        />
      ) : null}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Modal picker
   ═══════════════════════════════════════════════════════════════════════════ */

function ImagePickerModal({ onSelect, onClose, suggestions, searchTerms, disabled }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const debounceRef = useRef(null);

  // Unsplash
  const statusQuery = useQuery({
    queryKey: ['unsplash-status'],
    queryFn: () => api('/unsplash/status'),
    staleTime: 5 * 60 * 1000,
  });
  const unsplashAvailable = statusQuery.data?.available === true;

  const displayTerms = searchTerms || [];
  const [searchQuery, setSearchQuery] = useState(displayTerms[0] || '');
  const [translatedQuery, setTranslatedQuery] = useState('');
  const [unsplashResults, setUnsplashResults] = useState([]);
  const [unsplashTotal, setUnsplashTotal] = useState(0);
  const [unsplashPage, setUnsplashPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [localError, setLocalError] = useState('');

  // Use pre-fetched suggestions until the user searches
  const displayResults = unsplashResults.length > 0 ? unsplashResults : (suggestions || []);

  // Secondary panels
  const [openPanel, setOpenPanel] = useState(null);
  const [librarySearch, setLibrarySearch] = useState('');
  const [generateForm, setGenerateForm] = useState({ onderwerp: '', caption: '' });

  // Favorites query
  const favoritesQuery = useQuery({
    queryKey: ['media-favorites'],
    queryFn: () => api('/media?favorites=true'),
    enabled: openPanel === 'favorites',
  });

  async function translateAndSearch(query, page = 1) {
    if (!query.trim()) return;
    setIsSearching(true);
    setLocalError('');
    setTranslatedQuery('');
    try {
      // Try to translate NL→EN
      let searchTerm = query.trim();
      try {
        const translation = await api(`/unsplash/translate?q=${encodeURIComponent(searchTerm)}`);
        if (translation.translated && translation.translated !== translation.original) {
          searchTerm = translation.translated;
          setTranslatedQuery(searchTerm);
        }
      } catch {
        // Translation failed, use original
      }
      await doSearch(searchTerm, page);
    } catch (err) {
      setLocalError(err.message || 'Unsplash zoeken mislukt.');
    } finally {
      setIsSearching(false);
    }
  }

  async function doSearch(query, page = 1) {
    if (!query.trim()) return;
    setIsSearching(true);
    setLocalError('');
    try {
      const params = new URLSearchParams({ query: query.trim(), page: String(page), orientation: 'landscape' });
      const data = await api(`/unsplash/search?${params.toString()}`);
      if (data.rateLimited) {
        setLocalError(data.error || 'Unsplash limiet bereikt. Probeer het later opnieuw.');
        return;
      }
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
      if (value.trim()) translateAndSearch(value, 1);
    }, 800);
  }

  function handleStandardFilter(filter) {
    setSearchQuery(filter.en);
    setTranslatedQuery('');
    doSearch(filter.en, 1);
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
      onSelect(result.item.path, { name: photo.user.name, link: photo.user.link });
    } catch (err) {
      setLocalError(err.message || 'Selecteren mislukt.');
    }
  }

  // Favorite toggle mutation
  const favoriteMutation = useMutation({
    mutationFn: (id) => api(`/media/${id}/favorite`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-favorites'] });
      queryClient.invalidateQueries({ queryKey: ['media-library-picker'] });
    },
  });

  // Library
  const libraryQuery = useQuery({
    queryKey: ['media-library-picker', librarySearch],
    queryFn: () => {
      const params = new URLSearchParams();
      if (librarySearch.trim()) params.set('search', librarySearch.trim());
      return api(`/media?${params.toString()}`);
    },
    enabled: openPanel === 'library',
  });

  function handleLibrarySelect(item) {
    const attr = item.source === 'unsplash' && item.unsplash_photographer
      ? { name: item.unsplash_photographer, link: item.unsplash_photographer_url || '#' }
      : null;
    onSelect(item.path, attr);
  }

  // Upload
  const uploadMutation = useMutation({
    mutationFn: ({ dataUrl, altText }) =>
      api('/media/upload', { method: 'POST', body: JSON.stringify({ dataUrl, altText }) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['media-library-picker'] });
      onSelect(data.item.path, null);
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
      api('/media/generate', { method: 'POST', body: JSON.stringify(fields) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['media-library-picker'] });
      setGenerateForm({ onderwerp: '', caption: '' });
      onSelect(data.item.path, null);
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

  function togglePanel(panel) {
    setOpenPanel((prev) => (prev === panel ? null : panel));
  }

  const isBusy = disabled || uploadMutation.isPending || generateMutation.isPending;

  return (
    <div className="is-overlay" onClick={onClose}>
      <div className="is-modal" onClick={(e) => e.stopPropagation()}>
        <div className="is-modal-header">
          <h2>Kies afbeelding</h2>
          <button type="button" className="is-modal-close" onClick={onClose} aria-label="Sluiten">&#x2715;</button>
        </div>

        {localError ? <p className="is-error">{localError}</p> : null}

        <div className="is-modal-body">
          {/* Favorites tab */}
          {unsplashAvailable ? (
            <div className="is-favorites-section">
              <button
                type="button"
                className={`is-favorites-toggle${openPanel === 'favorites' ? ' active' : ''}`}
                onClick={() => togglePanel('favorites')}
              >
                <StarIcon filled /> Favorieten
              </button>
              {openPanel === 'favorites' ? (
                <div className="is-favorites-panel">
                  {favoritesQuery.isLoading ? (
                    <p className="is-loading">Laden...</p>
                  ) : (favoritesQuery.data?.items || []).length === 0 ? (
                    <p className="is-empty">Nog geen favorieten. Klik op het sterretje bij een afbeelding om deze toe te voegen.</p>
                  ) : (
                    <div className="is-lib-grid">
                      {(favoritesQuery.data?.items || []).map((item) => (
                        <div key={item.id} className="is-suggestion-wrap">
                          <button type="button" className="is-suggestion" onClick={() => handleLibrarySelect(item)} disabled={isBusy}>
                            <img src={item.path} alt={item.alt_text || item.filename} loading="lazy" />
                            <div className="is-suggestion-overlay"><span>Kies</span></div>
                          </button>
                          <button
                            type="button"
                            className="is-star-btn"
                            onClick={(e) => { e.stopPropagation(); favoriteMutation.mutate(item.id); }}
                            aria-label="Verwijder uit favorieten"
                          >
                            <StarIcon filled />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Unsplash suggestions */}
          {unsplashAvailable && displayResults.length > 0 ? (
            <div className="is-suggestions">
              <p className="is-suggestions-label">Suggesties op basis van je content</p>
              <div className="is-suggestions-grid">
                {displayResults.map((photo) => (
                  <div key={photo.id} className="is-suggestion-wrap">
                    <button type="button" className="is-suggestion" onClick={() => handleUnsplashSelect(photo)} disabled={isBusy}>
                      <img src={photo.urls.small} alt={photo.alt_description || ''} loading="lazy" />
                      <div className="is-suggestion-overlay"><span>Kies</span></div>
                      <span className="is-suggestion-credit">{photo.user.name}</span>
                    </button>
                  </div>
                ))}
              </div>
              {displayResults.length < unsplashTotal && unsplashResults.length > 0 ? (
                <button type="button" className="is-more-btn" onClick={() => doSearch(translatedQuery || searchQuery, unsplashPage + 1)} disabled={isSearching}>
                  {isSearching ? 'Laden...' : 'Meer laden'}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Search bar + chips */}
          {unsplashAvailable ? (
            <div className="is-search-section">
              <input
                type="search"
                className="is-search"
                placeholder="Zoek stockfoto's op Unsplash..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); translateAndSearch(searchQuery, 1); } }}
                autoFocus
              />
              {translatedQuery && translatedQuery !== searchQuery ? (
                <p className="is-translated-msg">Zoekresultaten voor &lsquo;{translatedQuery}&rsquo;</p>
              ) : null}
              {/* Standard filter chips */}
              <div className="is-chips">
                {STANDARD_FILTERS.map((filter) => (
                  <button
                    key={filter.nl}
                    type="button"
                    className={`is-chip is-chip-standard${searchQuery === filter.en ? ' active' : ''}`}
                    onClick={() => handleStandardFilter(filter)}
                  >
                    {filter.nl}
                  </button>
                ))}
              </div>
              {/* AI-suggested chips */}
              {displayTerms.length > 0 ? (
                <div className="is-chips">
                  {displayTerms.map((term) => (
                    <button key={term} type="button" className={`is-chip${searchQuery === term ? ' active' : ''}`} onClick={() => { setSearchQuery(term); setTranslatedQuery(''); doSearch(term, 1); }}>
                      {term}
                    </button>
                  ))}
                </div>
              ) : null}
              {isSearching && displayResults.length === 0 ? <p className="is-searching-msg">Zoeken...</p> : null}
            </div>
          ) : null}

          {/* Divider */}
          <div className="is-divider"><span>of kies een andere bron</span></div>

          {/* Secondary action buttons */}
          <div className="is-actions">
            <button type="button" className={`btn-secondary btn-sm${openPanel === 'upload' ? ' is-toggle-active' : ''}`} onClick={() => togglePanel('upload')} disabled={isBusy}>
              Upload foto
            </button>
            <button type="button" className={`btn-secondary btn-sm${openPanel === 'library' ? ' is-toggle-active' : ''}`} onClick={() => togglePanel('library')} disabled={isBusy}>
              Bibliotheek
            </button>
            <button type="button" className={`btn-secondary btn-sm${openPanel === 'generate' ? ' is-toggle-active' : ''}`} onClick={() => togglePanel('generate')} disabled={isBusy}>
              Genereer
            </button>
          </div>

          {/* Upload panel */}
          {openPanel === 'upload' ? (
            <div className="is-sub-panel">
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
                <p className="is-dropzone-text">{uploadMutation.isPending ? 'Uploaden...' : 'Sleep een afbeelding hierheen of klik'}</p>
                <p className="is-dropzone-hint">PNG, JPG of WEBP (max 10MB)</p>
              </div>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>
          ) : null}

          {/* Library panel */}
          {openPanel === 'library' ? (
            <div className="is-sub-panel">
              <input type="search" className="is-search" placeholder="Zoeken in bibliotheek..." value={librarySearch} onChange={(e) => setLibrarySearch(e.target.value)} />
              {libraryQuery.isLoading ? (
                <p className="is-loading">Laden...</p>
              ) : (libraryQuery.data?.items || []).length === 0 ? (
                <p className="is-empty">Geen afbeeldingen in de bibliotheek.</p>
              ) : (
                <div className="is-lib-grid">
                  {(libraryQuery.data?.items || []).map((item) => (
                    <div key={item.id} className="is-suggestion-wrap">
                      <button type="button" className="is-suggestion" onClick={() => handleLibrarySelect(item)} disabled={isBusy}>
                        <img src={item.path} alt={item.alt_text || item.filename} loading="lazy" />
                        <div className="is-suggestion-overlay"><span>Kies</span></div>
                        <span className={`is-lib-badge ${item.source}`}>
                          {item.source === 'upload' ? 'foto' : item.source === 'unsplash' ? 'unsplash' : 'gegenereerd'}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="is-star-btn"
                        onClick={(e) => { e.stopPropagation(); favoriteMutation.mutate(item.id); }}
                        aria-label={item.is_favorite ? 'Verwijder uit favorieten' : 'Toevoegen aan favorieten'}
                      >
                        <StarIcon filled={item.is_favorite} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {/* Generate panel */}
          {openPanel === 'generate' ? (
            <div className="is-sub-panel">
              <form className="is-generate-form" onSubmit={handleGenerate}>
                <label>
                  Onderwerp
                  <input value={generateForm.onderwerp} onChange={(e) => setGenerateForm((f) => ({ ...f, onderwerp: e.target.value }))} placeholder="Bijv. Werken bij Light" required />
                </label>
                <label>
                  Onderschrift (optioneel)
                  <input value={generateForm.caption} onChange={(e) => setGenerateForm((f) => ({ ...f, caption: e.target.value }))} placeholder="Bijv. Betrouwbaar personeel" />
                </label>
                <button type="submit" disabled={isBusy}>{generateMutation.isPending ? 'Genereren...' : 'Genereer afbeelding'}</button>
              </form>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StarIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#f59e0b' : 'none'} stroke={filled ? '#f59e0b' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function UnsplashAttribution({ attribution }) {
  if (!attribution) return <span className="is-attribution">Foto via Unsplash</span>;
  const unsplashUrl = `https://unsplash.com/?utm_source=${UNSPLASH_APP}&utm_medium=referral`;
  return (
    <span className="is-attribution">
      Foto door <a href={attribution.link} target="_blank" rel="noopener noreferrer">{attribution.name}</a> op <a href={unsplashUrl} target="_blank" rel="noopener noreferrer">Unsplash</a>
    </span>
  );
}

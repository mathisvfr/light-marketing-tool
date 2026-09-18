import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import './ImageSection.css';

const UNSPLASH_APP = 'light_marketing_tool';

/**
 * Unified image picker.
 *
 * Props:
 *  - imagePath        current selected image
 *  - onSelect(path)   callback when an image is chosen
 *  - suggestions      pre-fetched Unsplash results from generate response
 *  - searchTerms      AI-suggested search terms (string[])
 *  - disabled         true during generation / save
 */
export default function ImageSection({ imagePath, onSelect, suggestions, searchTerms, disabled }) {
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

  // Unsplash state
  const [searchQuery, setSearchQuery] = useState('');
  const [unsplashResults, setUnsplashResults] = useState([]);
  const [unsplashTotal, setUnsplashTotal] = useState(0);
  const [unsplashPage, setUnsplashPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);
  const [localError, setLocalError] = useState('');
  const [selectedAttribution, setSelectedAttribution] = useState(null);

  // Secondary panels
  const [openPanel, setOpenPanel] = useState(null); // 'library' | 'upload' | 'generate' | null
  const [librarySearch, setLibrarySearch] = useState('');
  const [generateForm, setGenerateForm] = useState({ onderwerp: '', caption: '' });

  // Picker visibility (collapse after selection)
  const [pickerOpen, setPickerOpen] = useState(!imagePath);

  // Use pre-fetched suggestions if we haven't searched yet
  const displayResults = unsplashResults.length > 0 ? unsplashResults : (suggestions || []);
  const displayTerms = searchTerms || [];

  // Populate search query from first term when suggestions arrive.
  // Track via a state string instead of a ref to avoid the "cannot update
  // ref during render" lint error while keeping the same single-fire logic.
  const [appliedTerm, setAppliedTerm] = useState(null);
  const firstTerm = displayTerms[0] || null;
  if (firstTerm && firstTerm !== appliedTerm) {
    setAppliedTerm(firstTerm);
    if (!searchQuery) setSearchQuery(firstTerm);
    setPickerOpen(true);
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
      setSelectedAttribution({ name: photo.user.name, link: photo.user.link });
      onSelect(result.item.path);
      setPickerOpen(false);
      setOpenPanel(null);
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
    enabled: openPanel === 'library',
  });

  function handleLibrarySelect(item) {
    if (item.source === 'unsplash' && item.unsplash_photographer) {
      setSelectedAttribution({ name: item.unsplash_photographer, link: item.unsplash_photographer_url || '#' });
    } else {
      setSelectedAttribution(null);
    }
    onSelect(item.path);
    setPickerOpen(false);
    setOpenPanel(null);
  }

  // Upload
  const uploadMutation = useMutation({
    mutationFn: ({ dataUrl, altText }) =>
      api('/media/upload', { method: 'POST', body: JSON.stringify({ dataUrl, altText }) }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['media-library-imgsection'] });
      setSelectedAttribution(null);
      onSelect(data.item.path);
      setLocalError('');
      setPickerOpen(false);
      setOpenPanel(null);
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
      queryClient.invalidateQueries({ queryKey: ['media-library-imgsection'] });
      setGenerateForm({ onderwerp: '', caption: '' });
      setSelectedAttribution(null);
      onSelect(data.item.path);
      setLocalError('');
      setPickerOpen(false);
      setOpenPanel(null);
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
  const isUnsplashImage = imagePath && imagePath.includes('images.unsplash.com');

  return (
    <div className="is-section">
      <label className="is-label">Afbeelding</label>

      {localError ? <p className="is-error">{localError}</p> : null}

      {/* === SELECTED IMAGE PREVIEW === */}
      {imagePath ? (
        <div className="is-selected">
          <img src={imagePath} alt="Geselecteerde afbeelding" className="is-selected-img" />
          <div className="is-selected-bar">
            {selectedAttribution || isUnsplashImage ? (
              <UnsplashAttribution attribution={selectedAttribution} />
            ) : <span />}
            <div className="is-selected-btns">
              <button type="button" className="is-btn-outline" onClick={() => setPickerOpen((v) => !v)} disabled={isBusy}>
                {pickerOpen ? 'Sluiten' : 'Andere afbeelding'}
              </button>
              <button type="button" className="is-btn-danger" onClick={() => { setSelectedAttribution(null); onSelect(''); setPickerOpen(true); }} disabled={isBusy}>
                Verwijderen
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* === PICKER (visible when no image or explicitly opened) === */}
      {pickerOpen || !imagePath ? (
        <div className="is-picker">

          {/* Unsplash suggestions strip */}
          {unsplashAvailable && displayResults.length > 0 ? (
            <div className="is-strip-wrap">
              <div className="is-strip">
                {displayResults.map((photo) => (
                  <button key={photo.id} type="button" className="is-strip-photo" onClick={() => handleUnsplashSelect(photo)} disabled={isBusy}>
                    <img src={photo.urls.small} alt={photo.alt_description || ''} loading="lazy" />
                    <div className="is-strip-overlay"><span>Kies</span></div>
                    <span className="is-strip-credit">{photo.user.name}</span>
                  </button>
                ))}
              </div>
              {displayResults.length < unsplashTotal && unsplashResults.length > 0 ? (
                <button type="button" className="is-strip-more" onClick={() => doSearch(searchQuery, unsplashPage + 1)} disabled={isSearching}>
                  {isSearching ? '...' : 'Meer'}
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Search bar + chips */}
          {unsplashAvailable ? (
            <div className="is-search-row">
              {displayTerms.length > 0 ? (
                <div className="is-chips">
                  {displayTerms.map((term) => (
                    <button key={term} type="button" className={`is-chip${searchQuery === term ? ' active' : ''}`} onClick={() => { setSearchQuery(term); doSearch(term, 1); }}>
                      {term}
                    </button>
                  ))}
                </div>
              ) : null}
              <input
                type="search"
                className="is-search"
                placeholder="Zoek stockfoto's op Unsplash..."
                value={searchQuery}
                onChange={(e) => handleSearchInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); doSearch(searchQuery, 1); } }}
              />
              {isSearching ? <span className="is-searching">Zoeken...</span> : null}
            </div>
          ) : null}

          {/* Divider + secondary actions */}
          <div className="is-divider"><span>of kies een andere bron</span></div>

          <div className="is-actions">
            <button type="button" className={`is-action-btn${openPanel === 'upload' ? ' active' : ''}`} onClick={() => togglePanel('upload')} disabled={isBusy}>
              Upload foto
            </button>
            <button type="button" className={`is-action-btn${openPanel === 'library' ? ' active' : ''}`} onClick={() => togglePanel('library')} disabled={isBusy}>
              Bibliotheek
            </button>
            <button type="button" className={`is-action-btn${openPanel === 'generate' ? ' active' : ''}`} onClick={() => togglePanel('generate')} disabled={isBusy}>
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
                <div className="is-grid">
                  {(libraryQuery.data?.items || []).map((item) => (
                    <button key={item.id} type="button" className="is-photo" onClick={() => handleLibrarySelect(item)} disabled={isBusy}>
                      <img src={item.path} alt={item.alt_text || item.filename} loading="lazy" />
                      <div className="is-photo-overlay"><span>Kies</span></div>
                      <span className={`is-photo-badge ${item.source}`}>
                        {item.source === 'upload' ? 'foto' : item.source === 'unsplash' ? 'unsplash' : 'gegenereerd'}
                      </span>
                    </button>
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
      ) : null}
    </div>
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

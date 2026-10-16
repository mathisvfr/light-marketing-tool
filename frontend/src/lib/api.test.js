import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from './api';

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
});

function jsonResponse(data, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
}

describe('api()', () => {
  it('makes a GET request with credentials and JSON content-type', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ items: [] }));

    const result = await api('/drafts');

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('/api/drafts');
    expect(opts.credentials).toBe('include');
    expect(opts.headers['Content-Type']).toBe('application/json');
    expect(result).toEqual({ items: [] });
  });

  it('throws with Dutch error message on non-ok response', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Concept niet gevonden.' }, 404));

    await expect(api('/drafts/999')).rejects.toThrow('Concept niet gevonden.');
  });

  it('throws generic Dutch error when response has no error field', async () => {
    // POST doesn't retry, so only one mock needed
    mockFetch.mockReturnValueOnce(jsonResponse({}, 500));

    await expect(api('/drafts/999', { method: 'POST' })).rejects.toThrow('Er ging iets mis');
  });

  it('attaches status code to thrown error', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Nope' }, 403));

    try {
      await api('/test');
      expect.fail('should have thrown');
    } catch (err) {
      expect(err.status).toBe(403);
    }
  });

  it('retries GET requests on 5xx', async () => {
    mockFetch
      .mockReturnValueOnce(jsonResponse({ error: 'Server error' }, 500))
      .mockReturnValueOnce(jsonResponse({ ok: true }));

    const result = await api('/drafts');

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true });
  });

  it('does NOT retry POST requests on 5xx', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Server error' }, 500));

    await expect(api('/drafts', { method: 'POST', body: '{}' })).rejects.toThrow();
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('does NOT retry on 4xx errors', async () => {
    mockFetch.mockReturnValueOnce(jsonResponse({ error: 'Bad request' }, 400));

    await expect(api('/drafts')).rejects.toThrow('Bad request');
    expect(mockFetch).toHaveBeenCalledOnce();
  });

  it('throws Dutch timeout message on AbortError (no retry)', async () => {
    const abortError = new DOMException('signal is aborted', 'AbortError');
    mockFetch.mockReturnValueOnce(Promise.reject(abortError));

    await expect(api('/slow')).rejects.toThrow('De server reageert niet');
    // Timeout should NOT trigger a retry
    expect(mockFetch).toHaveBeenCalledOnce();
  });
});

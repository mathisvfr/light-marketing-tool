const TIMEOUT_MS = 30_000;
const RETRYABLE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function api(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const canRetry = RETRYABLE_METHODS.has(method);

  // Don't force Content-Type on FormData (browser sets multipart boundary)
  const headers = options.body instanceof FormData
    ? { ...(options.headers || {}) }
    : { 'Content-Type': 'application/json', ...(options.headers || {}) };

  const attempt = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(`/api${path}`, {
        credentials: 'include',
        headers,
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const err = new Error(data.error || 'Er ging iets mis met de API-aanvraag.');
        err.status = response.status;
        throw err;
      }

      return response.json().catch(() => null);
    } catch (err) {
      clearTimeout(timer);

      if (err.name === 'AbortError') {
        const timeoutErr = new Error('De server reageert niet. Controleer je internetverbinding en probeer opnieuw.');
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }

      throw err;
    }
  };

  try {
    return await attempt();
  } catch (err) {
    // Retry once on 5xx or network error, but only for safe (idempotent) methods
    const isServerError = err.status >= 500;
    const isNetworkError = !err.status && err.name !== 'AbortError' && !err.isTimeout;

    if (canRetry && (isServerError || isNetworkError)) {
      // Brief pause before retry
      await new Promise((r) => setTimeout(r, 1000));
      return attempt();
    }

    throw err;
  }
}

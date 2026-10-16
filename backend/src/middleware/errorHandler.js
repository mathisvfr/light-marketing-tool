function errorHandler(error, req, res, _next) {
  const reqId = req.requestId || '-';
  const route = `${req.method} ${req.originalUrl}`;

  // Structured server-side log with request context for debugging.
  console.error(JSON.stringify({
    level: 'error',
    reqId,
    route,
    user: req.user?.id || null,
    message: error?.message || String(error),
    stack: error?.stack || null,
    ts: new Date().toISOString(),
  }));

  // Never leak internal error details to the client.
  const status = typeof error?.status === 'number' ? error.status : 500;

  return res.status(status).json({ error: 'Er ging iets mis op de server.' });
}

module.exports = { errorHandler };

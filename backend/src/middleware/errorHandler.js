function errorHandler(error, _req, res, _next) {
  // Always log the real error server-side for debugging.
  console.error('[error]', error?.message || error);

  // Never leak internal error details to the client — not even in dev.
  // Database errors, stack traces, and library messages stay server-side.
  const status = typeof error?.status === 'number' ? error.status : 500;

  return res.status(status).json({ error: 'Er ging iets mis op de server.' });
}

module.exports = { errorHandler };

function errorHandler(error, _req, res, _next) {
  console.error('[error]', error?.message || error);

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    return res.status(500).json({
      error: error?.message || 'Er ging iets mis op de server.',
    });
  }

  return res.status(500).json({ error: 'Er ging iets mis op de server.' });
}

module.exports = { errorHandler };

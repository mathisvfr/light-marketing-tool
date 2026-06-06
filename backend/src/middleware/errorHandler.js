function errorHandler(error, _req, res, _next) {
  if (process.env.NODE_ENV !== 'production') {
    console.error(error);
  }

  return res.status(500).json({ error: 'Er ging iets mis op de server.' });
}

module.exports = { errorHandler };

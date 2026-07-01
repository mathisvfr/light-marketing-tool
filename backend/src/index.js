const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '.env'),
  override: true,
});

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const draftsRoutes = require('./routes/drafts');
const publishRoutes = require('./routes/publish');
const brandRoutes = require('./routes/brand');
const integrationsRoutes = require('./routes/integrations');
const usersRoutes = require('./routes/users');
const feedsRoutes = require('./routes/feeds');
const mediaRoutes = require('./routes/media');
const { requireAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

function secureEquals(left, right) {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requireFeedAuth(req, res, next) {
  const expectedUser = String(process.env.FEEDS_BASIC_AUTH_USERNAME || '').trim();
  const expectedPassword = String(process.env.FEEDS_BASIC_AUTH_PASSWORD || '').trim();

  // Keep the feed public by default; enable auth only when both vars are present.
  if (!expectedUser || !expectedPassword) {
    return next();
  }

  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    res.set('WWW-Authenticate', 'Basic realm="feeds"');
    return res.status(401).json({ error: 'Authenticatie vereist voor feed.' });
  }

  let decoded;
  try {
    decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
  } catch (_error) {
    res.set('WWW-Authenticate', 'Basic realm="feeds"');
    return res.status(401).json({ error: 'Ongeldige authenticatieheader.' });
  }

  const separatorIndex = decoded.indexOf(':');
  if (separatorIndex < 0) {
    res.set('WWW-Authenticate', 'Basic realm="feeds"');
    return res.status(401).json({ error: 'Ongeldige authenticatieheader.' });
  }

  const providedUser = decoded.slice(0, separatorIndex);
  const providedPassword = decoded.slice(separatorIndex + 1);

  const validUser = secureEquals(providedUser, expectedUser);
  const validPassword = secureEquals(providedPassword, expectedPassword);

  if (!validUser || !validPassword) {
    res.set('WWW-Authenticate', 'Basic realm="feeds"');
    return res.status(401).json({ error: 'Ongeldige feed-inloggegevens.' });
  }

  return next();
}

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Te veel inlogpogingen. Probeer het later opnieuw.' },
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/feeds', requireFeedAuth, feedsRoutes);

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/drafts', requireAuth, draftsRoutes);
app.use('/api/publish', requireAuth, publishRoutes);
app.use('/api/brand', requireAuth, brandRoutes);
app.use('/api/integrations', requireAuth, integrationsRoutes);
app.use('/api/users', requireAuth, usersRoutes);
app.use('/api/media', requireAuth, mediaRoutes);

app.use(errorHandler);

const port = process.env.PORT || 3001;

// Only start listening when run directly (node src/index.js), so tests can
// import the configured app without binding a fixed port.
if (require.main === module) {
  app.listen(port, () => {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`Backend draait op poort ${port}`);
    }
  });
}

module.exports = app;

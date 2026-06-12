const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '..', '..', '.env'),
  override: true,
});

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const draftsRoutes = require('./routes/drafts');
const publishRoutes = require('./routes/publish');
const brandRoutes = require('./routes/brand');
const integrationsRoutes = require('./routes/integrations');
const usersRoutes = require('./routes/users');
const feedsRoutes = require('./routes/feeds');
const { requireAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '6mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(__dirname, '..', 'uploads')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/feeds', feedsRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', requireAuth, dashboardRoutes);
app.use('/api/drafts', requireAuth, draftsRoutes);
app.use('/api/publish', requireAuth, publishRoutes);
app.use('/api/brand', requireAuth, brandRoutes);
app.use('/api/integrations', requireAuth, integrationsRoutes);
app.use('/api/users', requireAuth, usersRoutes);

app.use(errorHandler);

const port = process.env.PORT || 3001;
app.listen(port, () => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`Backend draait op poort ${port}`);
  }
});

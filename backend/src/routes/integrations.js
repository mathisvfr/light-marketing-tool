const express = require('express');
const {
  SUPPORTED_PROVIDERS,
  isSupportedProvider,
  getAllCredentialStatuses,
  upsertCredential,
} = require('../services/integrations');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireRole('owner'), async (_req, res, next) => {
  try {
    const statuses = await getAllCredentialStatuses();
    return res.json({ providers: statuses });
  } catch (error) {
    return next(error);
  }
});

router.put('/:provider', requireRole('owner'), async (req, res, next) => {
  try {
    const provider = String(req.params.provider || '').trim();

    if (!isSupportedProvider(provider)) {
      return res.status(400).json({
        error: `Ongeldige provider. Kies uit: ${SUPPORTED_PROVIDERS.join(', ')}`,
      });
    }

    const status = await upsertCredential(provider, {
      accessToken: req.body?.accessToken || null,
      refreshToken: req.body?.refreshToken || null,
      expiresAt: req.body?.expiresAt || null,
      metadata: req.body?.metadata || {},
    });

    return res.json({ provider: status });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

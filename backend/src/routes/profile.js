const express = require('express');
const crypto = require('node:crypto');
const path = require('path');
const fs = require('node:fs');
const multer = require('multer');
const { supabase } = require('../db/client');
const { sendEmailVerification } = require('../services/notifications');

const router = express.Router();

const AVATARS_DIR = path.resolve(__dirname, '..', '..', 'uploads', 'avatars');

// Ensure avatars directory exists
fs.mkdirSync(AVATARS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.png';
    cb(null, `${req.user.id}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Alleen JPEG en PNG zijn toegestaan.'));
    }
    return cb(null, true);
  },
});

// GET /api/profile — return own profile data
router.get('/', async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, avatar_path, created_at, last_login_at, onboarded_at')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

// PATCH /api/profile — update own name
router.patch('/', async (req, res, next) => {
  try {
    const { name } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Naam is verplicht.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .update({ name: name.trim(), updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('id, name, email, role, avatar_path, created_at, last_login_at, onboarded_at')
      .maybeSingle();

    if (error) {
      return res.status(500).json({ error: 'Profiel bijwerken is mislukt.' });
    }

    return res.json({ user });
  } catch (err) {
    return next(err);
  }
});

// POST /api/profile/avatar — upload avatar image
router.post('/avatar', (req, res, next) => {
  upload.single('avatar')(req, res, async (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Bestand is te groot (max 2 MB).' });
      }
      return res.status(400).json({ error: err.message || 'Upload mislukt.' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Geen bestand geüpload.' });
    }

    try {
      const avatarPath = `/uploads/avatars/${req.file.filename}`;

      // Remove old avatar if it exists and has a different extension
      if (req.user.avatar_path && req.user.avatar_path !== avatarPath) {
        const oldPath = path.resolve(__dirname, '..', '..', req.user.avatar_path.replace(/^\//, ''));
        try { fs.unlinkSync(oldPath); } catch (_e) { /* ignore */ }
      }

      await supabase
        .from('users')
        .update({ avatar_path: avatarPath, updated_at: new Date().toISOString() })
        .eq('id', req.user.id);

      return res.json({ avatarPath });
    } catch (uploadErr) {
      return next(uploadErr);
    }
  });
});

// DELETE /api/profile/avatar — remove avatar
router.delete('/avatar', async (req, res, next) => {
  try {
    if (req.user.avatar_path) {
      const filePath = path.resolve(__dirname, '..', '..', req.user.avatar_path.replace(/^\//, ''));
      try { fs.unlinkSync(filePath); } catch (_e) { /* ignore */ }
    }

    await supabase
      .from('users')
      .update({ avatar_path: null, updated_at: new Date().toISOString() })
      .eq('id', req.user.id);

    return res.json({ message: 'Avatar verwijderd.' });
  } catch (err) {
    return next(err);
  }
});

// ---------- POST /change-email ----------

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

router.post('/change-email', async (req, res, next) => {
  try {
    const newEmail = String(req.body?.newEmail || '').trim().toLowerCase();

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      return res.status(400).json({ error: 'Voer een geldig e-mailadres in.' });
    }

    if (newEmail === req.user.email) {
      return res.status(400).json({ error: 'Dit is al je huidige e-mailadres.' });
    }

    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', newEmail)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ error: 'Dit e-mailadres is al in gebruik.' });
    }

    // Rate limit: max 3 tokens per user per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('email_verification_tokens')
      .select('*', { head: true, count: 'exact' })
      .eq('user_id', req.user.id)
      .gte('created_at', oneHourAgo);

    if ((count || 0) >= 3) {
      return res.status(429).json({ error: 'Te veel verzoeken. Probeer het over een uur opnieuw.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    await supabase.from('email_verification_tokens').insert({
      user_id: req.user.id,
      new_email: newEmail,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const verifyLink = `${baseUrl}/email-verificatie?token=${token}`;
    sendEmailVerification(newEmail, req.user.name, verifyLink);

    return res.json({ message: 'Verificatiemail verstuurd naar het nieuwe adres.' });
  } catch (err) {
    return next(err);
  }
});

// ---------- POST /verify-email ----------

router.post('/verify-email', async (req, res, next) => {
  try {
    const token = String(req.body?.token || '').trim();

    if (!token) {
      return res.status(400).json({ error: 'Verificatietoken ontbreekt.' });
    }

    const tokenHash = hashToken(token);

    const { data: record } = await supabase
      .from('email_verification_tokens')
      .select('*')
      .eq('token_hash', tokenHash)
      .eq('user_id', req.user.id)
      .is('used_at', null)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!record) {
      return res.status(400).json({ error: 'Ongeldige of verlopen verificatielink.' });
    }

    const { data: taken } = await supabase
      .from('users')
      .select('id')
      .eq('email', record.new_email)
      .maybeSingle();

    if (taken) {
      return res.status(400).json({ error: 'Dit e-mailadres is inmiddels al in gebruik.' });
    }

    await supabase.from('users').update({ email: record.new_email }).eq('id', req.user.id);
    await supabase.from('email_verification_tokens').update({ used_at: new Date().toISOString() }).eq('id', record.id);

    return res.json({ message: 'E-mailadres succesvol gewijzigd.' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

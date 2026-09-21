const express = require('express');
const path = require('path');
const fs = require('node:fs');
const multer = require('multer');
const { supabase } = require('../db/client');

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

module.exports = router;

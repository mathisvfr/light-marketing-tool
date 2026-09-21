const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/client');
const { AUTH_COOKIE_NAME, requireAuth } = require('../middleware/auth');
const { sendPasswordReset } = require('../services/notifications');
const { logActivity } = require('../services/activityLog');

const router = express.Router();

// Bcrypt hash of a random throwaway value. Used to equalize response timing
// when the account does not exist, preventing user enumeration.
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);

function getCookieConfig() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 8 * 60 * 60 * 1000,
    path: '/',
  };
}

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'E-mail en wachtwoord zijn verplicht.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role, password_hash')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error || !user) {
      // Still run a compare against a dummy hash so the response timing does
      // not reveal whether the e-mail exists.
      await bcrypt.compare(password, DUMMY_HASH);
      return res.status(401).json({ error: 'Ongeldige inloggegevens.' });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({ error: 'Ongeldige inloggegevens.' });
    }

    const token = jwt.sign(
      {
        role: user.role,
        email: user.email,
        name: user.name,
      },
      process.env.JWT_SECRET,
      {
        subject: user.id,
        expiresIn: '8h',
      }
    );

    res.cookie(AUTH_COOKIE_NAME, token, getCookieConfig());

    // Track last login
    await supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);

    logActivity(user.id, user.name, 'login', 'user', user.id);

    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/me', requireAuth, (req, res) => {
  return res.json({ user: req.user });
});

router.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return res.status(204).send();
});

// PATCH /password — change own password (requires auth)
router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Huidig wachtwoord en nieuw wachtwoord zijn verplicht.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 8 tekens bevatten.' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, password_hash')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error || !user) {
      return res.status(400).json({ error: 'Gebruiker niet gevonden.' });
    }

    const matches = await bcrypt.compare(currentPassword, user.password_hash);
    if (!matches) {
      return res.status(400).json({ error: 'Huidig wachtwoord is onjuist.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const now = new Date().toISOString();

    await supabase
      .from('users')
      .update({ password_hash: hash, password_changed_at: now })
      .eq('id', req.user.id);

    return res.json({ message: 'Wachtwoord succesvol gewijzigd.' });
  } catch (err) {
    return next(err);
  }
});

// POST /forgot-password — request a password reset link (no auth)
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body || {};

    // Always return 200 to prevent user enumeration
    if (!email) {
      return res.json({ message: 'Als dit e-mailadres bij ons bekend is, ontvang je een resetlink.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: user } = await supabase
      .from('users')
      .select('id, name, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!user) {
      return res.json({ message: 'Als dit e-mailadres bij ons bekend is, ontvang je een resetlink.' });
    }

    // Rate limit: max 3 tokens per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('password_reset_tokens')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', oneHourAgo);

    if (count >= 3) {
      return res.json({ message: 'Als dit e-mailadres bij ons bekend is, ontvang je een resetlink.' });
    }

    // Generate token
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await supabase.from('password_reset_tokens').insert({
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });

    // Build reset link
    const baseUrl = (process.env.PUBLIC_APP_URL || process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const resetLink = `${baseUrl}/wachtwoord-resetten?token=${rawToken}`;

    // Send email (fire-and-forget, don't block response)
    sendPasswordReset(user.email, user.name, resetLink).catch((err) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[auth] password reset email failed:', err.message);
      }
    });

    return res.json({ message: 'Als dit e-mailadres bij ons bekend is, ontvang je een resetlink.' });
  } catch (err) {
    return next(err);
  }
});

// POST /reset-password — set new password using a reset token (no auth)
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, newPassword } = req.body || {};

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token en nieuw wachtwoord zijn verplicht.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Nieuw wachtwoord moet minimaal 8 tekens bevatten.' });
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const now = new Date().toISOString();

    const { data: resetToken, error: tokenErr } = await supabase
      .from('password_reset_tokens')
      .select('id, user_id')
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', now)
      .maybeSingle();

    if (tokenErr || !resetToken) {
      return res.status(400).json({ error: 'Ongeldige of verlopen resetlink. Vraag een nieuwe aan.' });
    }

    const hash = await bcrypt.hash(newPassword, 12);

    await supabase
      .from('users')
      .update({ password_hash: hash, password_changed_at: now })
      .eq('id', resetToken.user_id);

    await supabase
      .from('password_reset_tokens')
      .update({ used_at: now })
      .eq('id', resetToken.id);

    return res.json({ message: 'Wachtwoord succesvol gewijzigd. Je kunt nu inloggen.' });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;

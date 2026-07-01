const express = require('express');
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { supabase } = require('../db/client');
const { AUTH_COOKIE_NAME, requireAuth } = require('../middleware/auth');

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

module.exports = router;

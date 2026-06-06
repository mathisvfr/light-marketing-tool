const jwt = require('jsonwebtoken');
const { supabase } = require('../db/client');

const AUTH_COOKIE_NAME = 'light_auth_token';

async function requireAuth(req, res, next) {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ error: 'Niet ingelogd.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, email, role')
      .eq('id', decoded.sub)
      .maybeSingle();

    if (error || !user) {
      return res.status(401).json({ error: 'Sessie is ongeldig of verlopen.' });
    }

    req.user = user;
    return next();
  } catch (_error) {
    return res.status(401).json({ error: 'Sessie is ongeldig of verlopen.' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Niet ingelogd.' });
    }

    if (req.user.role !== role) {
      return res.status(403).json({ error: 'Je hebt geen toegang tot deze actie.' });
    }

    return next();
  };
}

module.exports = {
  AUTH_COOKIE_NAME,
  requireAuth,
  requireRole,
};

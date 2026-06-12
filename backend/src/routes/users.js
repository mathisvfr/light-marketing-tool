const express = require('express');
const bcrypt = require('bcryptjs');
const { supabase } = require('../db/client');
const { requireRole } = require('../middleware/auth');

const router = express.Router();
const ALLOWED_ROLES = ['owner', 'recruiter', 'viewer'];

router.use(requireRole('owner'));

async function getOwnerCount() {
  const { count, error } = await supabase
    .from('users')
    .select('*', { head: true, count: 'exact' })
    .eq('role', 'owner');

  if (error) {
    throw error;
  }

  return count || 0;
}

router.get('/', async (_req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    const users = (data || []).map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      createdAt: item.created_at,
    }));

    return res.json({ users });
  } catch (error) {
    return next(error);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const temporaryPassword = String(req.body?.temporaryPassword || '');
    const role = String(req.body?.role || 'viewer').trim();

    if (!name || !email || !temporaryPassword) {
      return res.status(400).json({ error: 'Naam, e-mail en tijdelijk wachtwoord zijn verplicht.' });
    }

    if (!ALLOWED_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Ongeldige rol gekozen.' });
    }

    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const payload = {
      name,
      email,
      password_hash: passwordHash,
      role,
    };

    const { data, error } = await supabase
      .from('users')
      .insert(payload)
      .select('id, name, email, role, created_at')
      .single();

    if (error) {
      if (String(error.message || '').toLowerCase().includes('duplicate')) {
        return res.status(400).json({ error: 'E-mail bestaat al.' });
      }

      throw error;
    }

    return res.status(201).json({
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.patch('/:id/role', async (req, res, next) => {
  try {
    const userId = req.params.id;
    const newRole = String(req.body?.role || '').trim();

    if (!ALLOWED_ROLES.includes(newRole)) {
      return res.status(400).json({ error: 'Ongeldige rol gekozen.' });
    }

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }

    if (user.role === 'owner' && newRole !== 'owner') {
      const ownerCount = await getOwnerCount();
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Je kunt de laatste owner niet degraderen.' });
      }
    }

    const { data, error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)
      .select('id, name, email, role, created_at')
      .single();

    if (error) {
      throw error;
    }

    return res.json({
      user: {
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    return next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.params.id;

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      throw userError;
    }

    if (!user) {
      return res.status(404).json({ error: 'Gebruiker niet gevonden.' });
    }

    if (user.id === req.user.id) {
      return res.status(400).json({ error: 'Je kunt je eigen account niet verwijderen.' });
    }

    if (user.role === 'owner') {
      const ownerCount = await getOwnerCount();
      if (ownerCount <= 1) {
        return res.status(400).json({ error: 'Je kunt de laatste owner niet verwijderen.' });
      }
    }

    const { error } = await supabase.from('users').delete().eq('id', userId);

    if (error) {
      throw error;
    }

    return res.status(204).send();
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

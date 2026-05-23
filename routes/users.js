const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

const JWT_SECRET  = process.env.JWT_SECRET  || 'change_me_in_production';
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';

// ── POST /api/users/register ──────────────────────────────────────────────────
router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'name, email, and password are required' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const { rows: [existing] } = await db.query(
      'SELECT id FROM users WHERE email = $1', [email.toLowerCase()]
    );
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 12);
    const { rows: [user] } = await db.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, role, created_at`,
      [name, email.toLowerCase(), hash]
    );

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });

    res.status(201).json({ user, token });
  } catch (err) { next(err); }
});

// ── POST /api/users/login ─────────────────────────────────────────────────────
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'email and password are required' });

    const { rows: [user] } = await db.query(
      'SELECT * FROM users WHERE email = $1', [email.toLowerCase()]
    );
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES,
    });

    const { password_hash: _, ...safeUser } = user;
    res.json({ user: safeUser, token });
  } catch (err) { next(err); }
});

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const { rows: [user] } = await db.query(
      'SELECT id, name, email, role, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) { next(err); }
});

// ── PATCH /api/users/me ───────────────────────────────────────────────────────
router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const { name, password } = req.body;
    const updates = [];
    const values  = [];
    let    idx     = 1;

    if (name) {
      updates.push(`name = $${idx++}`);
      values.push(name);
    }
    if (password) {
      if (password.length < 8)
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      updates.push(`password_hash = $${idx++}`);
      values.push(await bcrypt.hash(password, 12));
    }

    if (!updates.length)
      return res.status(400).json({ error: 'Nothing to update' });

    values.push(req.user.id);
    const { rows: [user] } = await db.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW()
       WHERE  id = $${idx}
       RETURNING id, name, email, role, updated_at`,
      values
    );
    res.json(user);
  } catch (err) { next(err); }
});

module.exports = router;
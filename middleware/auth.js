const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';

/**
 * Verifies the Bearer token from the Authorization header.
 * Attaches { id, role } to req.user on success.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });

  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token expired or invalid' });
  }
}

/**
 * Must be used AFTER authenticate.
 * Rejects non-admin users with 403.
 */
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin')
    return res.status(403).json({ error: 'Admin access required' });
  next();
}

module.exports = { authenticate, requireAdmin };

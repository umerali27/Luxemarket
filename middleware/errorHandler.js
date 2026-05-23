/**
 * Express error-handling middleware.
 * Must be registered LAST with app.use(errorHandler).
 */
function errorHandler(err, req, res, _next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.path}`, err);

  // PostgreSQL unique-constraint violation
  if (err.code === '23505')
    return res.status(409).json({ error: 'Duplicate entry — resource already exists' });

  // PostgreSQL foreign-key violation
  if (err.code === '23503')
    return res.status(400).json({ error: 'Referenced resource does not exist' });

  // Generic fallback
  const status  = err.status  || 500;
  const message = err.message || 'Internal server error';
  res.status(status).json({ error: message });
}

module.exports = { errorHandler };

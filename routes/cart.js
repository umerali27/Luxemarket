const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

// All cart routes require a logged-in user
router.use(authenticate);

// ── GET /api/cart ─────────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT ci.id,
              ci.quantity,
              p.id          AS product_id,
              p.name,
              p.price,
              p.image_url,
              p.stock,
              (ci.quantity * p.price)::NUMERIC(10,2) AS line_total
       FROM   cart_items ci
       JOIN   products   p  ON p.id = ci.product_id
       WHERE  ci.user_id = $1
       ORDER  BY ci.created_at`,
      [req.user.id]
    );

    const subtotal = rows.reduce((s, r) => s + Number(r.line_total), 0);
    res.json({ items: rows, subtotal: subtotal.toFixed(2) });
  } catch (err) { next(err); }
});

// ── POST /api/cart ────────────────────────────────────────────────────────────
router.post('/', async (req, res, next) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ error: 'product_id is required' });

    // Check stock
    const { rows: [product] } = await db.query(
      'SELECT stock FROM products WHERE id = $1', [product_id]
    );
    if (!product)       return res.status(404).json({ error: 'Product not found' });
    if (product.stock < quantity)
      return res.status(409).json({ error: 'Insufficient stock' });

    // Upsert: add qty if item already in cart
    const { rows } = await db.query(
      `INSERT INTO cart_items (user_id, product_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, product_id)
         DO UPDATE SET quantity    = cart_items.quantity + EXCLUDED.quantity,
                       updated_at  = NOW()
       RETURNING *`,
      [req.user.id, product_id, quantity]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── PATCH /api/cart/:itemId ───────────────────────────────────────────────────
router.patch('/:itemId', async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1)
      return res.status(400).json({ error: 'quantity must be >= 1' });

    const { rows } = await db.query(
      `UPDATE cart_items
       SET    quantity = $1, updated_at = NOW()
       WHERE  id = $2 AND user_id = $3
       RETURNING *`,
      [quantity, req.params.itemId, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Cart item not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── DELETE /api/cart/:itemId ──────────────────────────────────────────────────
router.delete('/:itemId', async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM cart_items WHERE id = $1 AND user_id = $2',
      [req.params.itemId, req.user.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Cart item not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── DELETE /api/cart  (clear entire cart) ────────────────────────────────────
router.delete('/', async (req, res, next) => {
  try {
    await db.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;

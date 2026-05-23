const router = require('express').Router();
const db     = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// ── GET /api/orders ───────────────────────────────────────────────────────────
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT o.id, o.status, o.total, o.created_at,
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'product_id',   oi.product_id,
                  'product_name', p.name,
                  'quantity',     oi.quantity,
                  'unit_price',   oi.unit_price,
                  'line_total',   oi.quantity * oi.unit_price
                )
              ) AS items
       FROM   orders       o
       JOIN   order_items  oi ON oi.order_id   = o.id
       JOIN   products     p  ON p.id          = oi.product_id
       WHERE  o.user_id = $1
       GROUP  BY o.id
       ORDER  BY o.created_at DESC`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/orders/:id ───────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT o.*, u.name AS customer_name, u.email AS customer_email,
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'product_id',   oi.product_id,
                  'product_name', p.name,
                  'image_url',    p.image_url,
                  'quantity',     oi.quantity,
                  'unit_price',   oi.unit_price
                )
              ) AS items
       FROM   orders       o
       JOIN   users        u  ON u.id          = o.user_id
       JOIN   order_items  oi ON oi.order_id   = o.id
       JOIN   products     p  ON p.id          = oi.product_id
       WHERE  o.id = $1 AND o.user_id = $2
       GROUP  BY o.id, u.name, u.email`,
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Order not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── POST /api/orders  (checkout) ─────────────────────────────────────────────
// Wraps cart → order conversion in a DB transaction:
//   1. Read cart items
//   2. Validate stock for each item
//   3. Create order + order_items rows
//   4. Decrement product stock
//   5. Clear cart
router.post('/', async (req, res, next) => {
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // 1. Read cart
    const { rows: cartItems } = await client.query(
      `SELECT ci.product_id, ci.quantity, p.price, p.stock, p.name
       FROM   cart_items ci
       JOIN   products   p ON p.id = ci.product_id
       WHERE  ci.user_id = $1
       FOR UPDATE`,           // lock rows during transaction
      [req.user.id]
    );

    if (!cartItems.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // 2. Stock validation
    for (const item of cartItems) {
      if (item.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          error: `Insufficient stock for "${item.name}" (available: ${item.stock})`,
        });
      }
    }

    // 3. Create order
    const total = cartItems.reduce(
      (sum, i) => sum + Number(i.price) * i.quantity, 0
    );

    const { rows: [order] } = await client.query(
      `INSERT INTO orders (user_id, total, status)
       VALUES ($1, $2, 'confirmed')
       RETURNING *`,
      [req.user.id, total.toFixed(2)]
    );

    // 4. Insert order_items + decrement stock
    for (const item of cartItems) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, unit_price)
         VALUES ($1, $2, $3, $4)`,
        [order.id, item.product_id, item.quantity, item.price]
      );
      await client.query(
        `UPDATE products SET stock = stock - $1 WHERE id = $2`,
        [item.quantity, item.product_id]
      );
    }

    // 5. Clear cart
    await client.query(
      'DELETE FROM cart_items WHERE user_id = $1', [req.user.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...order, items: cartItems });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

module.exports = router;

const router  = require('express').Router();
const db      = require('../db');
const { authenticate, requireAdmin } = require('../middleware/auth');

// ── GET /api/products ─────────────────────────────────────────────────────────
// Query params: category, minPrice, maxPrice, search, sort, page, limit
router.get('/', async (req, res, next) => {
  try {
    const {
      category,
      minPrice,
      maxPrice,
      search,
      sort     = 'created_at',
      order    = 'DESC',
      page     = 1,
      limit    = 12,
    } = req.query;

    const conditions = ['p.stock > 0'];
    const values     = [];
    let   idx        = 1;

    if (category) {
      conditions.push(`p.category = $${idx++}`);
      values.push(category);
    }
    if (minPrice) {
      conditions.push(`p.price >= $${idx++}`);
      values.push(Number(minPrice));
    }
    if (maxPrice) {
      conditions.push(`p.price <= $${idx++}`);
      values.push(Number(maxPrice));
    }
    if (search) {
      conditions.push(`(p.name ILIKE $${idx} OR p.description ILIKE $${idx})`);
      values.push(`%${search}%`);
      idx++;
    }

    const allowedSorts  = ['price', 'name', 'created_at', 'stock'];
    const allowedOrders = ['ASC', 'DESC'];
    const safeSort  = allowedSorts.includes(sort)   ? sort  : 'created_at';
    const safeOrder = allowedOrders.includes(order.toUpperCase())
      ? order.toUpperCase() : 'DESC';

    const offset = (Number(page) - 1) * Number(limit);

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await db.query(
      `SELECT p.*,
              COALESCE(AVG(r.rating), 0)::NUMERIC(3,1) AS avg_rating,
              COUNT(r.id)::INT                          AS review_count
       FROM   products p
       LEFT JOIN reviews r ON r.product_id = p.id
       ${where}
       GROUP BY p.id
       ORDER BY p.${safeSort} ${safeOrder}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, Number(limit), offset]
    );

    const { rows: [{ total }] } = await db.query(
      `SELECT COUNT(*)::INT AS total FROM products p ${where}`,
      values
    );

    res.json({
      data:       rows,
      pagination: {
        total,
        page:       Number(page),
        limit:      Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) { next(err); }
});

// ── GET /api/products/categories ─────────────────────────────────────────────
router.get('/categories', async (_req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT category, COUNT(*)::INT AS count
       FROM   products
       WHERE  stock > 0
       GROUP  BY category
       ORDER  BY category`
    );
    res.json(rows);
  } catch (err) { next(err); }
});

// ── GET /api/products/:id ─────────────────────────────────────────────────────
router.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*,
              COALESCE(AVG(r.rating), 0)::NUMERIC(3,1) AS avg_rating,
              COUNT(r.id)::INT                          AS review_count,
              JSON_AGG(
                JSON_BUILD_OBJECT(
                  'id',         r.id,
                  'rating',     r.rating,
                  'comment',    r.comment,
                  'created_at', r.created_at,
                  'user_name',  u.name
                ) ORDER BY r.created_at DESC
              ) FILTER (WHERE r.id IS NOT NULL) AS reviews
       FROM   products p
       LEFT JOIN reviews r ON r.product_id = p.id
       LEFT JOIN users   u ON u.id = r.user_id
       WHERE  p.id = $1
       GROUP  BY p.id`,
      [req.params.id]
    );

    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── POST /api/products  (admin only) ─────────────────────────────────────────
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { name, description, category, price, stock, image_url } = req.body;

    if (!name || !price || !category)
      return res.status(400).json({ error: 'name, price and category are required' });

    const { rows } = await db.query(
      `INSERT INTO products (name, description, category, price, stock, image_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, category, price, stock ?? 0, image_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── PATCH /api/products/:id  (admin only) ─────────────────────────────────────
router.patch('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const fields  = ['name','description','category','price','stock','image_url'];
    const updates = [];
    const values  = [];
    let   idx     = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx++}`);
        values.push(req.body[field]);
      }
    }

    if (!updates.length)
      return res.status(400).json({ error: 'No valid fields to update' });

    values.push(req.params.id);
    const { rows } = await db.query(
      `UPDATE products SET ${updates.join(', ')}, updated_at = NOW()
       WHERE  id = $${idx}
       RETURNING *`,
      values
    );

    if (!rows.length) return res.status(404).json({ error: 'Product not found' });
    res.json(rows[0]);
  } catch (err) { next(err); }
});

// ── DELETE /api/products/:id  (admin only) ────────────────────────────────────
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM products WHERE id = $1', [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Product not found' });
    res.status(204).end();
  } catch (err) { next(err); }
});

module.exports = router;

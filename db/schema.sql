-- =============================================================================
-- LuxeMarket E-Commerce — PostgreSQL Schema
-- Tier 3: Data Layer
-- Run: psql -U postgres -d luxemarket -f db/schema.sql
-- =============================================================================

-- ── Extensions ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), pgcrypto funcs

-- =============================================================================
-- USERS
-- Stores customer and admin accounts.
-- password_hash is a bcrypt hash — never store plain-text passwords.
-- =============================================================================
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL          PRIMARY KEY,
  name          VARCHAR(255)    NOT NULL,
  email         VARCHAR(255)    NOT NULL UNIQUE,
  password_hash TEXT            NOT NULL,
  role          VARCHAR(20)     NOT NULL DEFAULT 'customer'
                                CHECK (role IN ('customer', 'admin')),
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);

-- =============================================================================
-- CATEGORIES
-- Separate table so categories can have descriptions, slugs, images, etc.
-- =============================================================================
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL        PRIMARY KEY,
  name        VARCHAR(100)  NOT NULL UNIQUE,
  slug        VARCHAR(100)  NOT NULL UNIQUE,
  description TEXT,
  image_url   TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- PRODUCTS
-- Core product catalogue. References categories table.
-- =============================================================================
CREATE TABLE IF NOT EXISTS products (
  id            SERIAL           PRIMARY KEY,
  name          VARCHAR(255)     NOT NULL,
  description   TEXT,
  category_id   INT              REFERENCES categories (id) ON DELETE SET NULL,
  price         NUMERIC(10, 2)   NOT NULL CHECK (price >= 0),
  stock         INT              NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url     TEXT,
  is_active     BOOLEAN          NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category  ON products (category_id);
CREATE INDEX IF NOT EXISTS idx_products_price     ON products (price);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products (is_active);

-- Full-text search index on name + description
CREATE INDEX IF NOT EXISTS idx_products_fts
  ON products USING GIN (
    to_tsvector('english', name || ' ' || COALESCE(description, ''))
  );

-- =============================================================================
-- CART ITEMS
-- One row per (user, product) pair. Quantity is updated in-place via upsert.
-- Deleted automatically when the user or product is deleted (CASCADE).
-- =============================================================================
CREATE TABLE IF NOT EXISTS cart_items (
  id          SERIAL        PRIMARY KEY,
  user_id     INT           NOT NULL REFERENCES users    (id) ON DELETE CASCADE,
  product_id  INT           NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  quantity    INT           NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)         -- prevents duplicate rows; use upsert
);

CREATE INDEX IF NOT EXISTS idx_cart_items_user ON cart_items (user_id);

-- =============================================================================
-- ORDERS
-- One order per checkout. Status follows a simple lifecycle:
--   pending → confirmed → shipped → delivered | cancelled
-- =============================================================================
CREATE TABLE IF NOT EXISTS orders (
  id          SERIAL          PRIMARY KEY,
  user_id     INT             NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  total       NUMERIC(10, 2)  NOT NULL CHECK (total >= 0),
  status      VARCHAR(30)     NOT NULL DEFAULT 'pending'
                              CHECK (status IN
                                ('pending','confirmed','shipped','delivered','cancelled')),
  notes       TEXT,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id   ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status    ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created   ON orders (created_at DESC);

-- =============================================================================
-- ORDER ITEMS
-- Snapshot of product price at time of purchase (unit_price never changes
-- even if the product price is updated later).
-- =============================================================================
CREATE TABLE IF NOT EXISTS order_items (
  id          SERIAL          PRIMARY KEY,
  order_id    INT             NOT NULL REFERENCES orders   (id) ON DELETE CASCADE,
  product_id  INT             NOT NULL REFERENCES products (id) ON DELETE RESTRICT,
  quantity    INT             NOT NULL CHECK (quantity >= 1),
  unit_price  NUMERIC(10, 2)  NOT NULL CHECK (unit_price >= 0),
  line_total  NUMERIC(10, 2)  GENERATED ALWAYS AS (quantity * unit_price) STORED
);

CREATE INDEX IF NOT EXISTS idx_order_items_order   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id);

-- =============================================================================
-- REVIEWS
-- One review per (user, product) pair. Rating must be 1–5.
-- =============================================================================
CREATE TABLE IF NOT EXISTS reviews (
  id          SERIAL        PRIMARY KEY,
  product_id  INT           NOT NULL REFERENCES products (id) ON DELETE CASCADE,
  user_id     INT           NOT NULL REFERENCES users    (id) ON DELETE CASCADE,
  rating      SMALLINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)         -- one review per user per product
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews (product_id);

-- =============================================================================
-- TRIGGER: auto-update updated_at on every UPDATE
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DO $$ DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users','products','cart_items','orders','reviews']
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_%1$s_updated_at ON %1$s;
       CREATE TRIGGER trg_%1$s_updated_at
         BEFORE UPDATE ON %1$s
         FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t
    );
  END LOOP;
END $$;

-- =============================================================================
-- SEED DATA — sample categories and products
-- =============================================================================
INSERT INTO categories (name, slug, description) VALUES
  ('Electronics', 'electronics', 'Gadgets, devices, and tech accessories'),
  ('Fashion',     'fashion',     'Clothing, shoes, and accessories'),
  ('Home',        'home',        'Furniture, décor, and kitchen'),
  ('Beauty',      'beauty',      'Skincare, haircare, and cosmetics')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO products (name, description, category_id, price, stock, image_url) VALUES
  ('Wireless Noise-Cancelling Headphones',
   'Over-ear headphones with 30hr battery and premium ANC.',
   (SELECT id FROM categories WHERE slug='electronics'), 129.00, 42, NULL),

  ('4K USB-C Monitor 27"',
   'Crystal-clear 4K IPS display with USB-C 90W power delivery.',
   (SELECT id FROM categories WHERE slug='electronics'), 349.00, 15, NULL),

  ('Merino Wool Crew Neck Sweater',
   '100% merino wool, breathable and itch-free. Available in 6 colours.',
   (SELECT id FROM categories WHERE slug='fashion'), 89.00, 80, NULL),

  ('Ceramic Pour-Over Coffee Set',
   'Handcrafted ceramic dripper, carafe, and two mugs.',
   (SELECT id FROM categories WHERE slug='home'), 54.00, 30, NULL),

  ('Linen Table Runner Set',
   'Set of two 180cm stone-washed linen table runners.',
   (SELECT id FROM categories WHERE slug='home'), 38.00, 55, NULL),

  ('Botanical Face Serum',
   'Vitamin C + hyaluronic acid serum for radiant skin. 30ml.',
   (SELECT id FROM categories WHERE slug='beauty'), 42.00, 120, NULL)
ON CONFLICT DO NOTHING;

-- =============================================================================
-- USEFUL VIEWS
-- =============================================================================

-- Product summary with live avg rating and review count
CREATE OR REPLACE VIEW v_products AS
SELECT
  p.*,
  c.name                                        AS category_name,
  c.slug                                        AS category_slug,
  COALESCE(AVG(r.rating), 0)::NUMERIC(3,1)      AS avg_rating,
  COUNT(r.id)::INT                              AS review_count
FROM  products   p
LEFT  JOIN categories c ON c.id = p.category_id
LEFT  JOIN reviews    r ON r.product_id = p.id
WHERE p.is_active = TRUE
GROUP BY p.id, c.name, c.slug;

-- Order summary per user
CREATE OR REPLACE VIEW v_order_summary AS
SELECT
  o.id,
  o.status,
  o.total,
  o.created_at,
  u.name  AS customer_name,
  u.email AS customer_email,
  COUNT(oi.id)::INT AS item_count
FROM  orders      o
JOIN  users       u  ON u.id = o.user_id
JOIN  order_items oi ON oi.order_id = o.id
GROUP BY o.id, u.name, u.email;

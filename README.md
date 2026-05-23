# LuxeMarket API — Tier 2 (Business Logic)

Node.js + Express REST API connecting the React frontend (Tier 1) to PostgreSQL (Tier 3).

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your DB credentials and a strong JWT_SECRET

# 3. Create the database (run the schema from db/schema.sql first)
psql -U postgres -c "CREATE DATABASE luxemarket;"
psql -U postgres -d luxemarket -f db/schema.sql

# 4. Start the dev server
npm run dev
```

Server starts at **http://localhost:3001**

---

## Endpoint Reference

### Products
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/products | — | List/filter products |
| GET | /api/products/categories | — | All categories + counts |
| GET | /api/products/:id | — | Single product with reviews |
| POST | /api/products | Admin | Create product |
| PATCH | /api/products/:id | Admin | Update product |
| DELETE | /api/products/:id | Admin | Delete product |

**GET /api/products query params:**
- `category` — filter by category name
- `minPrice` / `maxPrice` — price range
- `search` — full-text search (name + description)
- `sort` — `price | name | created_at | stock` (default: `created_at`)
- `order` — `ASC | DESC` (default: `DESC`)
- `page` / `limit` — pagination (default: page=1, limit=12)

### Users / Auth
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/users/register | — | Register new user |
| POST | /api/users/login | — | Login → returns JWT |
| GET | /api/users/me | User | Get own profile |
| PATCH | /api/users/me | User | Update name / password |

### Cart
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/cart | User | Get cart + subtotal |
| POST | /api/cart | User | Add item (upserts qty) |
| PATCH | /api/cart/:itemId | User | Update quantity |
| DELETE | /api/cart/:itemId | User | Remove item |
| DELETE | /api/cart | User | Clear entire cart |

### Orders
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/orders | User | List own orders |
| GET | /api/orders/:id | User | Order detail with items |
| POST | /api/orders | User | Checkout (cart → order) |

---

## Authentication

All protected routes expect:
```
Authorization: Bearer <jwt_token>
```
Tokens are returned by `/api/users/register` and `/api/users/login`.

---

## Project Structure

```
ecommerce-api/
├── server.js              # Entry point — Express app + middleware
├── package.json
├── .env.example
├── db/
│   └── index.js           # pg Pool — shared query helper
├── routes/
│   ├── products.js        # CRUD + filtering + pagination
│   ├── cart.js            # Cart management with stock checks
│   ├── orders.js          # Checkout with DB transactions
│   └── users.js           # Register / login / profile
└── middleware/
    ├── auth.js            # JWT verify + requireAdmin guard
    └── errorHandler.js    # Global Express error handler
```

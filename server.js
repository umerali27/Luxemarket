require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const path    = require('path');

const usersRouter    = require('./routes/users');
const productsRouter = require('./routes/products');
const cartRouter     = require('./routes/cart');
const ordersRouter   = require('./routes/orders');

const { errorHandler } = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3001;

/* ---------------- SECURITY MIDDLEWARE ---------------- */

app.use(helmet());

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000'
}));

/* ---------------- GENERAL MIDDLEWARE ---------------- */

app.use(morgan('dev'));
app.use(express.json());

/* ---------------- STATIC FILES ---------------- */

app.use(express.static(path.join(__dirname, 'public')));

/* ---------------- FRONTEND PAGE ROUTES ---------------- */

const sendPage = (file) => (_req, res) =>
  res.sendFile(path.join(__dirname, 'public', file));

app.get('/',          sendPage('index.html'));
app.get('/products',  sendPage('products.html'));
app.get('/product',   sendPage('product.html'));
app.get('/cart',      sendPage('cart.html'));
app.get('/orders',    sendPage('orders.html'));
app.get('/profile',   sendPage('user.html'));
app.get('/login',     sendPage('index.html'));   // redirect to home until login.html exists
app.get('/register',  sendPage('index.html'));   // redirect to home until register.html exists

/* ---------------- API ROUTES ---------------- */

app.use('/api/users',    usersRouter);
app.use('/api/products', productsRouter);
app.use('/api/cart',     cartRouter);
app.use('/api/orders',   ordersRouter);

/* ---------------- 404 HANDLER ---------------- */

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

/* ---------------- ERROR HANDLER (must be last) ---------------- */

app.use(errorHandler);

/* ---------------- START SERVER ---------------- */

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
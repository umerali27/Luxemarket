const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || 'luxemarket',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'your_password',
  max:      10,          // max pool connections
  idleTimeoutMillis:    30_000,
  connectionTimeoutMillis: 2_000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error:', err);
  process.exit(-1);
});

module.exports = {
  query:   (text, params) => pool.query(text, params),
  getClient: ()           => pool.connect(),
};

const { Pool } = require('pg');
require('dotenv').config(); // Loads your DATABASE_URL from the .env file

const pool = new Pool({
  // Use the connection string from your environment variables
  connectionString: process.env.DATABASE_URL,
  ssl: {
    // Required for Neon and most cloud Postgres providers
    rejectUnauthorized: false 
  }
});

// Test connection (optional but helpful for logs)
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
  } else {
    console.log('✅ Database connected successfully at:', res.rows[0].now);
  }
});

module.exports = pool;

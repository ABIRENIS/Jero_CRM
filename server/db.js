const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',           // Your pgAdmin username
  host: 'localhost',
  database: 'jerobyte-crm',    // The DB name you created
  password: 'anjoe',   // Your PostgreSQL password
  port: 5432,
});

module.exports = pool;
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (e) {}

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD || '';
const DB_NAME = process.env.DB_NAME || 'tpayx_db';

async function init() {
  console.log(`[TpayX MySQL Init] Connecting to MySQL server at ${DB_HOST}:${DB_PORT} as user '${DB_USER}'...`);

  let connection;
  try {
    // 1. Connect without database first to ensure database exists
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      multipleStatements: true
    });

    console.log(`[TpayX MySQL Init] Creating database \`${DB_NAME}\` if not exists...`);
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await connection.query(`USE \`${DB_NAME}\`;`);

    // 2. Execute schema.sql
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      console.log(`[TpayX MySQL Init] Applying database/schema.sql...`);
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      await connection.query(schemaSql);
      console.log(`[TpayX MySQL Init] Schema applied successfully!`);
    }

    // 3. Execute seed_data.sql
    const seedPath = path.join(__dirname, 'seed_data.sql');
    if (fs.existsSync(seedPath)) {
      console.log(`[TpayX MySQL Init] Applying database/seed_data.sql (existing users, orders, settings)...`);
      const seedSql = fs.readFileSync(seedPath, 'utf8');
      await connection.query(seedSql);
      console.log(`[TpayX MySQL Init] Seed data imported successfully!`);
    }

    console.log(`\n======================================================`);
    console.log(` [SUCCESS] TpayX MySQL Database is 100% Initialized!`);
    console.log(` Database: \`${DB_NAME}\` on ${DB_HOST}:${DB_PORT}`);
    console.log(`======================================================\n`);

  } catch (err) {
    console.error(`\n[TpayX MySQL Init Error]:`, err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

init();

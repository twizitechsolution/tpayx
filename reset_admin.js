/**
 * Standalone Script: Reset Admin Login Credentials
 * Run via terminal: node reset_admin.js
 */
const path = require('path');
const fs = require('fs');

let dotenv;
try {
  dotenv = require('dotenv');
} catch (e) {
  try {
    dotenv = require('./backend/node_modules/dotenv');
  } catch (e2) {}
}

if (dotenv) {
  try {
    dotenv.config({ path: path.join(__dirname, 'backend/.env') });
    dotenv.config({ path: path.join(__dirname, '.env') });
    dotenv.config();
  } catch (e) {}
}

let mysql;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  try {
    mysql = require('./backend/node_modules/mysql2/promise');
  } catch (e2) {
    try {
      mysql = require(path.join(__dirname, 'backend/node_modules/mysql2/promise'));
    } catch (e3) {
      console.error('Could not load mysql2 module. Please run: cd backend && npm install');
      process.exit(1);
    }
  }
}

async function resetAdmin() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT) || 3306;
  const user = process.env.DB_USER || 'tpayx_user';
  const password = process.env.DB_PASSWORD || 'Tpayx@2026Secure';
  const database = process.env.DB_NAME || 'tpayx_db';

  console.log(`Connecting to MySQL database: ${database}@${host}:${port}...`);
  try {
    const connection = await mysql.createConnection({
      host,
      port,
      user,
      password,
      database
    });

    console.log('Connected to MySQL successfully!');

    // Create settings table if not exists
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`settings\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`key\` VARCHAR(100) NOT NULL UNIQUE,
        \`value\` LONGTEXT DEFAULT NULL,
        \`description\` TEXT DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Reset admin username and password
    const adminUser = 'admin';
    const adminPass = 'admin123';

    await connection.query(
      'INSERT INTO settings (`key`, `value`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
      ['admin_user', adminUser, 'Administrator username']
    );

    await connection.query(
      'INSERT INTO settings (`key`, `value`, `description`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)',
      ['admin_password', adminPass, 'Administrator password']
    );

    console.log('==================================================');
    console.log(' SUCCESS: ADMIN CREDENTIALS RESET IN DATABASE!');
    console.log(' Username : admin');
    console.log(' Password : admin123');
    console.log('==================================================');

    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('Failed to reset admin credentials in MySQL:', err.message);
    process.exit(1);
  }
}

resetAdmin();

/**
 * Standalone Script: Reset Admin Login Credentials
 * Run via terminal: node reset_admin.js
 */
const path = require('path');
const dotenv = require('dotenv');
try {
  dotenv.config({ path: path.join(__dirname, 'backend/.env') });
  dotenv.config({ path: path.join(__dirname, '.env') });
  dotenv.config();
} catch (e) {}

const mysql = require('mysql2/promise');

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

    console.log('--------------------------------------------------');
    console.log('? ADMIN CREDENTIALS HAVE BEEN SUCCESSFULLY RESET!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('--------------------------------------------------');

    await connection.end();
    process.exit(0);
  } catch (err) {
    console.error('? Failed to reset admin credentials in MySQL:', err.message);
    process.exit(1);
  }
}

resetAdmin();

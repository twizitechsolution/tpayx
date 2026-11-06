const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '.env.production') });
require('dotenv').config();

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_USER = process.env.DB_USER || 'tpayx_user';
const DB_PASSWORD = process.env.DB_PASSWORD || 'Tpayx@2026Secure';
const DB_NAME = process.env.DB_NAME || 'tpayx_db';

async function cleanup() {
  console.log(`[Merchant Cleanup] Connecting to MySQL at ${DB_HOST}:${DB_PORT} as ${DB_USER}...`);
  let connection;
  try {
    connection = await mysql.createConnection({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME
    });

    console.log('[Merchant Cleanup] Successfully connected to database.');

    // 1. Check rogue bank accounts
    const [rogueBanks] = await connection.query(`
      SELECT id, user_id, account_holder, bank_name, upi_id 
      FROM bank_accounts 
      WHERE LOWER(COALESCE(upi_id, '')) LIKE '%earnclub%'
         OR LOWER(COALESCE(account_holder, '')) LIKE '%official%'
         OR LOWER(COALESCE(bank_name, '')) LIKE '%official%'
    `);
    console.log(`[Merchant Cleanup] Found ${rogueBanks.length} rogue bank account(s):`, rogueBanks);

    if (rogueBanks.length > 0) {
      const [delResult] = await connection.query(`
        DELETE FROM bank_accounts 
        WHERE LOWER(COALESCE(upi_id, '')) LIKE '%earnclub%'
           OR LOWER(COALESCE(account_holder, '')) LIKE '%official%'
           OR LOWER(COALESCE(bank_name, '')) LIKE '%official%'
      `);
      console.log(`[Merchant Cleanup] Deleted ${delResult.affectedRows} rogue bank account row(s).`);
    }

    // 2. Clean rogue settings
    const [settings] = await connection.query(`
      SELECT \`key\`, \`value\` FROM settings 
      WHERE LOWER(COALESCE(\`value\`, '')) LIKE '%earnclub%'
         OR LOWER(COALESCE(\`value\`, '')) LIKE '%official%'
    `);
    console.log(`[Merchant Cleanup] Found ${settings.length} rogue settings entry/entries:`, settings);

    if (settings.length > 0) {
      await connection.query(`
        UPDATE settings SET \`value\` = '' 
        WHERE \`key\` IN ('admin_receiver_name', 'admin_bank_name') 
          AND LOWER(COALESCE(\`value\`, '')) LIKE '%official%'
      `);
      await connection.query(`
        UPDATE settings SET \`value\` = TRIM(BOTH ',' FROM REPLACE(REPLACE(\`value\`, 'Earnclub@apl', ''), 'earnclub@apl', ''))
        WHERE \`key\` = 'upi_ids' AND LOWER(\`value\`) LIKE '%earnclub%'
      `);
      console.log('[Merchant Cleanup] Sanitized settings entries.');
    }

    // 3. Print currently active bank accounts for Admin (user_id = 1)
    const [adminBanks] = await connection.query(`
      SELECT id, account_holder, bank_name, upi_id, status 
      FROM bank_accounts WHERE user_id = 1
    `);
    console.log('[Merchant Cleanup] Current Admin bank accounts in DB:', adminBanks);

    // 4. Print current upi_ids in settings
    const [upiRow] = await connection.query(`SELECT \`value\` FROM settings WHERE \`key\` = 'upi_ids' LIMIT 1`);
    console.log('[Merchant Cleanup] Current configured UPI IDs in settings:', upiRow[0]?.value || '(empty)');

    console.log('\n[SUCCESS] Merchant database cleanup complete!\n');
  } catch (err) {
    console.error('[Merchant Cleanup Error]:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

cleanup();

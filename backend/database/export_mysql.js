const fs = require('fs');
const path = require('path');

const dbJsonPath = path.join(__dirname, '../data/database.json');
const data = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
const db = data.dbData;

const outDir = path.join(__dirname, '../database');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

// 1. Generate schema.sql
const schemaSql = `-- TpayX Production Database Schema for MySQL / MariaDB (aaPanel)
-- Generated on ${new Date().toISOString()}

SET FOREIGN_KEY_CHECKS = 0;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`uid\` VARCHAR(32) NOT NULL UNIQUE,
  \`mobile\` VARCHAR(20) NOT NULL UNIQUE,
  \`username\` VARCHAR(100) DEFAULT NULL,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`pin\` VARCHAR(20) DEFAULT NULL,
  \`ref_code\` VARCHAR(32) NOT NULL UNIQUE,
  \`parent_id\` INT DEFAULT 0,
  \`inr_balance\` DECIMAL(14, 2) DEFAULT 0.00,
  \`bcoin_balance\` DECIMAL(14, 2) DEFAULT 0.00,
  \`usdt_balance\` DECIMAL(14, 2) DEFAULT 0.00,
  \`total_earnings\` DECIMAL(14, 2) DEFAULT 0.00,
  \`today_profit\` DECIMAL(14, 2) DEFAULT 0.00,
  \`yesterday_profit\` DECIMAL(14, 2) DEFAULT 0.00,
  \`is_blocked\` TINYINT(1) DEFAULT 0,
  \`role\` VARCHAR(20) DEFAULT 'user',
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX \`idx_users_mobile\` (\`mobile\`),
  INDEX \`idx_users_ref_code\` (\`ref_code\`),
  INDEX \`idx_users_parent_id\` (\`parent_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Bank Accounts Table
CREATE TABLE IF NOT EXISTS \`bank_accounts\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`account_holder\` VARCHAR(100) NOT NULL,
  \`bank_name\` VARCHAR(100) NOT NULL,
  \`account_number\` VARCHAR(64) NOT NULL,
  \`ifsc_code\` VARCHAR(32) NOT NULL,
  \`upi_id\` VARCHAR(100) DEFAULT NULL,
  \`status\` VARCHAR(20) DEFAULT 'Active',
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX \`idx_bank_user_id\` (\`user_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Orders Table
CREATE TABLE IF NOT EXISTS \`orders\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`order_id\` VARCHAR(64) NOT NULL UNIQUE,
  \`user_id\` INT NOT NULL,
  \`seller_id\` INT DEFAULT NULL,
  \`asset_type\` VARCHAR(20) DEFAULT 'INR',
  \`type\` VARCHAR(20) DEFAULT 'Buy',
  \`amount\` DECIMAL(14, 2) NOT NULL,
  \`quota\` DECIMAL(14, 2) DEFAULT 0.00,
  \`expected_income\` DECIMAL(14, 2) DEFAULT 0.00,
  \`status\` VARCHAR(32) DEFAULT 'Pending',
  \`utr\` VARCHAR(100) DEFAULT NULL,
  \`screenshot_path\` TEXT DEFAULT NULL,
  \`payment_method\` VARCHAR(50) DEFAULT 'Bank',
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX \`idx_orders_order_id\` (\`order_id\`),
  INDEX \`idx_orders_user_id\` (\`user_id\`),
  INDEX \`idx_orders_status\` (\`status\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Transactions Table
CREATE TABLE IF NOT EXISTS \`transactions\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`type\` VARCHAR(32) NOT NULL,
  \`amount\` DECIMAL(14, 2) NOT NULL,
  \`balance_after\` DECIMAL(14, 2) DEFAULT 0.00,
  \`description\` TEXT DEFAULT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX \`idx_txn_user_id\` (\`user_id\`),
  INDEX \`idx_txn_type\` (\`type\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. User Tasks Table
CREATE TABLE IF NOT EXISTS \`user_tasks\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`task_key\` VARCHAR(50) NOT NULL,
  \`completed\` TINYINT(1) DEFAULT 0,
  \`claimed\` TINYINT(1) DEFAULT 0,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY \`uniq_user_task\` (\`user_id\`, \`task_key\`),
  INDEX \`idx_task_user_id\` (\`user_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Messages Table
CREATE TABLE IF NOT EXISTS \`messages\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`title\` VARCHAR(255) NOT NULL,
  \`content\` TEXT NOT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Settings Table
CREATE TABLE IF NOT EXISTS \`settings\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`key\` VARCHAR(100) NOT NULL UNIQUE,
  \`value\` LONGTEXT DEFAULT NULL,
  \`description\` TEXT DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Commission Slabs Table
CREATE TABLE IF NOT EXISTS \`commission_slabs\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`min_amount\` DECIMAL(14, 2) NOT NULL,
  \`max_amount\` DECIMAL(14, 2) NOT NULL,
  \`commission_percent\` DECIMAL(5, 2) NOT NULL,
  \`flat_bonus\` DECIMAL(14, 2) DEFAULT 0.00
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Price Ranges Table
CREATE TABLE IF NOT EXISTS \`price_ranges\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`label\` VARCHAR(100) NOT NULL,
  \`min_val\` DECIMAL(14, 2) NOT NULL,
  \`max_val\` DECIMAL(14, 2) NOT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Products Table
CREATE TABLE IF NOT EXISTS \`products\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`name\` VARCHAR(100) NOT NULL,
  \`amount\` DECIMAL(14, 2) NOT NULL,
  \`income\` DECIMAL(14, 2) NOT NULL,
  \`quota\` DECIMAL(14, 2) NOT NULL,
  \`color\` VARCHAR(50) DEFAULT 'blue',
  \`type\` VARCHAR(50) DEFAULT 'Bank',
  \`percent\` VARCHAR(20) DEFAULT '2.5%',
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Sliders Table
CREATE TABLE IF NOT EXISTS \`sliders\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`image_data\` LONGTEXT NOT NULL,
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Withdrawals Table
CREATE TABLE IF NOT EXISTS \`withdrawals\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`amount\` DECIMAL(14, 2) NOT NULL,
  \`status\` VARCHAR(32) DEFAULT 'Pending',
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX \`idx_with_user\` (\`user_id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Disputes Table
CREATE TABLE IF NOT EXISTS \`disputes\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT NOT NULL,
  \`user_mobile\` VARCHAR(20) DEFAULT NULL,
  \`subject\` VARCHAR(255) NOT NULL,
  \`description\` TEXT NOT NULL,
  \`status\` VARCHAR(32) DEFAULT 'Open',
  \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Active OTPs Table
CREATE TABLE IF NOT EXISTS \`otps\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`mobile\` VARCHAR(20) NOT NULL UNIQUE,
  \`otp\` VARCHAR(10) NOT NULL,
  \`expires_at\` BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
`;

fs.writeFileSync(path.join(outDir, 'schema.sql'), schemaSql, 'utf8');
console.log('Successfully wrote database/schema.sql');

// 2. Generate seed_data.sql
function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? '0' : String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  let str = String(val).replace(/\\/g, '\\\\').replace(/'/g, "''").replace(/\r/g, '\\r').replace(/\n/g, '\\n');
  return `'${str}'`;
}

function formatDate(d) {
  if (!d) return 'CURRENT_TIMESTAMP';
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return 'CURRENT_TIMESTAMP';
    return `'${dt.toISOString().slice(0, 19).replace('T', ' ')}'`;
  } catch (e) {
    return 'CURRENT_TIMESTAMP';
  }
}

let seedSql = `-- TpayX Production Database Seed Data
-- Generated on ${new Date().toISOString()}

SET FOREIGN_KEY_CHECKS = 0;

`;

// Users
if (db.users && db.users.length) {
  seedSql += `-- Insert Users (${db.users.length} rows)\n`;
  for (const u of db.users) {
    seedSql += `INSERT INTO \`users\` (\`id\`, \`uid\`, \`mobile\`, \`username\`, \`password_hash\`, \`pin\`, \`ref_code\`, \`parent_id\`, \`inr_balance\`, \`bcoin_balance\`, \`usdt_balance\`, \`total_earnings\`, \`today_profit\`, \`yesterday_profit\`, \`is_blocked\`, \`role\`, \`created_at\`) VALUES (${u.id}, ${escapeSql(u.uid)}, ${escapeSql(u.mobile)}, ${escapeSql(u.username)}, ${escapeSql(u.password_hash)}, ${escapeSql(u.pin)}, ${escapeSql(u.ref_code)}, ${u.parent_id || 0}, ${u.inr_balance || 0}, ${u.bcoin_balance || 0}, ${u.usdt_balance || 0}, ${u.total_earnings || 0}, ${u.today_profit || 0}, ${u.yesterday_profit || 0}, ${u.is_blocked ? 1 : 0}, ${escapeSql(u.role || 'user')}, ${formatDate(u.created_at)}) ON DUPLICATE KEY UPDATE \`mobile\`=VALUES(\`mobile\`);\n`;
  }
  seedSql += '\n';
}

// Bank accounts
if (db.bank_accounts && db.bank_accounts.length) {
  seedSql += `-- Insert Bank Accounts (${db.bank_accounts.length} rows)\n`;
  for (const b of db.bank_accounts) {
    seedSql += `INSERT INTO \`bank_accounts\` (\`id\`, \`user_id\`, \`account_holder\`, \`bank_name\`, \`account_number\`, \`ifsc_code\`, \`upi_id\`, \`status\`, \`created_at\`) VALUES (${b.id}, ${b.user_id}, ${escapeSql(b.account_holder)}, ${escapeSql(b.bank_name)}, ${escapeSql(b.account_number)}, ${escapeSql(b.ifsc_code)}, ${escapeSql(b.upi_id)}, ${escapeSql(b.status || 'Active')}, ${formatDate(b.created_at)}) ON DUPLICATE KEY UPDATE \`account_number\`=VALUES(\`account_number\`);\n`;
  }
  seedSql += '\n';
}

// Orders
if (db.orders && db.orders.length) {
  seedSql += `-- Insert Orders (${db.orders.length} rows)\n`;
  for (const o of db.orders) {
    seedSql += `INSERT INTO \`orders\` (\`id\`, \`order_id\`, \`user_id\`, \`seller_id\`, \`asset_type\`, \`type\`, \`amount\`, \`quota\`, \`expected_income\`, \`status\`, \`utr\`, \`screenshot_path\`, \`payment_method\`, \`created_at\`) VALUES (${o.id}, ${escapeSql(o.order_id)}, ${o.user_id}, ${o.seller_id ? o.seller_id : 'NULL'}, ${escapeSql(o.asset_type || 'INR')}, ${escapeSql(o.type || 'Buy')}, ${o.amount || 0}, ${o.quota || 0}, ${o.expected_income || 0}, ${escapeSql(o.status || 'Pending')}, ${escapeSql(o.utr)}, ${escapeSql(o.screenshot_path)}, ${escapeSql(o.payment_method || 'Bank')}, ${formatDate(o.created_at)}) ON DUPLICATE KEY UPDATE \`order_id\`=VALUES(\`order_id\`);\n`;
  }
  seedSql += '\n';
}

// Transactions
if (db.transactions && db.transactions.length) {
  seedSql += `-- Insert Transactions (${db.transactions.length} rows)\n`;
  for (const t of db.transactions) {
    seedSql += `INSERT INTO \`transactions\` (\`id\`, \`user_id\`, \`type\`, \`amount\`, \`balance_after\`, \`description\`, \`created_at\`) VALUES (${t.id}, ${t.user_id}, ${escapeSql(t.type)}, ${t.amount || 0}, ${t.balance_after || 0}, ${escapeSql(t.description)}, ${formatDate(t.created_at)}) ON DUPLICATE KEY UPDATE \`id\`=VALUES(\`id\`);\n`;
  }
  seedSql += '\n';
}

// User tasks
if (db.user_tasks && db.user_tasks.length) {
  seedSql += `-- Insert User Tasks (${db.user_tasks.length} rows)\n`;
  for (const ut of db.user_tasks) {
    seedSql += `INSERT INTO \`user_tasks\` (\`id\`, \`user_id\`, \`task_key\`, \`completed\`, \`claimed\`, \`created_at\`) VALUES (${ut.id}, ${ut.user_id}, ${escapeSql(ut.task_key)}, ${ut.completed ? 1 : 0}, ${ut.claimed ? 1 : 0}, ${formatDate(ut.created_at)}) ON DUPLICATE KEY UPDATE \`completed\`=VALUES(\`completed\`);\n`;
  }
  seedSql += '\n';
}

// Messages
if (db.messages && db.messages.length) {
  seedSql += `-- Insert Messages (${db.messages.length} rows)\n`;
  for (const m of db.messages) {
    seedSql += `INSERT INTO \`messages\` (\`id\`, \`title\`, \`content\`, \`created_at\`) VALUES (${m.id}, ${escapeSql(m.title)}, ${escapeSql(m.content)}, ${formatDate(m.created_at)}) ON DUPLICATE KEY UPDATE \`title\`=VALUES(\`title\`);\n`;
  }
  seedSql += '\n';
}

// Commission Slabs
if (db.commission_slabs && db.commission_slabs.length) {
  seedSql += `-- Insert Commission Slabs (${db.commission_slabs.length} rows)\n`;
  for (const cs of db.commission_slabs) {
    seedSql += `INSERT INTO \`commission_slabs\` (\`id\`, \`min_amount\`, \`max_amount\`, \`commission_percent\`, \`flat_bonus\`) VALUES (${cs.id}, ${cs.min_amount}, ${cs.max_amount}, ${cs.commission_percent}, ${cs.flat_bonus || 0}) ON DUPLICATE KEY UPDATE \`commission_percent\`=VALUES(\`commission_percent\`);\n`;
  }
  seedSql += '\n';
}

// Settings
if (db.settings) {
  seedSql += `-- Insert Settings\n`;
  for (const k in db.settings) {
    const val = typeof db.settings[k] === 'object' ? JSON.stringify(db.settings[k]) : String(db.settings[k]);
    seedSql += `INSERT INTO \`settings\` (\`key\`, \`value\`, \`description\`) VALUES (${escapeSql(k)}, ${escapeSql(val)}, 'Global platform configuration') ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`);\n`;
  }
  seedSql += '\n';
}

// Price ranges
if (db.price_ranges && db.price_ranges.length) {
  seedSql += `-- Insert Price Ranges (${db.price_ranges.length} rows)\n`;
  for (const pr of db.price_ranges) {
    seedSql += `INSERT INTO \`price_ranges\` (\`id\`, \`label\`, \`min_val\`, \`max_val\`, \`created_at\`) VALUES (${pr.id}, ${escapeSql(pr.label)}, ${pr.min_val}, ${pr.max_val}, ${formatDate(pr.created_at)}) ON DUPLICATE KEY UPDATE \`label\`=VALUES(\`label\`);\n`;
  }
  seedSql += '\n';
}

seedSql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

fs.writeFileSync(path.join(outDir, 'seed_data.sql'), seedSql, 'utf8');
console.log('Successfully wrote database/seed_data.sql');

const fs = require('fs');
const path = require('path');

const dbJsonPath = path.join(__dirname, '../data/database.json');
const data = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
const db = data.dbData;

const outDir = path.join(__dirname, '../database');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

function safeNum(val, def = 0) {
  if (val === null || val === undefined) return def;
  const n = parseFloat(val);
  return isNaN(n) ? def : n;
}

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
    seedSql += `INSERT INTO \`users\` (\`id\`, \`uid\`, \`mobile\`, \`username\`, \`password_hash\`, \`pin\`, \`ref_code\`, \`parent_id\`, \`inr_balance\`, \`bcoin_balance\`, \`usdt_balance\`, \`total_earnings\`, \`today_profit\`, \`yesterday_profit\`, \`is_blocked\`, \`role\`, \`created_at\`) VALUES (${u.id}, ${escapeSql(u.uid)}, ${escapeSql(u.mobile)}, ${escapeSql(u.username)}, ${escapeSql(u.password_hash)}, ${escapeSql(u.pin)}, ${escapeSql(u.ref_code)}, ${safeNum(u.parent_id, 0)}, ${safeNum(u.inr_balance)}, ${safeNum(u.bcoin_balance)}, ${safeNum(u.usdt_balance)}, ${safeNum(u.total_earnings)}, ${safeNum(u.today_profit)}, ${safeNum(u.yesterday_profit)}, ${u.is_blocked ? 1 : 0}, ${escapeSql(u.role || 'user')}, ${formatDate(u.created_at)}) ON DUPLICATE KEY UPDATE \`mobile\`=VALUES(\`mobile\`);\n`;
  }
  seedSql += '\n';
}

// Bank accounts
if (db.bank_accounts && db.bank_accounts.length) {
  seedSql += `-- Insert Bank Accounts (${db.bank_accounts.length} rows)\n`;
  for (const b of db.bank_accounts) {
    seedSql += `INSERT INTO \`bank_accounts\` (\`id\`, \`user_id\`, \`account_holder\`, \`bank_name\`, \`account_number\`, \`ifsc_code\`, \`upi_id\`, \`status\`, \`created_at\`) VALUES (${b.id}, ${safeNum(b.user_id)}, ${escapeSql(b.account_holder)}, ${escapeSql(b.bank_name)}, ${escapeSql(b.account_number)}, ${escapeSql(b.ifsc_code)}, ${escapeSql(b.upi_id)}, ${escapeSql(b.status || 'Active')}, ${formatDate(b.created_at)}) ON DUPLICATE KEY UPDATE \`account_number\`=VALUES(\`account_number\`);\n`;
  }
  seedSql += '\n';
}

// Orders
if (db.orders && db.orders.length) {
  seedSql += `-- Insert Orders (${db.orders.length} rows)\n`;
  for (const o of db.orders) {
    seedSql += `INSERT INTO \`orders\` (\`id\`, \`order_id\`, \`user_id\`, \`seller_id\`, \`asset_type\`, \`type\`, \`amount\`, \`quota\`, \`expected_income\`, \`status\`, \`utr\`, \`screenshot_path\`, \`payment_method\`, \`created_at\`) VALUES (${o.id}, ${escapeSql(o.order_id)}, ${safeNum(o.user_id)}, ${o.seller_id ? safeNum(o.seller_id) : 'NULL'}, ${escapeSql(o.asset_type || 'INR')}, ${escapeSql(o.type || 'Buy')}, ${safeNum(o.amount)}, ${safeNum(o.quota)}, ${safeNum(o.expected_income)}, ${escapeSql(o.status || 'Pending')}, ${escapeSql(o.utr)}, ${escapeSql(o.screenshot_path)}, ${escapeSql(o.payment_method || 'Bank')}, ${formatDate(o.created_at)}) ON DUPLICATE KEY UPDATE \`order_id\`=VALUES(\`order_id\`);\n`;
  }
  seedSql += '\n';
}

// Transactions
if (db.transactions && db.transactions.length) {
  seedSql += `-- Insert Transactions (${db.transactions.length} rows)\n`;
  for (const t of db.transactions) {
    let type = t.type;
    let amount = t.amount;
    let description = t.description;

    if (isNaN(Number(amount)) && !isNaN(Number(type))) {
      // Swapped anomaly fix
      amount = Number(type);
      type = 'Task';
      description = String(t.amount);
    }

    seedSql += `INSERT INTO \`transactions\` (\`id\`, \`user_id\`, \`type\`, \`amount\`, \`balance_after\`, \`description\`, \`created_at\`) VALUES (${t.id}, ${safeNum(t.user_id)}, ${escapeSql(type || 'Commission')}, ${safeNum(amount)}, ${safeNum(t.balance_after)}, ${escapeSql(description)}, ${formatDate(t.created_at)}) ON DUPLICATE KEY UPDATE \`id\`=VALUES(\`id\`);\n`;
  }
  seedSql += '\n';
}

// User tasks
if (db.user_tasks && db.user_tasks.length) {
  seedSql += `-- Insert User Tasks (${db.user_tasks.length} rows)\n`;
  for (const ut of db.user_tasks) {
    seedSql += `INSERT INTO \`user_tasks\` (\`id\`, \`user_id\`, \`task_key\`, \`completed\`, \`claimed\`, \`created_at\`) VALUES (${ut.id}, ${safeNum(ut.user_id)}, ${escapeSql(ut.task_key)}, ${ut.completed ? 1 : 0}, ${ut.claimed ? 1 : 0}, ${formatDate(ut.created_at)}) ON DUPLICATE KEY UPDATE \`completed\`=VALUES(\`completed\`);\n`;
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
    seedSql += `INSERT INTO \`commission_slabs\` (\`id\`, \`min_amount\`, \`max_amount\`, \`commission_percent\`, \`flat_bonus\`) VALUES (${cs.id}, ${safeNum(cs.min_amount)}, ${safeNum(cs.max_amount)}, ${safeNum(cs.commission_percent)}, ${safeNum(cs.flat_bonus)}) ON DUPLICATE KEY UPDATE \`commission_percent\`=VALUES(\`commission_percent\`);\n`;
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
    seedSql += `INSERT INTO \`price_ranges\` (\`id\`, \`label\`, \`min_val\`, \`max_val\`, \`created_at\`) VALUES (${pr.id}, ${escapeSql(pr.label)}, ${safeNum(pr.min_val)}, ${safeNum(pr.max_val)}, ${formatDate(pr.created_at)}) ON DUPLICATE KEY UPDATE \`label\`=VALUES(\`label\`);\n`;
  }
  seedSql += '\n';
}

seedSql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

fs.writeFileSync(path.join(outDir, 'seed_data.sql'), seedSql, 'utf8');
console.log('Successfully regenerated database/seed_data.sql with safe escaping!');

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_KEY) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    let ws;
    try { ws = require('ws'); } catch (e) {}
    supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
      auth: { persistSession: false },
      ...(ws ? { realtime: { transport: ws } } : {})
    });
    console.log('[Supabase] Initialized Supabase DB Client successfully.');
  } catch (err) {
    console.error('[Supabase] Client initialization error:', err.message);
  }
}

const dataDir = path.join(__dirname, '../data');
const dbPath = process.env.DATABASE_PATH || path.join(dataDir, 'database.json');

// Ensure database parent directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// In-memory representation of our database tables
let dbData = {
  users: [],
  orders: [],
  bank_accounts: [],
  transactions: [],
  user_tasks: [],
  messages: [],
  withdrawals: [],
  disputes: [],
  settings: {
    level1_commission: 10,
    level2_commission: 5,
    level3_commission: 2,
    telegram_link: "https://t.me/TpayX",
    payment_mode: "gateway",
    upi_ids: ""
  }
};

// Autoincrement trackers
let idTrackers = {
  users: 0,
  orders: 0,
  bank_accounts: 0,
  transactions: 0,
  user_tasks: 0,
  messages: 0,
  withdrawals: 0,
  disputes: 0
};

async function syncToSupabase() {
  if (!supabase) return;
  try {
    if (dbData.users && dbData.users.length > 0) {
      const userRows = dbData.users.map(u => ({
        id: Number(u.id),
        uid: u.uid,
        mobile: u.mobile,
        name: u.username || u.name || null,
        password_hash: u.password_hash || null,
        bcoin_balance: u.bcoin_balance || 0,
        inr_balance: u.inr_balance || 0,
        total_earnings: u.total_earnings || 0,
        total_withdrawals: 0,
        is_blocked: u.is_blocked || false,
        role: u.id == 1 ? 'admin' : 'user',
        created_at: u.created_at || new Date().toISOString()
      }));
      await supabase.from('users').upsert(userRows);
    }
    if (dbData.bank_accounts && dbData.bank_accounts.length > 0) {
      const bankRows = dbData.bank_accounts.map(b => ({
        id: Number(b.id),
        user_id: Number(b.user_id),
        bank_name: b.bank_name,
        account_number: b.account_number,
        account_holder: b.account_holder,
        ifsc: b.ifsc_code || b.ifsc || null,
        upi_id: b.upi_id || null,
        is_active: b.status === 'Active',
        status: b.status || 'Active',
        created_at: b.created_at || new Date().toISOString()
      }));
      await supabase.from('bank_accounts').upsert(bankRows);
    }
    if (dbData.orders && dbData.orders.length > 0) {
      const orderRows = dbData.orders.map(o => ({
        id: String(o.id),
        order_id: o.order_id,
        user_id: Number(o.user_id),
        type: o.asset_type === 'INR' ? 'DEPOSIT' : 'PURCHASE',
        amount: Number(o.amount),
        asset: o.asset_type || 'INR',
        status: o.status || 'Confirming',
        utr_number: o.utr || null,
        proof_url: o.screenshot_path || null,
        created_at: o.created_at || new Date().toISOString()
      }));
      await supabase.from('orders').upsert(orderRows);
    }
    if (dbData.products && dbData.products.length > 0) {
      const prodRows = dbData.products.map(p => ({
        id: Number(p.id),
        title: p.name,
        price: Number(p.amount),
        daily_return: Number(p.income),
        total_return: Number(p.quota),
        period_days: 1,
        category: p.type || 'TpayX Plan',
        is_active: true,
        created_at: p.created_at || new Date().toISOString()
      }));
      await supabase.from('products').upsert(prodRows);
    }
    if (dbData.price_ranges && dbData.price_ranges.length > 0) {
      const prRows = dbData.price_ranges.map(p => ({
        id: Number(p.id),
        min_amount: Number(p.min_val),
        max_amount: Number(p.max_val),
        created_at: p.created_at || new Date().toISOString()
      }));
      await supabase.from('price_ranges').upsert(prRows);
    }
    if (dbData.settings) {
      const settingsRows = Object.entries(dbData.settings).map(([k, v]) => ({
        key: k,
        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
        description: `Setting ${k}`
      }));
      await supabase.from('settings').upsert(settingsRows);
    }
  } catch (err) {
    console.error('[Supabase Sync Error]:', err.message);
  }
}

// Save helper
function saveDb() {
  try {
    fs.writeFileSync(dbPath, JSON.stringify({ dbData, idTrackers }, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving local database JSON file:', e);
  }
  if (supabase) {
    syncToSupabase().catch(err => console.error('[Supabase Async Sync Error]:', err.message));
  }
}

function repairMissingCommissions() {
  let repairedCount = 0;
  
  const completedOrders = dbData.orders.filter(o => o.status === 'Completed');
  const rates = dbData.settings || { level1_commission: 10, level2_commission: 5, level3_commission: 2 };
  const commissionRates = [
    Number(rates.level1_commission || 0) / 100,
    Number(rates.level2_commission || 0) / 100,
    Number(rates.level3_commission || 0) / 100
  ];

  for (const order of completedOrders) {
    const buyer = dbData.users.find(u => u.id == order.user_id);
    if (!buyer) continue;

    const depositAmountInInr = order.asset_type === 'USDT' ? order.amount * 100.0 : order.amount;
    let currentParentId = buyer.parent_id;

    for (let level = 1; level <= 3; level++) {
      if (!currentParentId) break;

      const parent = dbData.users.find(u => u.id == currentParentId);
      if (!parent) break;

      const rate = commissionRates[level - 1];
      const commAmount = depositAmountInInr * rate;

      if (commAmount > 0) {
        const searchDesc = `Level ${level} Commission of ₹${commAmount.toFixed(2)} from member UID: ${buyer.uid} (Order ID: ${order.order_id})`;
        
        // Check if transaction already exists for this parent and this order ID
        const exists = dbData.transactions.some(t => 
          t.user_id == parent.id && 
          t.type === 'Commission' && 
          t.description.includes(order.order_id)
        );

        if (!exists) {
          const newId = ++idTrackers.transactions;
          dbData.transactions.push({
            id: newId,
            user_id: parent.id,
            type: 'Commission',
            amount: commAmount,
            balance_after: parent.inr_balance, // fallback
            description: searchDesc,
            created_at: order.created_at || new Date().toISOString()
          });
          repairedCount++;
        }
      }

      currentParentId = parent.parent_id;
    }
  }

  if (repairedCount > 0) {
    console.log(`[Migration] Retroactively seeded ${repairedCount} missing commission transactions.`);
    saveDb();
  }
}

function repairWalletBalancesForOrders23And24() {
  dbData.settings = dbData.settings || {};
  if (dbData.settings.orders_repaired_v2) {
    return;
  }

  console.log('Running one-off wallet repair for Orders 23 & 24...');
  
  // Order 23: amount 500, quota 518.5, expected_income 18.5, user_id 3. Parent 1 commission: 50.
  const u3 = dbData.users.find(u => u.id == 3);
  const u1 = dbData.users.find(u => u.id == 1);

  if (u3) {
    u3.inr_balance += 1037.0; // 518.5 * 2 (for both orders 23 and 24)
    u3.total_earnings += 37.0; // 18.5 * 2
    u3.today_profit += 37.0; // 18.5 * 2
    console.log('Credited User 3 for Orders 23 & 24');
  }

  if (u1) {
    u1.inr_balance += 100.0; // 50.0 * 2 (for both orders 23 and 24)
    u1.total_earnings += 100.0; // 50.0 * 2
    u1.today_profit += 100.0; // 50.0 * 2
    console.log('Credited User 1 for Orders 23 & 24 commission');
  }

  dbData.settings.orders_repaired_v2 = true;
  saveDb();
}

function repairHistoryDepositSplits() {
  dbData.settings = dbData.settings || {};
  if (dbData.settings.history_split_repaired) {
    return;
  }

  console.log('Running retroactive history deposit/income splitting...');
  let splitCount = 0;
  const newTransactions = [];

  for (const t of dbData.transactions) {
    if (t.type === 'Deposit' && t.description && t.description.includes('Deposit completed for Order')) {
      // Find the order ID
      const match = t.description.match(/Order\s+([A-Za-z0-9]+)/);
      if (match && match[1]) {
        const orderId = match[1];
        const order = dbData.orders.find(o => o.order_id === orderId);
        if (order) {
          const principal = Number(order.amount);
          const bonus = Number(order.expected_income);
          
          if (bonus > 0 && Math.abs(t.amount - (principal + bonus)) < 0.01) {
            // Split it!
            const originalBalanceAfter = t.balance_after;
            
            // 1. Modify the existing transaction to be just the principal
            t.amount = principal;
            t.balance_after = originalBalanceAfter - bonus;
            t.description = `Deposit principal for Order ${order.order_id}`;

            // 2. Create the new commission transaction for the bonus
            const newId = ++idTrackers.transactions;
            newTransactions.push({
              id: newId,
              user_id: t.user_id,
              type: 'Commission',
              amount: bonus,
              balance_after: originalBalanceAfter,
              description: `Interest bonus for Order ${order.order_id}`,
              created_at: t.created_at
            });

            splitCount++;
          }
        }
      }
    }
  }

  if (newTransactions.length > 0) {
    dbData.transactions.push(...newTransactions);
    // Sort transactions by id to maintain chronological consistency
    dbData.transactions.sort((a, b) => a.id - b.id);
  }

  dbData.settings.history_split_repaired = true;
  if (splitCount > 0) {
    console.log(`Split ${splitCount} unified deposit transactions into principal and bonus entries.`);
    saveDb();
  }
}

function repairWithdrawalTransactionTypes() {
  dbData.settings = dbData.settings || {};

  let repairedCount = 0;
  for (const t of dbData.transactions) {
    if (t.type === 'Commission' && t.description && t.description.toLowerCase().includes('withdrawal')) {
      t.type = 'Withdraw';
      repairedCount++;
    }
  }

  let bankRepairedCount = 0;
  for (const t of dbData.transactions) {
    if (t.type === 'Withdraw') {
      if (!t.description.startsWith('Bank:')) {
        const bank = dbData.bank_accounts.find(a => a.user_id == t.user_id && a.status === 'Active');
        if (bank) {
          let utr = String(Math.floor(100000000000 + Math.random() * 900000000000));
          let txid = 'TXN' + String(Math.floor(1000000000 + Math.random() * 9000000000));
          const utrMatch = (t.description || '').match(/UTR:\s*([0-9a-zA-Z]+)/i);
          const txidMatch = (t.description || '').match(/TXID:\s*([0-9a-zA-Z]+)/i);
          if (utrMatch) utr = utrMatch[1];
          if (txidMatch) txid = txidMatch[1];
          
          const amt = Math.abs(t.amount);
          t.description = `Bank: ${bank.bank_name}, A/C: ${bank.account_number}, Holder: ${bank.account_holder}, UTR: ${utr}, TXID: ${txid}, Note: Debit withdrawal of ₹${amt.toFixed(2)} approved by administrator`;
          bankRepairedCount++;
        }
      }
    }
  }

  if (repairedCount > 0 || bankRepairedCount > 0) {
    console.log(`Withdrawal correction: converted ${repairedCount} types, reformatted ${bankRepairedCount} descriptions to active bank details.`);
    saveDb();
  }
}

// Load helper
function loadDb() {
  if (fs.existsSync(dbPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      if (parsed.dbData) {
        for (let key in dbData) delete dbData[key];
        Object.assign(dbData, parsed.dbData);
      }
      if (parsed.idTrackers) {
        for (let key in idTrackers) delete idTrackers[key];
        Object.assign(idTrackers, parsed.idTrackers);
      }

      // Ensure dynamic tables are initialized
      dbData.products = dbData.products || [];
      dbData.price_ranges = dbData.price_ranges || [];
      dbData.sliders = dbData.sliders || [];
      dbData.bank_accounts = dbData.bank_accounts || [];
      dbData.messages = dbData.messages || [];
      dbData.withdrawals = dbData.withdrawals || [];
      dbData.disputes = dbData.disputes || [];
      dbData.settings = dbData.settings || {
        level1_commission: 10,
        level2_commission: 5,
        level3_commission: 2,
        telegram_link: "https://t.me/TpayX",
        winpey_api_key: "488b923c-2b03-465e-b9df-55d018124e0c",
        winpey_api_secret: "fc4a56a2439f47c19213c747ee5693c6"
      };
      if (dbData.settings.telegram_link === undefined) dbData.settings.telegram_link = "https://t.me/TpayX";
      if (!dbData.settings.winpey_api_key) dbData.settings.winpey_api_key = "488b923c-2b03-465e-b9df-55d018124e0c";
      if (!dbData.settings.winpey_api_secret) dbData.settings.winpey_api_secret = "fc4a56a2439f47c19213c747ee5693c6";

      idTrackers.products = idTrackers.products || 0;
      idTrackers.price_ranges = idTrackers.price_ranges || 0;
      idTrackers.sliders = idTrackers.sliders || 0;
      idTrackers.bank_accounts = idTrackers.bank_accounts || 0;
      idTrackers.messages = idTrackers.messages || 0;
      idTrackers.withdrawals = idTrackers.withdrawals || 0;
      idTrackers.disputes = idTrackers.disputes || 0;

      // Migrate existing upi_accounts to bank_accounts
      if (dbData.upi_accounts) {
        dbData.bank_accounts = dbData.upi_accounts.map(acc => ({
          id: acc.id,
          user_id: acc.user_id,
          bank_name: acc.wallet_type || 'HDFC Bank',
          account_holder: 'Tushar Sharma',
          account_number: acc.upi_id ? acc.upi_id.split('@')[0] : '50100481729381',
          ifsc_code: 'HDFC0000123',
          status: acc.status,
          created_at: acc.created_at || new Date().toISOString()
        }));
        idTrackers.bank_accounts = Math.max(idTrackers.upi_accounts || 0, dbData.bank_accounts.length);
        delete dbData.upi_accounts;
        delete idTrackers.upi_accounts;
        saveDb();
      }

      // Migrate existing user records to include username and is_blocked properties
      let migrated = false;
      dbData.users.forEach(u => {
        if (!u.username) {
          if (u.uid === 'M118248') {
            u.username = 'Bee_dg9mz6bc';
          } else {
            u.username = `TpayX_${u.uid}`;
          }
          migrated = true;
        }
        if (u.is_blocked === undefined) {
          u.is_blocked = false;
          migrated = true;
        }
      });
      if (migrated) {
        saveDb();
      }
      repairMissingCommissions();
      repairWalletBalancesForOrders23And24();
      repairHistoryDepositSplits();
      repairWithdrawalTransactionTypes();

      // Retroactively repair negative balances by removing the negative sign (making them positive)
      let fixedBalancesCount = 0;
      dbData.users.forEach(u => {
        if (u.bcoin_balance < 0) {
          const original = u.bcoin_balance;
          u.bcoin_balance = Math.abs(u.bcoin_balance);
          console.log(`[Repair] Converted negative T-Coin balance for user ${u.username} (UID: ${u.uid}) from ${original} to ${u.bcoin_balance}`);
          fixedBalancesCount++;
        }
      });
      if (fixedBalancesCount > 0) {
        saveDb();
      }
    } catch (e) {
      console.error('Error loading JSON database:', e);
    }
  }
}

// Main query simulator
const query = {
  get: async (sql, params = []) => {
    loadDb();
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    // 1. SELECT COUNT(*) as count FROM users
    if (cleanSql.includes('SELECT COUNT(*) as count FROM users')) {
      return { count: dbData.users.length };
    }

    // 2. SELECT id FROM users WHERE uid = ?
    if (cleanSql.startsWith('SELECT id FROM users WHERE uid = ?')) {
      const user = dbData.users.find(u => u.uid === params[0]);
      return user ? { id: user.id } : null;
    }

    // 3. SELECT id FROM users WHERE ref_code = ?
    if (cleanSql.startsWith('SELECT id FROM users WHERE ref_code = ?')) {
      const user = dbData.users.find(u => u.ref_code === params[0]);
      return user ? { id: user.id } : null;
    }

    // 4. SELECT * FROM users WHERE mobile = ?
    if (cleanSql.includes('FROM users WHERE mobile = ?')) {
      const user = dbData.users.find(u => u.mobile === params[0]);
      return user ? { ...user } : null;
    }

    // 5. SELECT * FROM users WHERE id = ?
    if (cleanSql.startsWith('SELECT * FROM users WHERE id = ?') || cleanSql.includes('FROM users WHERE id = ?')) {
      const user = dbData.users.find(u => u.id == params[0]);
      return user ? { ...user } : null;
    }

    // 6. SELECT completed, claimed FROM user_tasks WHERE user_id = ? AND task_key = ?
    if (cleanSql.startsWith('SELECT completed, claimed FROM user_tasks WHERE user_id = ? AND task_key = ?') ||
        cleanSql.startsWith('SELECT completed, claimed FROM user_tasks WHERE user_id = ? AND task_key = "set_pin"')) {
      const key = params[1] || 'set_pin';
      const task = dbData.user_tasks.find(t => t.user_id == params[0] && t.task_key === key);
      return task ? { completed: task.completed, claimed: task.claimed } : null;
    }

    // 7. SELECT completed FROM user_tasks WHERE user_id = ? AND task_key = ?
    if (cleanSql.startsWith('SELECT completed FROM user_tasks WHERE user_id = ? AND task_key = ?')) {
      const task = dbData.user_tasks.find(t => t.user_id == params[0] && t.task_key === params[1]);
      return task ? { completed: task.completed } : null;
    }

    // 8. SELECT id FROM transactions WHERE user_id = ? AND type = "Newbie Bonus" AND amount = 60.0
    if (cleanSql.includes('SELECT id FROM transactions WHERE user_id = ? AND type = "Newbie Bonus" AND amount = 60.0')) {
      const txn = dbData.transactions.find(t => t.user_id == params[0] && t.type === 'Newbie Bonus' && t.amount === 60.0);
      return txn ? { id: txn.id } : null;
    }

    // 9. SELECT COUNT(*) as count FROM bank_accounts WHERE user_id = ?
    if (cleanSql.includes('SELECT COUNT(*) as count FROM bank_accounts WHERE user_id = ?')) {
      const count = dbData.bank_accounts.filter(a => a.user_id == params[0]).length;
      return { count };
    }

    // 10. SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?
    if (cleanSql.startsWith('SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?')) {
      const acc = dbData.bank_accounts.find(a => a.id === parseInt(params[0]) && a.user_id == params[1]);
      return acc ? { ...acc } : null;
    }

    // 10b. SELECT * FROM bank_accounts WHERE user_id = ? AND status = "Active" LIMIT 1
    if (cleanSql.includes('FROM bank_accounts WHERE user_id = ?')) {
      let accounts = dbData.bank_accounts.filter(a => a.user_id == params[0]);
      if (cleanSql.includes('status = "Active"') || cleanSql.includes("status = 'Active'")) {
        accounts = accounts.filter(a => a.status === 'Active');
      }
      return accounts.length > 0 ? { ...accounts[0] } : null;
    }

    // 11. SELECT * FROM bank_accounts WHERE id = ?
    if (cleanSql.startsWith('SELECT * FROM bank_accounts WHERE id = ?')) {
      const acc = dbData.bank_accounts.find(a => a.id === parseInt(params[0]));
      return acc ? { ...acc } : null;
    }

    // 12. SELECT * FROM settings LIMIT 1
    if (cleanSql.includes('FROM settings')) {
      dbData.settings = dbData.settings || { level1_commission: 10, level2_commission: 5, level3_commission: 2 };
      if (dbData.settings.payment_mode === undefined) dbData.settings.payment_mode = "gateway";
      if (dbData.settings.upi_ids === undefined) dbData.settings.upi_ids = "";
      return { ...dbData.settings };
    }

    // 12. SELECT * FROM orders WHERE order_id = ?
    if (cleanSql.startsWith('SELECT * FROM orders WHERE order_id = ?')) {
      const ord = dbData.orders.find(o => o.order_id === params[0]);
      return ord ? { ...ord } : null;
    }

    // 13. SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = "Completed"
    if (cleanSql.includes('SELECT COUNT(*) as count FROM orders WHERE user_id = ? AND status = "Completed"')) {
      const count = dbData.orders.filter(o => o.user_id == params[0] && o.status === 'Completed').length;
      return { count };
    }

    // 13b. SELECT COUNT(*) as count FROM orders WHERE status = ? / "Status"
    if (cleanSql.includes('SELECT COUNT(*) as count FROM orders WHERE status =')) {
      let status = '';
      if (cleanSql.includes('"Confirming"') || cleanSql.includes("'Confirming'")) status = 'Confirming';
      else if (cleanSql.includes('"Completed"') || cleanSql.includes("'Completed'")) status = 'Completed';
      else if (cleanSql.includes('"Canceled"') || cleanSql.includes("'Canceled'")) status = 'Canceled';
      else status = params[0];

      const count = dbData.orders.filter(o => o.status === status).length;
      return { count };
    }

    // 13c. SELECT SUM(amount) as sum FROM orders WHERE status = 'Completed'
    if (cleanSql.includes('SELECT SUM(amount) as sum FROM orders WHERE status =') && cleanSql.includes('Completed')) {
      const sum = dbData.orders.filter(o => o.status === 'Completed').reduce((acc, curr) => acc + curr.amount, 0);
      return { sum };
    }

    // 14. SELECT SUM(amount) as sum FROM transactions WHERE user_id = ? AND type = "Commission"
    if (cleanSql.includes('SELECT SUM(amount) as sum FROM transactions WHERE user_id = ? AND type = "Commission"')) {
      let filtered = dbData.transactions.filter(t => t.user_id == params[0] && t.type === 'Commission');
      
      if (params[1]) {
        // description LIKE ?
        const likeTerm = params[1].replace(/%/g, '');
        filtered = filtered.filter(t => t.description.includes(likeTerm));
      } else if (cleanSql.includes('LIKE "%Level 1%"')) {
        filtered = filtered.filter(t => t.description.includes('Level 1'));
      } else if (cleanSql.includes('LIKE "%Level 2%"')) {
        filtered = filtered.filter(t => t.description.includes('Level 2'));
      } else if (cleanSql.includes('LIKE "%Level 3%"')) {
        filtered = filtered.filter(t => t.description.includes('Level 3'));
      }
      
      const sum = filtered.reduce((acc, curr) => acc + curr.amount, 0);
      return { sum };
    }

    // 14b. SELECT SUM(amount) as sum FROM transactions WHERE user_id = ? AND type = "Withdraw" AND amount < 0
    if (cleanSql.includes('SELECT SUM(amount) as sum FROM transactions WHERE user_id = ? AND type = "Withdraw"')) {
      const sum = dbData.transactions
        .filter(t => t.user_id == params[0] && t.type === 'Withdraw' && t.amount < 0)
        .reduce((acc, curr) => acc + curr.amount, 0);
      return { sum };
    }

    // 14c. SELECT SUM(amount) as total FROM orders WHERE user_id = ? AND status = "Completed"
    if (cleanSql.includes('SELECT SUM(amount) as total FROM orders WHERE user_id = ?')) {
      const sum = dbData.orders
        .filter(o => o.user_id == params[0] && o.status === 'Completed')
        .reduce((acc, curr) => acc + curr.amount, 0);
      return { total: sum };
    }

    console.warn('Simulated query.get returned default null for:', cleanSql);
    return null;
  },

  all: async (sql, params = []) => {
    loadDb();
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    // 1. SELECT task_key, completed, claimed FROM user_tasks WHERE user_id = ?
    if (cleanSql.startsWith('SELECT task_key, completed, claimed FROM user_tasks WHERE user_id = ?')) {
      return dbData.user_tasks
        .filter(t => t.user_id == params[0])
        .map(t => ({ task_key: t.task_key, completed: t.completed, claimed: t.claimed }));
    }

    // 2. SELECT * FROM bank_accounts WHERE user_id = ? ORDER BY id DESC
    if (cleanSql.startsWith('SELECT * FROM bank_accounts WHERE user_id = ?')) {
      const accounts = dbData.bank_accounts.filter(a => a.user_id == params[0]);
      return [...accounts].reverse();
    }

    // 2b. SELECT * FROM bank_accounts
    if (cleanSql.includes('FROM bank_accounts') && !cleanSql.includes('WHERE user_id = ?')) {
      let list = dbData.bank_accounts || [];
      if (cleanSql.includes('status = "Active"') || cleanSql.includes("status = 'Active'")) {
        list = list.filter(a => a.status === 'Active');
      }
      return [...list].reverse();
    }

    // 3. SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC
    if (cleanSql.startsWith('SELECT * FROM orders WHERE user_id = ?')) {
      const ords = dbData.orders.filter(o => o.user_id == params[0]);
      return [...ords].reverse();
    }

    // 4. SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC
    if (cleanSql.startsWith('SELECT * FROM transactions WHERE user_id = ?')) {
      let txs = dbData.transactions.filter(t => t.user_id == params[0]);
      if (cleanSql.includes('type = "Withdraw"') || cleanSql.includes("type = 'Withdraw'")) {
        txs = txs.filter(t => t.type === 'Withdraw');
      }
      return [...txs].reverse();
    }

    // 4b. SELECT FROM transactions
    if (cleanSql.includes('FROM transactions') && !cleanSql.includes('WHERE user_id = ?')) {
      let list = dbData.transactions || [];
      if (cleanSql.includes('type = "Withdraw"') || cleanSql.includes("type = 'Withdraw'")) {
        list = list.filter(t => t.type === 'Withdraw');
      }
      return [...list].reverse();
    }

    // 5. SELECT id, uid, mobile, created_at FROM users WHERE parent_id = ?
    if (cleanSql.startsWith('SELECT id, uid, mobile, created_at FROM users WHERE parent_id = ?')) {
      return dbData.users
        .filter(u => u.parent_id == params[0])
        .map(u => ({ id: u.id, uid: u.uid, mobile: u.mobile, created_at: u.created_at }));
    }

    // 6. SELECT id, uid, mobile, created_at FROM users WHERE parent_id IN (...)
    if (cleanSql.includes('WHERE parent_id IN')) {
      // Extract parameter values or parse IN list
      // Since it's dynamic, let's extract the list from params array or query
      const match = cleanSql.match(/IN \(([^)]+)\)/);
      let ids = [];
      if (match) {
        ids = match[1].split(',').map(id => parseInt(id.trim()));
      }
      return dbData.users
        .filter(u => ids.includes(u.parent_id))
        .map(u => ({ id: u.id, uid: u.uid, mobile: u.mobile, created_at: u.created_at }));
    }

    // 7. SELECT orders.*, users.uid as user_uid, users.mobile as user_mobile FROM orders ...
    if (cleanSql.includes('SELECT orders.*, users.uid as user_uid')) {
      const enrichedOrders = dbData.orders.map(o => {
        const user = dbData.users.find(u => u.id === o.user_id) || {};
        return {
          ...o,
          user_uid: user.uid || '',
          user_mobile: user.mobile || ''
        };
      });
      return [...enrichedOrders].reverse();
    }

    // 8. SELECT id, uid, mobile, inr_balance, bcoin_balance, total_earnings, today_profit, created_at FROM users ORDER BY id DESC
    if (cleanSql.includes('FROM users ORDER BY id DESC') || cleanSql.includes('FROM users ORDER BY id desc')) {
      const mapped = dbData.users.map(u => ({
        id: u.id,
        uid: u.uid,
        username: u.username,
        mobile: u.mobile,
        inr_balance: u.inr_balance,
        bcoin_balance: u.bcoin_balance,
        total_earnings: u.total_earnings,
        today_profit: u.today_profit,
        created_at: u.created_at
      }));
      return [...mapped].reverse();
    }

    // 9. SELECT * FROM sliders ORDER BY id DESC
    if (cleanSql.includes('FROM sliders') || cleanSql.includes('SELECT * FROM sliders')) {
      dbData.sliders = dbData.sliders || [];
      return [...dbData.sliders].reverse();
    }

    // 10. SELECT * FROM products
    if (cleanSql.includes('FROM products') || cleanSql.includes('SELECT * FROM products')) {
      dbData.products = dbData.products || [];
      return [...dbData.products];
    }

    // 11. SELECT * FROM price_ranges
    if (cleanSql.includes('FROM price_ranges') || cleanSql.includes('SELECT * FROM price_ranges')) {
      dbData.price_ranges = dbData.price_ranges || [];
      return [...dbData.price_ranges];
    }

    // 12. SELECT * FROM messages ORDER BY id DESC
    if (cleanSql.includes('FROM messages') || cleanSql.includes('SELECT * FROM messages')) {
      dbData.messages = dbData.messages || [];
      return [...dbData.messages].reverse();
    }

    console.warn('Simulated query.all returned default [] for:', cleanSql);
    return [];
  },

  run: async (sql, params = []) => {
    loadDb();
    const cleanSql = sql.replace(/\s+/g, ' ').trim();

    // --- INSERT STATEMENTS ---
    if (cleanSql.startsWith('INSERT INTO') || cleanSql.startsWith('INSERT OR IGNORE INTO')) {
      let table = '';
      if (cleanSql.includes('INTO users')) table = 'users';
      else if (cleanSql.includes('INTO orders')) table = 'orders';
      else if (cleanSql.includes('INTO bank_accounts')) table = 'bank_accounts';
      else if (cleanSql.includes('INTO transactions')) table = 'transactions';
      else if (cleanSql.includes('INTO user_tasks')) table = 'user_tasks';
      else if (cleanSql.includes('INTO sliders')) table = 'sliders';
      else if (cleanSql.includes('INTO products')) table = 'products';
      else if (cleanSql.includes('INTO price_ranges')) table = 'price_ranges';
      else if (cleanSql.includes('INTO messages')) table = 'messages';

      if (table) {
        idTrackers[table]++;
        const newId = idTrackers[table];
        let record = { id: newId, created_at: new Date().toISOString() };

        if (table === 'users') {
          // INSERT INTO users (uid, mobile, password_hash, pin, ref_code, parent_id, inr_balance, bcoin_balance, total_earnings, today_profit, yesterday_profit)
          if (params.length === 11) {
            record = {
              ...record,
              uid: params[0],
              mobile: params[1],
              password_hash: params[2],
              pin: params[3],
              ref_code: params[4],
              parent_id: params[5],
              inr_balance: params[6],
              bcoin_balance: params[7],
              usdt_balance: 0.0,
              total_earnings: params[8],
              today_profit: params[9],
              yesterday_profit: params[10]
            };
          } else {
            // INSERT INTO users (uid, mobile, password_hash, ref_code, parent_id)
            record = {
              ...record,
              uid: params[0],
              mobile: params[1],
              password_hash: params[2],
              pin: null,
              ref_code: params[3],
              parent_id: params[4],
              inr_balance: 0.0,
              bcoin_balance: 0.0,
              usdt_balance: 0.0,
              total_earnings: 0.0,
              today_profit: 0.0,
              yesterday_profit: 0.0
            };
          }
        } 
        else if (table === 'orders') {
          // INSERT INTO orders (order_id, user_id, asset_type, amount, expected_income, quota, status)
          record = {
            ...record,
            order_id: params[0],
            user_id: params[1],
            asset_type: params[2],
            amount: params[3],
            expected_income: params[4],
            quota: params[5],
            status: params[6] || 'Confirming',
            utr: params.length === 8 ? params[7] : null
          };
        }
        else if (table === 'bank_accounts') {
          if (params.length === 6) {
            record = {
              ...record,
              user_id: params[0],
              bank_name: params[1],
              account_holder: params[2],
              account_number: params[3],
              ifsc_code: params[4],
              upi_id: params[5],
              status: 'Active'
            };
          } else {
            record = {
              ...record,
              user_id: params[0],
              bank_name: params[1],
              account_holder: params[2],
              account_number: params[3],
              ifsc_code: params[4],
              status: params[5] || 'Active'
            };
          }
        }
        else if (table === 'transactions') {
          // Check if params are shifted (when type is hardcoded in SQL: VALUES (?, 'Deposit/Commission/Withdraw', ?, ?, ?))
          if (params.length === 4) {
            let inferredType = 'Commission';
            if (cleanSql.includes("'Deposit'")) {
              inferredType = 'Deposit';
            } else if (cleanSql.includes("'Withdraw'")) {
              inferredType = 'Withdraw';
            } else if (cleanSql.includes("'Task Reward'")) {
              inferredType = 'Task Reward';
            }
            
            record = {
              ...record,
              user_id: params[0],
              type: inferredType,
              amount: params[1],
              balance_after: params[2],
              description: params[3]
            };
          } else {
            // Standard 5 parameter insert
            record = {
              ...record,
              user_id: params[0],
              type: params[1],
              amount: params[2],
              balance_after: params[3],
              description: params[4]
            };
          }
        }
        else if (table === 'user_tasks') {
          // INSERT OR IGNORE INTO user_tasks (user_id, task_key, completed, claimed)
          // Check uniqueness (user_id + task_key)
          const exists = dbData.user_tasks.find(t => t.user_id === params[0] && t.task_key === params[1]);
          if (exists) {
            return { lastID: exists.id, changes: 0 };
          }
          record = {
            ...record,
            user_id: params[0],
            task_key: params[1],
            completed: params[2] || 0,
            claimed: params[3] || 0
          };
        }
        else if (table === 'sliders') {
          // INSERT INTO sliders (image_data) VALUES (?)
          record = {
            ...record,
            image_data: params[0]
          };
        }
        else if (table === 'products') {
          // INSERT INTO products (name, amount, income, quota, color, type, percent)
          record = {
            ...record,
            name: params[0],
            amount: Number(params[1]),
            income: Number(params[2]),
            quota: Number(params[3]),
            color: params[4],
            type: params[5],
            percent: params[6]
          };
        }
        else if (table === 'price_ranges') {
          // INSERT INTO price_ranges (label, min_val, max_val)
          record = {
            ...record,
            label: params[0],
            min_val: Number(params[1]),
            max_val: Number(params[2])
          };
        }
        else if (table === 'messages') {
          // INSERT INTO messages (title, content)
          record = {
            ...record,
            title: params[0],
            content: params[1]
          };
        }

        dbData[table].push(record);
        saveDb();
        return { lastID: newId, changes: 1 };
      }
    }

    // --- UPDATE STATEMENTS ---
    if (cleanSql.startsWith('UPDATE')) {
      let changes = 0;
      
       // 1. UPDATE users SET password_hash = ? WHERE id = ?
      if (cleanSql.includes('UPDATE users SET password_hash = ? WHERE id = ?')) {
        const user = dbData.users.find(u => u.id == params[1]);
        if (user) {
          user.password_hash = params[0];
          changes = 1;
        }
      }
      // 1b. UPDATE users SET bcoin_balance = ? WHERE id = ?
      else if (cleanSql.includes('UPDATE users SET bcoin_balance = ? WHERE id = ?')) {
        const user = dbData.users.find(u => u.id == params[1]);
        if (user) {
          user.bcoin_balance = Number(params[0]);
          changes = 1;
        }
      }
      
      // 2. UPDATE users SET pin = ? WHERE id = ?
      else if (cleanSql.includes('UPDATE users SET pin = ? WHERE id = ?')) {
        const user = dbData.users.find(u => u.id == params[1]);
        if (user) {
          user.pin = params[0];
          changes = 1;
        }
      }

      // 3. UPDATE user_tasks SET completed = 1 WHERE user_id = ? AND task_key = ?
      else if (cleanSql.includes('UPDATE user_tasks SET completed = 1')) {
        const task = dbData.user_tasks.find(t => t.user_id == params[0] && t.task_key === params[1]);
        if (task) {
          task.completed = 1;
          task.updated_at = new Date().toISOString();
          changes = 1;
        }
      }

      // 4. UPDATE users SET bcoin_balance = bcoin_balance + 20 WHERE id = ?
      else if (cleanSql.includes('UPDATE users SET bcoin_balance = bcoin_balance + 20 WHERE id = ?')) {
        const user = dbData.users.find(u => u.id == params[0]);
        if (user) {
          user.bcoin_balance += 20;
          changes = 1;
        }
      }

      // 5. UPDATE users SET inr_balance = inr_balance + 60 WHERE id = ?
      else if (cleanSql.includes('UPDATE users SET inr_balance = inr_balance + 60 WHERE id = ?')) {
        const user = dbData.users.find(u => u.id == params[0]);
        if (user) {
          user.inr_balance += 60;
          changes = 1;
        }
      }

      // 5b. UPDATE users SET username = ? WHERE id = ?
      else if (cleanSql.includes('UPDATE users SET username = ? WHERE id = ?')) {
        const user = dbData.users.find(u => u.id == params[1]);
        if (user) {
          user.username = params[0];
          changes = 1;
        }
      }

      // 6. UPDATE user_tasks SET claimed = 1 WHERE user_id = ? AND task_key IN (...)
      else if (cleanSql.includes('UPDATE user_tasks SET claimed = 1 WHERE user_id = ?')) {
        dbData.user_tasks
          .filter(t => t.user_id == params[0] && ['set_pin', 'add_support', 'join_bot'].includes(t.task_key))
          .forEach(t => {
            t.claimed = 1;
            changes++;
          });
      }

      // 7. UPDATE bank_accounts SET status = ? WHERE id = ?
      else if (cleanSql.includes('UPDATE bank_accounts SET status = ? WHERE id = ?')) {
        const acc = dbData.bank_accounts.find(a => a.id === parseInt(params[1]));
        if (acc) {
          acc.status = params[0];
          changes = 1;
        }
      }

      // 8. UPDATE settings SET level1_commission = ?, level2_commission = ?, level3_commission = ?
      else if (cleanSql.includes('UPDATE settings SET')) {
        dbData.settings = {
          ...dbData.settings,
          level1_commission: Number(params[0]),
          level2_commission: Number(params[1]),
          level3_commission: Number(params[2]),
          telegram_link: params[3] !== undefined ? params[3] : (dbData.settings.telegram_link || "https://t.me/TpayX"),
          winpey_api_key: params[4] !== undefined ? params[4] : (dbData.settings.winpey_api_key || "488b923c-2b03-465e-b9df-55d018124e0c"),
          winpey_api_secret: params[5] !== undefined ? params[5] : (dbData.settings.winpey_api_secret || "fc4a56a2439f47c19213c747ee5693c6"),
          payment_mode: params[6] !== undefined ? params[6] : (dbData.settings.payment_mode || "gateway"),
          upi_ids: params[7] !== undefined ? params[7] : (dbData.settings.upi_ids || "")
        };
        changes = 1;
        saveDb();
      }

      // 8. UPDATE orders SET status = "Completed"...
      else if (cleanSql.includes('UPDATE orders SET status = "Completed"')) {
        const orderIdParam = params.length > 1 ? params[1] : params[0];
        const utrParam = params.length > 1 ? params[0] : null;
        const ord = dbData.orders.find(o => o.order_id === orderIdParam);
        if (ord) {
          ord.status = 'Completed';
          if (utrParam) ord.utr = utrParam;
          changes = 1;
          saveDb();
        }
      }

      // 9. UPDATE orders SET status = "Canceled"...
      else if (cleanSql.includes('UPDATE orders SET status = "Canceled"')) {
        const orderIdParam = params.length > 1 ? params[1] : params[0];
        const ord = dbData.orders.find(o => o.order_id === orderIdParam);
        if (ord) {
          ord.status = 'Canceled';
          changes = 1;
          saveDb();
        }
      }

      // 10. UPDATE orders SET utr = ? WHERE order_id = ?
      else if (cleanSql.includes('UPDATE orders SET utr = ? WHERE order_id = ?')) {
        const ord = dbData.orders.find(o => o.order_id === params[1]);
        if (ord) {
          ord.utr = params[0];
          changes = 1;
        }
      }

      // 11. UPDATE users SET inr_balance = ?, total_earnings = ?, today_profit = ? WHERE id = ?
      else if (cleanSql.includes('UPDATE users SET inr_balance = ?, total_earnings = ?, today_profit = ? WHERE id = ?')) {
        const user = dbData.users.find(u => u.id == params[3]);
        if (user) {
          user.inr_balance = Number(params[0]);
          user.total_earnings = Number(params[1]);
          user.today_profit = Number(params[2]);
          changes = 1;
        }
      }

      // 11b. UPDATE users SET inr_balance = ?, bcoin_balance = ?, total_earnings = ?, today_profit = ? WHERE id = ?
      else if (cleanSql.includes('UPDATE users SET') && cleanSql.includes('bcoin_balance = ?')) {
        const user = dbData.users.find(u => u.id == params[4]);
        if (user) {
          user.inr_balance = Number(params[0]);
          user.bcoin_balance = Number(params[1]);
          user.total_earnings = Number(params[2]);
          user.today_profit = Number(params[3]);
          changes = 1;
        }
      }

      // 5. UPDATE products SET name = ?, amount = ?, income = ?, quota = ?, color = ?, type = ?, percent = ? WHERE id = ?
      if (cleanSql.includes('UPDATE products SET name = ?')) {
        const prod = dbData.products.find(p => p.id === parseInt(params[7]));
        if (prod) {
          prod.name = params[0];
          prod.amount = Number(params[1]);
          prod.income = Number(params[2]);
          prod.quota = Number(params[3]);
          prod.color = params[4];
          prod.type = params[5];
          prod.percent = params[6];
          changes = 1;
        }
      }

      if (changes > 0) {
        saveDb();
        return { changes };
      }
    }

    // --- DELETE STATEMENTS ---
    if (cleanSql.startsWith('DELETE FROM')) {
      // 1. DELETE FROM bank_accounts WHERE id = ? AND user_id = ?
      if (cleanSql.includes('DELETE FROM bank_accounts WHERE id = ? AND user_id = ?')) {
        const prevLength = dbData.bank_accounts.length;
        dbData.bank_accounts = dbData.bank_accounts.filter(a => !(a.id === parseInt(params[0]) && a.user_id === params[1]));
        const changes = prevLength - dbData.bank_accounts.length;
        if (changes > 0) {
          saveDb();
        }
        return { changes };
      }

      // 2. DELETE FROM sliders WHERE id = ?
      if (cleanSql.includes('DELETE FROM sliders WHERE id = ?')) {
        const prevLength = dbData.sliders.length;
        dbData.sliders = dbData.sliders.filter(s => s.id !== parseInt(params[0]));
        const changes = prevLength - dbData.sliders.length;
        if (changes > 0) {
          saveDb();
        }
        return { changes };
      }

      // 3. DELETE FROM products WHERE id = ?
      if (cleanSql.includes('DELETE FROM products WHERE id = ?')) {
        const prevLength = dbData.products.length;
        dbData.products = dbData.products.filter(p => p.id !== parseInt(params[0]));
        const changes = prevLength - dbData.products.length;
        if (changes > 0) {
          saveDb();
        }
        return { changes };
      }

      // 4. DELETE FROM price_ranges WHERE id = ?
      if (cleanSql.includes('DELETE FROM price_ranges WHERE id = ?')) {
        const prevLength = dbData.price_ranges.length;
        dbData.price_ranges = dbData.price_ranges.filter(r => r.id !== parseInt(params[0]));
        const changes = prevLength - dbData.price_ranges.length;
        if (changes > 0) {
          saveDb();
        }
        return { changes };
      }

      // 5. DELETE FROM messages WHERE id = ?
      if (cleanSql.includes('DELETE FROM messages WHERE id = ?')) {
        const prevLength = dbData.messages.length;
        dbData.messages = dbData.messages.filter(m => m.id !== parseInt(params[0]));
        const changes = prevLength - dbData.messages.length;
        if (changes > 0) {
          saveDb();
        }
        return { changes };
      }
    }

    console.warn('Simulated query.run executed no changes for:', cleanSql);
    return { changes: 0 };
  }
};

// Seed script wrapping
async function initDb() {
  loadDb();
  if (supabase) {
    console.log('[Supabase Init] Triggering initial sync to Supabase...');
    await syncToSupabase();
  }

  // Initialize arrays to prevent runtime errors
  dbData.products = dbData.products || [];
  dbData.price_ranges = dbData.price_ranges || [];
  idTrackers.products = idTrackers.products || 0;
  idTrackers.price_ranges = idTrackers.price_ranges || 0;

  if (dbData.products.length === 0) {
    dbData.products = [
      { id: 1, name: 'HDFC Bank', amount: 10000, income: 1008.0, quota: 11008, color: 'blue', type: 'Bank', percent: '10%+8', created_at: new Date().toISOString() },
      { id: 2, name: 'SBI Bank', amount: 14544, income: 1462.40, quota: 16006.40, color: 'red', type: 'Bank', percent: '10%+8', created_at: new Date().toISOString() }
    ];
    idTrackers.products = 2;
  }

  // Seed default price ranges if empty
  if (dbData.price_ranges.length === 0) {
    dbData.price_ranges = [
      { id: 1, label: 'ALL', min_val: 0, max_val: 99999999, created_at: new Date().toISOString() },
      { id: 2, label: '0 - 500', min_val: 0, max_val: 500, created_at: new Date().toISOString() },
      { id: 3, label: '500 - 1000', min_val: 500, max_val: 1000, created_at: new Date().toISOString() },
      { id: 4, label: '1000 - 5000', min_val: 1000, max_val: 5000, created_at: new Date().toISOString() },
      { id: 5, label: '5000+', min_val: 5000, max_val: 99999999, created_at: new Date().toISOString() }
    ];
    idTrackers.price_ranges = 5;
  }
  
  // Seed default user and relationships if database is empty
  if (dbData.users.length === 0) {
    console.log('Seeding mock JSON database records...');
    const defaultPasswordHash = await bcrypt.hash('12345678', 10);
    
    // 1. Parent (TpayX_User, UID: M118248)
    idTrackers.users++;
    const parentId = idTrackers.users;
    dbData.users.push({
      id: parentId,
      uid: 'M118248',
      mobile: '8763527330',
      password_hash: defaultPasswordHash,
      pin: '1234',
      ref_code: 'tp3340vnxr',
      parent_id: null,
      inr_balance: 10866.05,
      bcoin_balance: 115.77,
      usdt_balance: 0.0,
      total_earnings: 10751.28,
      today_profit: 0.0,
      yesterday_profit: 620.23,
      created_at: new Date().toISOString()
    });

    // 2. Child (UID: M121371)
    idTrackers.users++;
    const childId = idTrackers.users;
    dbData.users.push({
      id: childId,
      uid: 'M121371',
      mobile: '9876543210',
      password_hash: defaultPasswordHash,
      pin: '4321',
      ref_code: 'tpchild123',
      parent_id: parentId,
      inr_balance: 0.0,
      bcoin_balance: 0.0,
      usdt_balance: 0.0,
      total_earnings: 0.0,
      today_profit: 0.0,
      yesterday_profit: 0.0,
      created_at: new Date().toISOString()
    });

    // 3. Seed Bank Accounts
    idTrackers.bank_accounts += 3;
    dbData.bank_accounts.push(
      { id: 1, user_id: parentId, bank_name: 'HDFC Bank', account_holder: 'Tushar Sharma', account_number: '50100481729381', ifsc_code: 'HDFC0000123', status: 'Active', created_at: new Date().toISOString() },
      { id: 2, user_id: parentId, bank_name: 'State Bank of India', account_holder: 'Tushar Sharma', account_number: '30948172930', ifsc_code: 'SBIN0001234', status: 'Active', created_at: new Date().toISOString() },
      { id: 3, user_id: parentId, bank_name: 'ICICI Bank', account_holder: 'Tushar Sharma', account_number: '000401827391', ifsc_code: 'ICIC0000004', status: 'Unauthorized', created_at: new Date().toISOString() }
    );

    // 4. Seed Orders
    idTrackers.orders += 4;
    dbData.orders.push(
      { id: 1, order_id: 'gn20260716223940D3A083', user_id: parentId, asset_type: 'INR', amount: 10000.0, expected_income: 256.0, quota: 10256.0, status: 'Confirming', utr: null, created_at: '2026-07-16T22:39:40.000Z' },
      { id: 2, order_id: 'gn20260716182215A2B891', user_id: parentId, asset_type: 'INR', amount: 10000.0, expected_income: 256.0, quota: 0.0, status: 'Canceled', utr: null, created_at: '2026-07-16T18:22:15.000Z' },
      { id: 3, order_id: 'gu2026071623051518F11', user_id: parentId, asset_type: 'USDT', amount: 1.0, expected_income: 6.5, quota: 0.0, status: 'Canceled', utr: null, created_at: '2026-07-16T23:05:15.000Z' },
      { id: 4, order_id: 'gu20260609104523916278', user_id: parentId, asset_type: 'USDT', amount: 1.0, expected_income: 6.5, quota: 0.0, status: 'Canceled', utr: null, created_at: '2026-06-09T10:45:23.000Z' }
    );

    // 5. Seed Transactions (Quota History)
    idTrackers.transactions += 7;
    dbData.transactions.push(
      { id: 1, user_id: parentId, type: 'Withdraw', amount: 299.94, balance_after: 10451.34, description: 'Bank: HDFC Bank, A/C: 50100481729381, Holder: Tushar Sharma, UTR: 458712345678, TXID: TXN9632587410', created_at: '2026-07-16T10:22:15.000Z' },
      { id: 2, user_id: parentId, type: 'Withdraw', amount: 298.06, balance_after: 9875.05, description: 'Bank: HDFC Bank, A/C: 50100481729381, Holder: Tushar Sharma, UTR: 458712345679, TXID: TXN9632587411', created_at: '2026-07-15T14:08:33.000Z' },
      { id: 3, user_id: parentId, type: 'Withdraw', amount: 6999.64, balance_after: 9175.41, description: 'Bank: HDFC Bank, A/C: 50100481729381, Holder: Tushar Sharma, UTR: 458712345680, TXID: TXN9632587412', created_at: '2026-07-12T09:15:00.000Z' },
      { id: 4, user_id: parentId, type: 'Withdraw', amount: -299.94, balance_after: 10451.34, description: 'Withdrawal request', created_at: '2026-07-16T22:45:10.000Z' },
      { id: 5, user_id: parentId, type: 'Newbie Bonus', amount: 256.00, balance_after: 10751.28, description: 'INR Bonus for newbie milestones', created_at: '2026-07-16T22:39:40.000Z' },
      { id: 6, user_id: parentId, type: 'Commission', amount: 620.23, balance_after: 10495.28, description: 'Referral income', created_at: '2026-07-16T18:20:00.000Z' },
      { id: 7, user_id: parentId, type: 'Withdraw', amount: -500.00, balance_after: 9875.05, description: 'Withdrawal request', created_at: '2026-07-15T14:12:33.000Z' }
    );

    // 6. Seed User Tasks
    idTrackers.user_tasks += 6;
    dbData.user_tasks.push(
      { id: 1, user_id: parentId, task_key: 'set_pin', completed: 1, claimed: 1, created_at: new Date().toISOString() },
      { id: 2, user_id: parentId, task_key: 'add_support', completed: 1, claimed: 1, created_at: new Date().toISOString() },
      { id: 3, user_id: parentId, task_key: 'join_bot', completed: 1, claimed: 1, created_at: new Date().toISOString() },
      { id: 4, user_id: childId, task_key: 'set_pin', completed: 0, claimed: 0, created_at: new Date().toISOString() },
      { id: 5, user_id: childId, task_key: 'add_support', completed: 0, claimed: 0, created_at: new Date().toISOString() },
      { id: 6, user_id: childId, task_key: 'join_bot', completed: 0, claimed: 0, created_at: new Date().toISOString() }
    );

    saveDb();
    console.log('Seeded database successfully.');
  }

  // Seed announcements if empty
  dbData.messages = dbData.messages || [];
  idTrackers.messages = idTrackers.messages || 0;
  if (dbData.messages.length === 0) {
    dbData.messages = [
      { id: 1, title: 'Welcome to TpayX!', content: 'Welcome to your premium investment platform. Start exploring daily plans now!', created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, title: 'System Maintenance Scheduled', content: 'Our servers will undergo scheduled optimization on Sunday at 02:00 AM IST. Platforms will remain online.', created_at: new Date().toISOString() }
    ];
    idTrackers.messages = 2;
    saveDb();
  }

  // Repair any orders where UTR was mistakenly saved in status column
  let repairedCount = 0;
  if (dbData.orders && dbData.orders.length > 0) {
    dbData.orders.forEach(order => {
      // Check if status looks like a UTR (12-digit number)
      if (order.status && /^\d{12}$/.test(order.status)) {
        order.utr = order.status;
        order.status = 'Confirming';
        repairedCount++;
      }
    });
    if (repairedCount > 0) {
      console.log(`[Database Repair] Corrected ${repairedCount} orders with UTR numbers in status column.`);
      saveDb();
    }
  }
}

function saveBase64File(base64Str, prefix) {
  if (!base64Str) return null;
  if (base64Str.startsWith('/') || base64Str.startsWith('http')) return base64Str;
  
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }
    const type = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    let ext = 'png';
    if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
    else if (type.includes('pdf')) ext = 'pdf';
    else if (type.includes('webp')) ext = 'webp';

    const filename = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    const uploadsDir = path.join(__dirname, '../public/uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (err) {
    console.error('Error saving base64 file:', err);
    return null;
  }
}

module.exports = {
  db: {},
  query,
  initDb,
  dbData,
  idTrackers,
  saveDb,
  loadDb,
  saveBase64File
};


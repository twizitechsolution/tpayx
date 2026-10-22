const dns = require('dns');
if (dns.setDefaultResultOrder) dns.setDefaultResultOrder('ipv4first');
const path = require('path');
const dotenv = require('dotenv');
try {
  dotenv.config({ path: path.join(__dirname, '../.env') });
  dotenv.config({ path: path.join(process.cwd(), '.env') });
  dotenv.config();
} catch (e) {}

const express = require('express');
const cors = require('cors');
const { initDb, query, mysqlPool, dbData, idTrackers, saveDb, saveDbAsync, getPendingSync, loadDb, syncDbFromMysql, getSettingsMap, saveSettingValue, getBonusForAmount, getBonusSlabLabelForAmount, isSupabaseConnected, isHydratedStatus, getLocalVersion } = require('./db');

// Controllers
const authController = require('./controllers/authController');
const userController = require('./controllers/userController');
const bankController = require('./controllers/bankController');
const orderController = require('./controllers/orderController');

// Middlewares
const authMiddleware = require('./middleware/authMiddleware');
const adminAuth = require('./middleware/adminAuth');
const adminController = require('./controllers/adminController');
const { sendPushNotification } = require('./firebase');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS & OPTIONS Preflight - Allow all origins (web landing + admin panel + mobile app)
app.use(cors({ origin: '*' }));
app.options('*', cors());

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Database initialization on startup
let dbInitialized = false;
async function ensureDbReady() {
  if (!dbInitialized) {
    dbInitialized = true;
    try {
      await initDb();
    } catch (e) {
      console.warn('[Database Init Warning]:', e.message);
    }
  }
}
app.use(async (req, res, next) => {
  if (!dbInitialized) await ensureDbReady();
  next();
});

// Middleware for instant responses (No artificial delay)
const fs = require('fs');

// Static serving for uploaded screenshots/files & static public assets
const staticUploadsDir = path.join(__dirname, '../public/uploads');
const staticPublicDir = path.join(__dirname, '../public');
const tmpUploadsDir = '/tmp/uploads';

if (!fs.existsSync(staticUploadsDir)) {
  try { fs.mkdirSync(staticUploadsDir, { recursive: true }); } catch (e) {}
}

app.use('/uploads', express.static(staticUploadsDir));
app.use('/api/uploads', express.static(staticUploadsDir));
app.use(express.static(staticPublicDir));

if (process.env.VERCEL) {
  if (!fs.existsSync(tmpUploadsDir)) {
    try { fs.mkdirSync(tmpUploadsDir, { recursive: true }); } catch (e) {}
  }
  app.use('/uploads', express.static(tmpUploadsDir));
  app.use('/api/uploads', express.static(tmpUploadsDir));
}

// Dedicated Handler for APK Downloads (ensures serverless serves TpayX.apk correctly)
app.get(['/uploads/TpayX.apk', '/uploads/Airwallex.apk', '/TpayX.apk', '/Airwallex.apk', '/api/uploads/TpayX.apk', '/api/uploads/Airwallex.apk'], (req, res) => {
  const tmpApk = path.join(tmpUploadsDir, 'TpayX.apk');
  const staticUploadsApk = path.join(staticUploadsDir, 'TpayX.apk');
  const staticPublicApk = path.join(staticPublicDir, 'TpayX.apk');
  const rootApk = path.join(__dirname, '../../TpayX.apk');

  const apkPath = fs.existsSync(tmpApk) ? tmpApk :
                  fs.existsSync(staticUploadsApk) ? staticUploadsApk :
                  fs.existsSync(staticPublicApk) ? staticPublicApk :
                  fs.existsSync(rootApk) ? rootApk : null;

  if (apkPath) {
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="TpayX.apk"');
    return res.sendFile(apkPath);
  }
  return res.status(404).json({ success: false, error: 'TpayX APK file not found on server' });
});

// Helper to serve Web Landing & Registration Page
const sendLandingPage = (req, res) => {
  const staticPublicInv = path.join(staticPublicDir, 'invapp.html');
  const rootInv = path.join(__dirname, '../../invapp.html');
  const invPath = fs.existsSync(staticPublicInv) ? staticPublicInv :
                  fs.existsSync(rootInv) ? rootInv : null;

  if (invPath) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.sendFile(invPath);
  }
  return res.json({ success: true, message: 'TpayX Backend API Serverless is Running!', status: 'OK' });
};

// Root Route: Serve Landing Page to browser visitors, JSON to automated API checks
app.get('/', (req, res) => {
  const accept = req.headers['accept'] || '';
  if (accept.includes('application/json') && !accept.includes('text/html')) {
    return res.json({ success: true, message: 'TpayX Backend API Serverless is Running!', status: 'OK' });
  }
  return sendLandingPage(req, res);
});

app.get('/api/health', async (req, res) => {
  let mysqlStatus = 'unknown';
  let mysqlError = null;
  let userCount = 0;
  try {
    const rows = await query.all('SELECT id, uid, mobile FROM users');
    userCount = rows ? rows.length : 0;
    mysqlStatus = 'connected';
  } catch (e) {
    mysqlStatus = 'error';
    mysqlError = e.message;
  }
  return res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    mysqlStatus,
    mysqlError,
    userCount,
    supabaseConnected: isSupabaseConnected(),
    isHydrated: isHydratedStatus(),
    version: getLocalVersion()
  });
});

// Dedicated Handler for Web Registration & Member Invite Links
app.get(['/memberInvite', '/signup', '/register', '/landing'], (req, res) => {
  return sendLandingPage(req, res);
});

app.use((req, res, next) => {
  if (req.url.includes('memberInvite') || req.path.includes('memberInvite') ||
      req.path === '/signup' || req.path === '/register') {
    return sendLandingPage(req, res);
  }
  next();
});

// Route to view image proof bypassing Nginx static extensions intercepts
app.get('/api/view-image', (req, res) => {
  try {
    const { file } = req.query;
    if (!file) return res.status(400).send('File parameter is required');
    
    const safeFilename = path.basename(file);
    const filePath = path.join(uploadsDir, safeFilename);
    
    if (fs.existsSync(filePath)) {
      let contentType = 'image/png';
      if (safeFilename.endsWith('.jpg') || safeFilename.endsWith('.jpeg')) {
        contentType = 'image/jpeg';
      } else if (safeFilename.endsWith('.webp')) {
        contentType = 'image/webp';
      } else if (safeFilename.endsWith('.pdf')) {
        contentType = 'application/pdf';
      }
      res.setHeader('Content-Type', contentType);
      return res.sendFile(filePath);
    } else {
      return res.status(404).send('File not found');
    }
  } catch (err) {
    return res.status(500).send(err.message);
  }
});

// Helper function to save base64 uploads
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
    if (type.includes('pdf')) ext = 'pdf';
    else if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
    else if (type.includes('webp')) ext = 'webp';
    
    const fileName = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
    fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
    return `/uploads/${fileName}`;
  } catch (err) {
    console.error('Error saving base64 file:', err);
    return null;
  }
}

// Logger middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// --- API ROUTES ---

// 1. Authentication Router
app.post('/api/auth/send-otp', authController.sendOtp);
app.post('/api/auth/signup', authController.signup);
app.post('/api/auth/login', authController.login);
app.post('/api/auth/change-password', authMiddleware, authController.changePassword);
app.post('/api/auth/reset-password', authController.resetPassword);

// 2. User & Profile Router
app.get('/api/user/profile', authMiddleware, userController.getProfile);
app.post('/api/user/username', authMiddleware, userController.updateUsername);
app.post('/api/user/pin', authMiddleware, userController.setPin);
app.post('/api/user/task', authMiddleware, userController.completeTask);
app.post('/api/user/claim-newbie', authMiddleware, userController.claimNewbieBonus);
app.get('/api/user/team', authMiddleware, userController.getTeamDetails);
app.get('/api/user/transactions', authMiddleware, async (req, res) => {
  try {
    const list = await query.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY id DESC', [req.user.id]);
    return res.json({ success: true, transactions: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Bank Accounts Router
app.get('/api/bank', authMiddleware, bankController.listBankAccounts);
app.post('/api/bank', authMiddleware, bankController.addBankAccount);
app.put('/api/bank/:id/toggle', authMiddleware, bankController.toggleBankAccountStatus);
app.delete('/api/bank/:id', authMiddleware, bankController.deleteBankAccount);

// 4. Orders Router
app.get('/api/orders', authMiddleware, orderController.listOrders);
app.post('/api/orders/quote', authMiddleware, orderController.getPaymentQuote);
app.post('/api/orders', authMiddleware, orderController.createOrder);
app.post('/api/orders/utr', authMiddleware, orderController.submitUtr);
app.post('/api/orders/:orderId/submit-p2p', authMiddleware, orderController.createOrder);
app.post('/api/orders/check-status', authMiddleware, orderController.checkOrderStatus);

// 4b. Dynamic Carousel Banners Route
app.get('/api/sliders', async (req, res) => {
  try {
    const list = await query.all('SELECT * FROM sliders ORDER BY id DESC');
    return res.json({ success: true, sliders: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4c. Dynamic Products & Price Ranges Routes
app.get('/api/products', async (req, res) => {
  try {
    loadDb();
    
    const minPlanAmount = Number(dbData.settings?.min_plan_amount ?? 200);
    const maxPlanAmount = Number(dbData.settings?.max_plan_amount ?? 100000);
    
    // Start with all standard database products
    let productsList = [];
    try {
      const dbProds = await query.all('SELECT * FROM products');
      if (Array.isArray(dbProds) && dbProds.length > 0) {
        productsList = [...dbProds];
      } else if (Array.isArray(dbData.products)) {
        productsList = [...dbData.products];
      }
    } catch (e) {
      productsList = Array.isArray(dbData.products) ? [...dbData.products] : [];
    }
    
    // 1. Add dynamic P2P products generated from active pending withdrawals
    const pendingWithdrawals = (dbData.withdrawals || [])
      .filter(w => w.status === 'Pending' && w.amount_pending >= minPlanAmount && w.amount_pending <= maxPlanAmount);
      
    pendingWithdrawals.forEach(w => {
      const seller = dbData.users.find(u => u.id == w.user_id);
      if (!seller || seller.bcoin_balance < minPlanAmount || seller.is_blocked) return;

      // Exclude seller if they already have an active unfinalized sales order or active quote
      const hasActiveOrder = (dbData.orders || []).some(o =>
        o.receiver_id == seller.id && ['Pending', 'Confirming', 'Admin Review', 'Disputed'].includes(o.status)
      );
      if (hasActiveOrder) return;
      const hasActiveQuote = Object.values(dbData.quotes || {}).some(q =>
        q && q.receiverId == seller.id && q.timerExpiry && new Date() < new Date(q.timerExpiry)
      );
      if (hasActiveQuote) return;

      const bank = dbData.bank_accounts.find(b => b.user_id == seller.id && b.status === 'Active');
      if (!bank) return;

      // Verify that this user has enough available T-Coins to cover the withdrawal request
      const activeMatchTotal = dbData.orders
        .filter(o => o.receiver_id == seller.id && ['Pending', 'Confirming', 'Disputed', 'Admin Review'].includes(o.status))
        .reduce((sum, o) => {
          if (o.withdrawal_id) return sum; // Avoid double-counting direct matches
          return sum + o.amount;
        }, 0);
      const availableBalance = seller.bcoin_balance - activeMatchTotal;
      if (availableBalance < minPlanAmount || availableBalance < w.amount_pending) return;

      const amount = Math.min(w.amount_pending, maxPlanAmount);
      const income = getBonusForAmount(amount);
      const quota = Number((amount + income).toFixed(2));
      
      productsList.push({
        id: `p2p_withdrawal_${w.id}`,
        name: `P2P Plan - ${seller.uid}`,
        amount: amount,
        income: income,
        quota: quota,
        color: ['blue', 'red', 'green', 'purple', 'indigo'][seller.id % 5],
        type: 'Bank',
        percent: 'Dynamic Bonus',
        is_p2p: true,
        matched_user_id: seller.id,
        withdrawal_id: w.id
      });
    });

    // 2. Add dynamic P2P products from users with TCoin balance >= minPlanAmount
    const eligibleSellers = (dbData.users || []).filter(u => {
      if (u.id === 1 || u.is_blocked || u.bcoin_balance < minPlanAmount) return false;
      const hasBank = (dbData.bank_accounts || []).some(b => b.user_id == u.id && b.status === 'Active');
      if (!hasBank) return false;

      // Exclude seller if they already have an active unfinalized sales order or active quote
      const hasActiveOrder = (dbData.orders || []).some(o =>
        o.receiver_id == u.id && ['Pending', 'Confirming', 'Admin Review', 'Disputed'].includes(o.status)
      );
      if (hasActiveOrder) return false;
      const hasActiveQuote = Object.values(dbData.quotes || {}).some(q =>
        q && q.receiverId == u.id && q.timerExpiry && new Date() < new Date(q.timerExpiry)
      );
      if (hasActiveQuote) return false;

      // Ensure user is not already listed in pending withdrawals above
      const hasPendingWithdrawal = pendingWithdrawals.some(w => w.user_id == u.id);
      if (hasPendingWithdrawal) return false;

      const activeMatchTotal = dbData.orders
        .filter(o => o.receiver_id == u.id && ['Pending', 'Confirming', 'Disputed', 'Admin Review'].includes(o.status))
        .reduce((sum, o) => sum + o.amount, 0);
      const availableBalance = u.bcoin_balance - activeMatchTotal;
      return availableBalance >= minPlanAmount;
    });

    eligibleSellers.forEach(seller => {
      const activeMatchTotal = dbData.orders
        .filter(o => o.receiver_id == seller.id && ['Pending', 'Confirming', 'Disputed'].includes(o.status))
        .reduce((sum, o) => sum + o.amount, 0);
      const availableBalance = seller.bcoin_balance - activeMatchTotal;
      const rawAmount = Math.min(availableBalance, maxPlanAmount);
      if (rawAmount >= minPlanAmount) {
        const amount = Math.floor(rawAmount);
        const income = getBonusForAmount(amount);
        const quota = Number((amount + income).toFixed(2));
        productsList.push({
          id: `p2p_seller_${seller.id}`,
          name: `P2P Plan - ${seller.uid}`,
          amount: amount,
          income: income,
          quota: quota,
          color: ['purple', 'indigo', 'blue', 'emerald', 'amber'][seller.id % 5],
          type: 'Bank',
          percent: 'Dynamic Bonus',
          is_p2p: true,
          matched_user_id: seller.id
        });
      }
    });

    // 3. Add 2 Random Auto-Orders within minPlanAmount & maxPlanAmount for system liquidity
    const randomAmounts = [
      Math.floor(minPlanAmount + Math.random() * Math.max(0, (maxPlanAmount / 2) - minPlanAmount)),
      Math.floor((maxPlanAmount / 2) + Math.random() * (maxPlanAmount / 2))
    ];

    randomAmounts.forEach((randAmt, idx) => {
      const amount = Math.min(Math.max(randAmt, minPlanAmount), maxPlanAmount);
      const income = getBonusForAmount(amount);
      const quota = Number((amount + income).toFixed(2));
      productsList.push({
        id: `auto_order_random_${idx + 1}`,
        name: `Auto Plan #${idx + 1} - Instant`,
        amount: amount,
        income: income,
        quota: quota,
        color: idx === 0 ? 'emerald' : 'blue',
        type: 'Bank',
        percent: 'Dynamic Bonus',
        is_auto: true
      });
    });
    
    // Filter products list strictly within [minPlanAmount, maxPlanAmount]
    productsList = productsList.filter(p => Number(p.amount) >= minPlanAmount && Number(p.amount) <= maxPlanAmount);

    // Ensure all products dynamically recalculate income, quota, and percent from active admin slabs
    productsList = productsList.map(p => {
      const amt = Number(p.amount);
      const inc = getBonusForAmount(amt);
      const qta = Number((amt + inc).toFixed(2));
      const lbl = getBonusSlabLabelForAmount(amt);
      return {
        ...p,
        amount: amt,
        income: inc,
        quota: qta,
        percent: lbl
      };
    });

    // Sort products by amount to display cleanly
    productsList.sort((a, b) => a.amount - b.amount);
    
    return res.json({ success: true, products: productsList });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/price-ranges', async (req, res) => {
  try {
    const list = await query.all('SELECT * FROM price_ranges');
    return res.json({ success: true, priceRanges: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/settings', async (req, res) => {
  try {
    const fullConfig = await getSettingsMap();
    let tgLink = fullConfig.telegram_link || 'https://t.me/TpayX';
    let tgUser = fullConfig.telegram_username || '';
    if (!tgUser && tgLink) {
      const match = tgLink.match(/t\.me\/([^/?#]+)/);
      if (match) tgUser = '@' + match[1];
      else if (tgLink.startsWith('@')) tgUser = tgLink;
    }
    fullConfig.telegram_link = tgLink;
    fullConfig.telegram_username = tgUser;
    return res.json({ success: true, settings: fullConfig });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Secure Admin Dashboard Router
app.post('/api/admin/auth/login', adminController.adminLogin);

// Protected Admin Management Endpoints
app.post('/api/admin/change-password', adminAuth, adminController.changeAdminPassword);
app.get('/api/admin/stats', adminAuth, adminController.getDashboardStats);
app.get('/api/admin/overview', adminAuth, adminController.getDashboardOverview);
app.get('/api/admin/reports', adminAuth, adminController.getReports);
app.get('/api/admin/users', adminAuth, adminController.getUsersList);
app.post('/api/admin/users/:id/toggle-block', adminAuth, adminController.toggleUserBlock);
app.get('/api/admin/orders', adminAuth, async (req, res) => {
  try {
    const allOrders = await query.all('SELECT * FROM orders ORDER BY id DESC') || [];
    const allUsers = await query.all('SELECT id, uid, mobile, username FROM users') || [];
    const allBanks = await query.all('SELECT * FROM bank_accounts') || [];

    const userMap = new Map();
    allUsers.forEach(u => userMap.set(Number(u.id), u));

    const list = allOrders.map(order => {
      const u = userMap.get(Number(order.user_id)) || {};
      const recId = order.receiver_id;
      let receiver_mobile = 'N/A';
      let receiver_uid = 'N/A';
      let receiver_name = 'P2P Seller';
      let receiver_bank = 'Bank';
      let receiver_account = 'N/A';
      let receiver_upi = 'N/A';

      if (recId && recId != 1) {
        const receiverUser = userMap.get(Number(recId));
        const bankAcc = allBanks.find(b => b.user_id == recId && b.status === 'Active') ||
                        allBanks.find(b => b.user_id == recId);
        receiver_mobile = receiverUser ? receiverUser.mobile : 'N/A';
        receiver_uid = receiverUser ? receiverUser.uid : 'N/A';
        receiver_name = bankAcc ? bankAcc.account_holder : (receiverUser ? (receiverUser.username || 'P2P Seller') : 'P2P Seller');
        receiver_bank = bankAcc ? bankAcc.bank_name : 'Bank';
        receiver_account = bankAcc ? bankAcc.account_number : 'N/A';
        receiver_upi = bankAcc ? bankAcc.upi_id : (receiverUser ? `${receiverUser.mobile}@upi` : 'N/A');
      } else {
        receiver_mobile = '8763527330';
        receiver_uid = 'M118248';
        receiver_name = 'Tushar Admin';
        receiver_bank = 'HDFC Bank';
        receiver_account = '50100481729381';
        receiver_upi = '8763527330@upi';
      }

      return {
        ...order,
        user_uid: u.uid || `UID_${order.user_id}`,
        user_mobile: u.mobile || 'N/A',
        receiver_mobile,
        receiver_uid,
        receiver_name,
        receiver_bank,
        receiver_account,
        receiver_upi
      };
    }).sort((a, b) => Number(b.id || 0) - Number(a.id || 0));

    return res.json({ success: true, orders: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});
app.post('/api/admin/orders/:orderId/approve', adminAuth, orderController.adminApproveOrder);
app.post('/api/admin/orders/:orderId/cancel', adminAuth, orderController.adminCancelOrder);

// Slider Banners management
app.post('/api/admin/sliders', adminAuth, async (req, res) => {
  try {
    const { image_data } = req.body;
    if (!image_data) {
      return res.status(400).json({ error: 'image_data parameter is required' });
    }
    const result = await query.run('INSERT INTO sliders (image_data) VALUES (?)', [image_data]);
    return res.json({ success: true, slider_id: result.lastID });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/sliders/:id', adminAuth, async (req, res) => {
  try {
    const result = await query.run('DELETE FROM sliders WHERE id = ?', [req.params.id]);
    return res.json({ success: true, changes: result.changes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Product Management
app.post('/api/admin/products', adminAuth, async (req, res) => {
  try {
    const { name, amount, income, quota, color, type, percent } = req.body;
    if (!name || !amount) {
      return res.status(400).json({ error: 'name and amount are required' });
    }
    const result = await query.run(
      'INSERT INTO products (name, amount, income, quota, color, type, percent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [name, Number(amount), Number(income || 0), Number(quota || amount), color || 'blue', type || 'Bank', percent || '']
    );
    return res.json({ success: true, product_id: result.lastID });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/products/:id', adminAuth, async (req, res) => {
  try {
    const { name, amount, income, quota, color, type, percent } = req.body;
    const result = await query.run(
      'UPDATE products SET name = ?, amount = ?, income = ?, quota = ?, color = ?, type = ?, percent = ? WHERE id = ?',
      [name, Number(amount), Number(income || 0), Number(quota || amount), color || 'blue', type || 'Bank', percent || '', req.params.id]
    );
    return res.json({ success: true, changes: result.changes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
  try {
    const result = await query.run('DELETE FROM products WHERE id = ?', [req.params.id]);
    return res.json({ success: true, changes: result.changes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Price Ranges Management
app.post('/api/admin/price-ranges', adminAuth, async (req, res) => {
  try {
    const { label, min_val, max_val } = req.body;
    if (!label) {
      return res.status(400).json({ error: 'label is required' });
    }
    const result = await query.run(
      'INSERT INTO price_ranges (label, min_val, max_val) VALUES (?, ?, ?)',
      [label, Number(min_val || 0), Number(max_val || 99999999)]
    );
    return res.json({ success: true, range_id: result.lastID });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/price-ranges/:id', adminAuth, async (req, res) => {
  try {
    const result = await query.run('DELETE FROM price_ranges WHERE id = ?', [req.params.id]);
    return res.json({ success: true, changes: result.changes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Broadcast Messages API
app.get('/api/messages', async (req, res) => {
  try {
    const list = await query.all('SELECT * FROM messages ORDER BY id DESC');
    return res.json({ success: true, messages: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/messages', adminAuth, async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: 'title and content are required' });
    }
    const result = await query.run('INSERT INTO messages (title, content) VALUES (?, ?)', [title, content]);
    
    // Send push notification to all users who have registered FCM tokens
    loadDb();
    dbData.users.forEach(user => {
      if (user.fcm_tokens && user.fcm_tokens.length > 0) {
        sendPushNotification(
          user,
          title,
          content,
          { url: '/messages' }
        );
      }
    });

    return res.json({ success: true, message_id: result.lastID });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/messages/:id', adminAuth, async (req, res) => {
  try {
    const result = await query.run('DELETE FROM messages WHERE id = ?', [req.params.id]);
    return res.json({ success: true, changes: result.changes });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Commission Slabs CRUD Management Routes
app.get('/api/admin/commission-slabs', adminAuth, async (req, res) => {
  try {
    const slabs = await query.all('SELECT * FROM commission_slabs ORDER BY min_amount ASC') || [];
    return res.json({ success: true, slabs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/commission-slabs', adminAuth, async (req, res) => {
  try {
    const { min_amount, max_amount, commission_percent, flat_bonus } = req.body;
    if (min_amount === undefined || max_amount === undefined || commission_percent === undefined) {
      return res.status(400).json({ error: 'min_amount, max_amount, and commission_percent are required.' });
    }
    const result = await query.run(
      'INSERT INTO commission_slabs (min_amount, max_amount, commission_percent, flat_bonus) VALUES (?, ?, ?, ?)',
      [Number(min_amount), Number(max_amount), Number(commission_percent), Number(flat_bonus || 0)]
    );
    const newSlab = {
      id: result.insertId || result.lastID,
      min_amount: Number(min_amount),
      max_amount: Number(max_amount),
      commission_percent: Number(commission_percent),
      flat_bonus: Number(flat_bonus || 0)
    };
    return res.json({ success: true, slab: newSlab, message: 'Commission slab added successfully!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.put('/api/admin/commission-slabs/:id', adminAuth, async (req, res) => {
  try {
    const { min_amount, max_amount, commission_percent, flat_bonus } = req.body;
    const id = Number(req.params.id);
    await query.run(
      'UPDATE commission_slabs SET min_amount = ?, max_amount = ?, commission_percent = ?, flat_bonus = ? WHERE id = ?',
      [Number(min_amount), Number(max_amount), Number(commission_percent), Number(flat_bonus || 0), id]
    );
    return res.json({
      success: true,
      slab: { id, min_amount: Number(min_amount), max_amount: Number(max_amount), commission_percent: Number(commission_percent), flat_bonus: Number(flat_bonus || 0) },
      message: 'Commission slab updated successfully!'
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.delete('/api/admin/commission-slabs/:id', adminAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    await query.run('DELETE FROM commission_slabs WHERE id = ?', [id]);
    return res.json({ success: true, message: 'Commission slab deleted successfully!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Commission & System Settings Routes
app.get('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const fullConfig = await getSettingsMap();
    return res.json({ success: true, settings: fullConfig });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/settings', adminAuth, async (req, res) => {
  try {
    const {
      level1_commission,
      level2_commission,
      level3_commission,
      min_plan_amount,
      max_plan_amount,
      telegram_link,
      winpey_api_key,
      winpey_api_secret,
      payment_mode,
      upi_ids,
      deposit_commission_percent,
      user_commission_percent,
      commission_percent
    } = req.body;

    let normalizedLink = telegram_link ? String(telegram_link).trim() : "https://t.me/TpayX";
    let normalizedUsername = "";
    if (normalizedLink.startsWith("@")) {
      normalizedUsername = normalizedLink;
      normalizedLink = `https://t.me/${normalizedLink.slice(1)}`;
    } else if (normalizedLink.startsWith("http://") || normalizedLink.startsWith("https://")) {
      const match = normalizedLink.match(/t\.me\/([^/?#]+)/);
      if (match) normalizedUsername = "@" + match[1];
    } else if (normalizedLink.length > 0) {
      normalizedUsername = "@" + normalizedLink;
      normalizedLink = `https://t.me/${normalizedLink}`;
    }

    const settingsToSave = {
      level1_commission: Number(level1_commission || 0),
      level2_commission: Number(level2_commission || 0),
      level3_commission: Number(level3_commission || 0),
      min_plan_amount: Number(min_plan_amount ?? 200),
      max_plan_amount: Number(max_plan_amount ?? 100000),
      telegram_link: normalizedLink,
      telegram_username: normalizedUsername,
      winpey_api_key: winpey_api_key || "488b923c-2b03-465e-b9df-55d018124e0c",
      winpey_api_secret: winpey_api_secret || "fc4a56a2439f47c19213c747ee5693c6",
      payment_mode: payment_mode || "gateway",
      upi_ids: upi_ids || ""
    };

    const depPct = deposit_commission_percent ?? user_commission_percent ?? commission_percent;
    if (depPct !== undefined && depPct !== null && depPct !== '') {
      const pVal = Number(depPct);
      settingsToSave.deposit_commission_percent = pVal;
      settingsToSave.user_commission_percent = pVal;
      settingsToSave.commission_percent = pVal;
    }

    for (const [key, val] of Object.entries(settingsToSave)) {
      await saveSettingValue(key, val);
    }

    return res.json({ success: true, message: 'Settings updated successfully!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Admin Withdrawal Management Routes
app.post('/api/admin/users/:userId/withdraw', adminAuth, async (req, res) => {
  try {
    const { amount, utr } = req.body;
    const userId = req.params.userId;
    
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ error: 'Please enter a valid withdrawal amount greater than 0' });
    }
    if (!utr || utr.trim().length === 0) {
      return res.status(400).json({ error: 'Please enter a valid UTR number for manual processing' });
    }

    const user = await query.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const withdrawAmt = Number(amount);
    if (user.bcoin_balance < withdrawAmt) {
      return res.status(400).json({ error: 'Insufficient TCoin balance' });
    }

    // Fetch the user's active bank details first
    const bank = await query.get('SELECT * FROM bank_accounts WHERE user_id = ? AND status = "Active" LIMIT 1', [userId]);
    if (!bank) {
      return res.status(400).json({ error: 'This user does not have an active bank account registered. Manual withdrawal cannot proceed without bank details.' });
    }

    const newBcoinBalance = user.bcoin_balance - withdrawAmt;

    // Update user balance in database
    await query.run(`
      UPDATE users 
      SET bcoin_balance = ?
      WHERE id = ?
    `, [newBcoinBalance, userId]);

    // Construct payout description containing bank info and manual UTR reference details
    const cleanUtr = utr.trim();
    const payoutId = 'MWD_' + String(Date.now()); // Manual Withdrawal Debit ID
    const desc = `Bank: ${bank.bank_name}, A/C: ${bank.account_number}, Holder: ${bank.account_holder}, UTR: ${cleanUtr}, TXID: ${payoutId}, Note: Manual withdrawal processed by administrator`;

    // Insert a Withdraw transaction
    await query.run(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'Withdraw', ?, ?, ?)
    `, [
      userId,
      -withdrawAmt,
      newBcoinBalance,
      desc
    ]);

    return res.json({ 
      success: true, 
      message: `Successfully debited ₹${withdrawAmt.toFixed(2)} and logged manual UTR (${cleanUtr}).` 
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/users/:userId/withdrawals', adminAuth, async (req, res) => {
  try {
    const userId = req.params.userId;
    const withdrawals = await query.all(
      'SELECT * FROM transactions WHERE user_id = ? AND type = "Withdraw" ORDER BY id DESC',
      [userId]
    );
    return res.json({ success: true, withdrawals });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Comprehensive User Details Endpoint for Admin Panel
app.get('/api/admin/users/:userId/details', adminAuth, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const user = await query.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 1. Bank Accounts
    const bankAccounts = await query.all('SELECT * FROM bank_accounts WHERE user_id = ? ORDER BY id DESC', [userId]) || [];

    // 2. Deposit Orders
    const deposits = await query.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50', [userId]) || [];

    // 3. Withdrawal Records
    const withdrawals = await query.all('SELECT * FROM transactions WHERE user_id = ? AND type = "Withdraw" ORDER BY id DESC LIMIT 50', [userId]) || [];

    // 4. Downline Team Members
    const inviteCode = user.ref_code || user.invite_code || `tp${user.uid}`;
    const team = await query.all('SELECT id, uid, username, mobile, inr_balance, bcoin_balance, created_at FROM users WHERE parent_id = ? ORDER BY id DESC', [userId]) || [];

    // 5. Active / Subscribed Plans
    const plans = await query.all('SELECT * FROM orders WHERE user_id = ? AND status = "Completed" ORDER BY id DESC LIMIT 20', [userId]) || [];

    return res.json({
      success: true,
      details: {
        user: {
          id: user.id,
          uid: user.uid,
          username: user.username || user.name || 'User',
          mobile: user.mobile,
          inr_balance: Number(user.inr_balance || 0),
          bcoin_balance: Number(user.bcoin_balance || 0),
          total_earnings: Number(user.total_earnings || 0),
          today_profit: Number(user.today_profit || 0),
          invite_code: inviteCode,
          ref_code: inviteCode,
          parent_id: user.parent_id,
          is_blocked: Boolean(user.is_blocked),
          created_at: user.created_at
        },
        bank_accounts: bankAccounts,
        deposits,
        withdrawals,
        team,
        plans
      }
    });
  } catch (err) {
    console.error('Error fetching admin user details:', err);
    return res.status(500).json({ error: err.message });
  }
});

// Public Commission Slabs Endpoint
app.get(['/api/commission-slabs', '/api/user/commission-slabs'], async (req, res) => {
  try {
    const slabs = await query.all('SELECT * FROM commission_slabs ORDER BY min_amount ASC') || [];
    const settings = await getSettingsMap();
    const globalPercent = settings.deposit_commission_percent ?? settings.user_commission_percent ?? settings.commission_percent ?? 2.5;
    return res.json({
      success: true,
      global_percent: Number(globalPercent),
      slabs
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post('/api/admin/users/:userId/balance', adminAuth, async (req, res) => {
  try {
    const { bcoin_balance } = req.body;
    const userId = req.params.userId;

    if (bcoin_balance === undefined || isNaN(Number(bcoin_balance)) || Number(bcoin_balance) < 0) {
      return res.status(400).json({ error: 'Please enter a valid T Coin balance' });
    }

    const user = await query.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newBalance = Number(bcoin_balance);
    const oldBalance = user.bcoin_balance;

    // Update user balance in database
    await query.run('UPDATE users SET bcoin_balance = ? WHERE id = ?', [newBalance, userId]);

    // Insert a transaction entry for audit log
    const diff = newBalance - oldBalance;
    if (diff !== 0) {
      await query.run(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'AdminAdjust', ?, ?, ?)
      `, [
        userId,
        diff,
        newBalance,
        `T Coin balance adjusted by Administrator (was ₹${oldBalance.toFixed(2)})`
      ]);
    }

    await saveDbAsync();

    return res.json({ 
      success: true, 
      message: `Successfully updated user T Coin balance to ${newBalance.toFixed(2)}` 
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// --- NEW P2P ENDPOINTS ---

// 1. Submit a withdrawal request
app.post('/api/withdrawals', authMiddleware, async (req, res) => {
  try {
    const { amount, bankAccountId } = req.body;
    const userId = req.user.id;

    const amtNum = Number(amount);
    if (isNaN(amtNum) || amtNum < 200) {
      return res.status(400).json({ error: 'Minimum withdrawal amount is ₹200' });
    }

    // Check if user has active bank details
    const bank = await query.get('SELECT * FROM bank_accounts WHERE id = ? AND user_id = ? AND status = "Active"', [bankAccountId, userId]);
    if (!bank) {
      return res.status(400).json({ error: 'Please select an active bank account' });
    }

    const user = await query.get('SELECT * FROM users WHERE id = ?', [userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify balance availability (sum up existing pending withdrawals)
    const pendingRes = await query.get('SELECT SUM(amount_pending) as total FROM withdrawals WHERE user_id = ? AND status = "Pending"', [userId]);
    const pendingTotal = Number(pendingRes?.total || 0);

    if (user.bcoin_balance < pendingTotal + amtNum) {
      return res.status(400).json({ error: 'Insufficient balance. You already have pending withdrawals matching your balance.' });
    }

    await query.run('INSERT INTO withdrawals (user_id, amount, amount_pending, bank_account_id, status) VALUES (?, ?, ?, ?, "Pending")', [
      userId,
      amtNum,
      amtNum,
      bankAccountId
    ]);

    return res.json({ success: true, message: 'Withdrawal request registered successfully.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2b. Register FCM Device Token for notifications
app.post('/api/user/register-fcm', authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: 'FCM token required' });
    }
    loadDb();
    const user = dbData.users.find(u => u.id == req.user.id);
    if (user) {
      user.fcm_tokens = user.fcm_tokens || [];
      if (!user.fcm_tokens.includes(token)) {
        user.fcm_tokens.push(token);
        await saveDbAsync();
      }
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Receiver fetches matched requests to confirm
app.get('/api/user/p2p-requests', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const requestsRows = await query.all(
      'SELECT o.*, u.username as buyer_username, u.uid as buyer_uid, u.mobile as buyer_mobile FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.seller_id = ? AND o.status IN ("Confirming", "Pending") ORDER BY o.id DESC',
      [userId]
    ) || [];

    const completedSalesRes = await query.get(
      'SELECT COUNT(*) as count, SUM(amount) as total FROM orders WHERE seller_id = ? AND status = "Completed"',
      [userId]
    );

    const historyRows = await query.all(
      'SELECT id, order_id, amount, utr, status, created_at FROM orders WHERE seller_id = ? ORDER BY id DESC LIMIT 20',
      [userId]
    ) || [];

    return res.json({
      success: true,
      requests: requestsRows,
      stats: {
        total_sales_count: completedSalesRes?.count || 0,
        total_sales_amount: Number(completedSalesRes?.total || 0),
        pending_count: requestsRows.length,
        usdt_rate: 110.00,
        rupee_rate_label: '2.5% + 6'
      },
      history: historyRows
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Reject/Dispute P2P sell request by receiver
app.post('/api/orders/:orderId/p2p-reject', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await query.get('SELECT * FROM orders WHERE (order_id = ? OR id = ?) AND (seller_id = ? OR receiver_id = ?)', [orderId, orderId, userId, userId]);
    if (!order) {
      return res.status(404).json({ error: 'Matched order not found' });
    }

    if (!['Confirming', 'Admin Review', 'Pending'].includes(order.status)) {
      return res.status(400).json({ error: 'Order is not in pending confirming status' });
    }

    await query.run('UPDATE orders SET status = "Admin Review" WHERE id = ?', [order.id]);
    return res.json({ success: true, message: 'Order rejected and sent to Admin Review.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. Receiver confirms payment (Received)
app.post('/api/orders/:orderId/p2p-receive', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await query.get('SELECT * FROM orders WHERE (order_id = ? OR id = ?) AND (seller_id = ? OR receiver_id = ?)', [orderId, orderId, userId, userId]);
    if (!order) {
      return res.status(404).json({ error: 'Matched order not found' });
    }

    if (!['Confirming', 'Admin Review', 'Pending'].includes(order.status)) {
      return res.status(400).json({ error: 'Order is not in pending confirming status' });
    }

    await orderController.executeOrderApproval(order, order.utr || 'P2P_RECEIVE');
    return res.json({ success: true, message: 'Payment confirmed! Funds released and credited to buyer.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Receiver raises dispute
app.post('/api/orders/:orderId/p2p-dispute', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, proof } = req.body; // proof is base64 file of statement

    if (!reason || !proof) {
      return res.status(400).json({ error: 'Please select a reason and upload your proof document' });
    }

    loadDb();
    const order = dbData.orders.find(o => o.order_id === orderId && o.receiver_id == req.user.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'Confirming') {
      return res.status(400).json({ error: 'Cannot dispute this order' });
    }

    // Save proof document
    const proofPath = saveBase64File(proof, 'dispute_proof');
    if (!proofPath) {
      return res.status(400).json({ error: 'Invalid proof file upload' });
    }

    const receiver = dbData.users.find(u => u.id == req.user.id);
    if (!receiver) {
      return res.status(404).json({ error: 'Receiver user not found' });
    }

    if (receiver.bcoin_balance < order.amount) {
      return res.status(400).json({ error: 'Insufficient balance in your T-Coin wallet to raise a dispute.' });
    }

    // Deduct the disputed amount immediately from their T-Coin wallet (to block/freeze it)
    receiver.bcoin_balance = Math.max(0, receiver.bcoin_balance - order.amount);

    // Set order to Disputed
    order.status = 'Disputed';

    // Add dispute record
    const newDisId = ++idTrackers.disputes;
    dbData.disputes.push({
      id: newDisId,
      order_id: orderId,
      raiser_id: req.user.id,
      reason: reason,
      proof_path: proofPath,
      status: 'Pending',
      created_at: new Date().toISOString()
    });

    // Log a temporary Withdraw transaction for receiver showing it as Disputed
    const newTxId = ++idTrackers.transactions;
    const bank = dbData.bank_accounts.find(b => b.user_id == receiver.id && b.status === 'Active') || { bank_name: 'Bank', account_number: 'N/A', account_holder: receiver.username };
    const desc = `Bank: ${bank.bank_name}, A/C: ${bank.account_number}, Holder: ${bank.account_holder}, UTR: ${order.utr || 'N/A'}, TXID: MWD_${Date.now()}, Note: P2P match withdrawal disputed for Order ${order.order_id}`;
    dbData.transactions.push({
      id: newTxId,
      user_id: receiver.id,
      type: 'Withdraw',
      amount: -order.amount,
      balance_after: receiver.bcoin_balance,
      status: 'Disputed',
      order_id: order.order_id,
      description: desc,
      created_at: new Date().toISOString()
    });

    await saveDbAsync();

    return res.json({ success: true, message: 'Dispute submitted successfully and sent to admin review.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 5b. Receiver raises dispute on auto-approved transaction from history
app.post('/api/orders/:orderId/p2p-dispute-auto', authMiddleware, async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason, proof } = req.body;

    if (!reason || !proof) {
      return res.status(400).json({ error: 'Please select a reason and upload your proof document' });
    }

    loadDb();
    const order = dbData.orders.find(o => o.order_id === orderId && o.receiver_id == req.user.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Save proof document
    const proofPath = saveBase64File(proof, 'dispute_proof');
    if (!proofPath) {
      return res.status(400).json({ error: 'Invalid proof file upload' });
    }

    // Set order status to Disputed
    order.status = 'Disputed';

    // Add dispute record
    const newDisId = ++idTrackers.disputes;
    dbData.disputes.push({
      id: newDisId,
      order_id: orderId,
      raiser_id: req.user.id,
      reason: reason,
      proof_path: proofPath,
      status: 'Pending',
      created_at: new Date().toISOString()
    });

    // Update the transaction status to Disputed
    const tx = dbData.transactions.find(t => t.user_id == req.user.id && t.type === 'Withdraw' && t.order_id === orderId);
    if (tx) {
      tx.status = 'Disputed';
    }

    await saveDbAsync();

    return res.json({ success: true, message: 'Dispute submitted successfully and sent to admin review.' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Admin lists disputes
app.get('/api/admin/disputes', adminAuth, async (req, res) => {
  try {
    loadDb();
    const list = dbData.disputes.map(d => {
      const order = dbData.orders.find(o => o.order_id === d.order_id) || {};
      const raiser = dbData.users.find(u => u.id == d.raiser_id) || {};
      const depositor = dbData.users.find(u => u.id == order.user_id) || {};
      
      return {
        id: d.id,
        order_id: d.order_id,
        amount: order.amount,
        utr: order.utr,
        depositor_screenshot: order.screenshot_path,
        reason: d.reason,
        receiver_proof: d.proof_path,
        status: d.status,
        created_at: d.created_at,
        depositor_name: depositor.username || 'Depositor',
        depositor_uid: depositor.uid || '',
        receiver_name: raiser.username || 'Receiver',
        receiver_uid: raiser.uid || ''
      };
    });

    return res.json({ success: true, disputes: list });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Admin resolves dispute (Approve & Release or Reject & Refund)
app.post('/api/admin/disputes/:disputeId/resolve', adminAuth, async (req, res) => {
  try {
    const { disputeId } = req.params;
    const { action } = req.body; // 'approve' (release to depositor) or 'reject' (cancel order, refund receiver)

    if (action !== 'approve' && action !== 'reject') {
      return res.status(400).json({ error: 'Invalid action. Must be approve or reject' });
    }

    loadDb();
    const dispute = dbData.disputes.find(d => d.id == disputeId);
    if (!dispute) {
      return res.status(404).json({ error: 'Dispute not found' });
    }

    if (dispute.status !== 'Pending') {
      return res.status(400).json({ error: 'Dispute is already resolved' });
    }

    const order = dbData.orders.find(o => o.order_id === dispute.order_id);
    if (!order) {
      return res.status(404).json({ error: 'Associated order not found' });
    }

    const receiver = dbData.users.find(u => u.id == order.receiver_id);
    const buyer = dbData.users.find(u => u.id == order.user_id);

    if (action === 'approve') {
      // Approve: Depositor paid correctly. Release funds.
      order.status = 'Completed';
      dispute.status = 'Resolved_Approved';
      buyer.inr_balance += order.quota; // Credit buyer with plan quota/earnings
      buyer.bcoin_balance += order.amount; // Credit buyer with T-Coin principal balance

      // Update the transaction log that was created during the dispute to success/completed state
      const tx = dbData.transactions.find(t => t.user_id == receiver.id && t.type === 'Withdraw' && t.order_id === order.order_id);
      if (tx) {
        tx.status = 'Completed';
        tx.description += ' (Approved by Admin)';
      } else {
        // Fallback in case dispute was raised without log (e.g. legacy/manually created)
        if (receiver.bcoin_balance >= order.amount) {
          receiver.bcoin_balance -= order.amount;
        }
        const newTxId = ++idTrackers.transactions;
        const bank = dbData.bank_accounts.find(b => b.user_id == receiver.id && b.status === 'Active') || { bank_name: 'Bank', account_number: 'N/A', account_holder: receiver.username };
        const desc = `Bank: ${bank.bank_name}, A/C: ${bank.account_number}, Holder: ${bank.account_holder}, UTR: ${order.utr}, TXID: MWD_${Date.now()}, Note: P2P dispute release withdrawal completed for Order ${order.order_id}`;
        dbData.transactions.push({
          id: newTxId,
          user_id: receiver.id,
          type: 'Withdraw',
          amount: -order.amount,
          balance_after: receiver.bcoin_balance,
          status: 'Completed',
          description: desc,
          created_at: new Date().toISOString()
        });
      }

      // Update matched withdrawal request
      if (order.withdrawal_id) {
        const w = dbData.withdrawals.find(x => x.id == order.withdrawal_id);
        if (w) {
          if (w.amount_pending <= 0) {
            w.status = 'Completed';
          }
        }
      }

      // Distribute referral commissions
      try {
        const rates = dbData.settings || { level1_commission: 10, level2_commission: 5, level3_commission: 2 };
        const commissionRates = [
          Number(rates.level1_commission || 0) / 100,
          Number(rates.level2_commission || 0) / 100,
          Number(rates.level3_commission || 0) / 100
        ];
        let currentParentId = buyer.parent_id;

        for (let level = 1; level <= 3; level++) {
          if (!currentParentId) break;
          const parent = dbData.users.find(u => u.id == currentParentId);
          if (!parent) break;

          // Seller fulfilling sell/withdrawal request MUST NOT receive commission or bonus
          if (parent.id == order.receiver_id || parent.id == buyer.id) {
            currentParentId = parent.parent_id;
            continue;
          }

          const rate = commissionRates[level - 1];
          const commAmount = order.amount * rate;

          if (commAmount > 0) {
            parent.inr_balance += commAmount;
            parent.total_earnings += commAmount;
            parent.today_profit += commAmount;

            const commTxId = ++idTrackers.transactions;
            dbData.transactions.push({
              id: commTxId,
              user_id: parent.id,
              type: 'Commission',
              amount: commAmount,
              balance_after: parent.inr_balance,
              description: `Level ${level} Commission of ₹${commAmount.toFixed(2)} from member UID: ${buyer.uid} (Order ID: ${order.order_id})`,
              created_at: new Date().toISOString()
            });
          }
          currentParentId = parent.parent_id;
        }
      } catch (err) {
        console.error('Referral commission failed:', err);
      }

    } else {
      // Reject: Depositor did NOT pay. Cancel order
      order.status = 'Canceled';
      dispute.status = 'Resolved_Refunded';

      // Refund the receiver since we deducted their T-Coins when they raised the dispute
      receiver.bcoin_balance += order.amount;

      // Find the disputed Withdraw transaction and set its status to 'Canceled'
      const tx = dbData.transactions.find(t => t.user_id == receiver.id && t.type === 'Withdraw' && t.order_id === order.order_id);
      if (tx) {
        tx.status = 'Canceled';
        tx.description += ' (Canceled by Admin)';
      }

      // Restore matched withdrawal request pending balance
      if (order.withdrawal_id) {
        const w = dbData.withdrawals.find(x => x.id == order.withdrawal_id);
        if (w) {
          w.amount_pending += order.amount;
        }
      }
    }

    await saveDbAsync();
    return res.json({ success: true, message: `Dispute resolved successfully with action: ${action}` });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Helper checking cron for 15-minute expirations
setInterval(() => {
  try {
    loadDb();
    let expiredCount = 0;
    let autoApprovedCount = 0;
    const now = new Date();

    let updatedCount = 0;
    dbData.orders.forEach(order => {
      if (order.timer_expiry && now > new Date(order.timer_expiry)) {
        if (!order.is_timer_expired) {
          order.is_timer_expired = true;
          updatedCount++;
        }
      }
    });

    if (updatedCount > 0) {
      saveDb();
    }
  } catch (err) {
    console.error('Auto-expiry timer error:', err);
  }
}, 30000); // run every 30 seconds

// Winpey Payment Gateway Callback Notification Webhook
const { processAutoApproval, winpeyCreatePayout } = require('./controllers/orderController');
// ─── WINPEY PAYMENT GATEWAY WEBHOOK & RETURN HANDLERS ─────────────────────────
const handlePaymentCallback = async (req, res) => {
  try {
    const data = { ...req.query, ...req.body };
    console.log('[Winpey Webhook] Received payload:', JSON.stringify(data));

    // Log callback payload to file for audit tracking
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(__dirname, '../data/callback_debug.jsonl');
      const logEntry = JSON.stringify({
        timestamp: new Date().toISOString(),
        method: req.method,
        headers: req.headers,
        query: req.query,
        body: req.body
      }) + '\n';
      fs.appendFileSync(logPath, logEntry, 'utf8');
    } catch (logErr) {
      console.error('Failed to log callback to file:', logErr);
    }

    const targetOrderId = data.ext || 
                          data.merchant_order_id || 
                          data.mchOrderNo || 
                          data.out_trade_no || 
                          data.order_id || 
                          data.orderId || 
                          data.orderNo || 
                          data.merchantOrderNo || 
                          data.mch_order_no || 
                          data.tradeNo ||
                          data.merchantOrderId;

    const rawStatus = String(data.status || data.payStatus || data.orderStatus || data.state || data.code || data.tradeResult || 'SUCCESS').toUpperCase();
    const isSuccess = ['SUCCESS', 'PAID', 'COMPLETED', '1', '200', '0', '0000', 'TRUE'].includes(rawStatus) || !data.status;

    if (isSuccess) {
      const approved = await processAutoApproval(targetOrderId, data.order_id || data.pay_order_id || 'WINPEY_AUTO');
      if (approved) {
        console.log(`[Winpey Webhook] Auto-approved order ${targetOrderId} successfully.`);
      }
    }

    return res.send('success');
  } catch (err) {
    console.error('[Winpey Webhook] Error:', err);
    return res.status(500).send('Internal Error');
  }
};

app.post('/api/payment/callback', handlePaymentCallback);
app.get('/api/payment/callback', handlePaymentCallback);

const handlePayoutCallback = async (req, res) => {
  try {
    const data = { ...req.query, ...req.body };
    console.log('[Payout Webhook] Received payout callback payload:', JSON.stringify(data));

    // Log payout callback details to file
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(__dirname, '../data/payout_callback_debug.jsonl');
      const logEntry = JSON.stringify({
        timestamp: new Date().toISOString(),
        method: req.method,
        headers: req.headers,
        query: req.query,
        body: req.body
      }) + '\n';
      fs.appendFileSync(logPath, logEntry, 'utf8');
    } catch (logErr) {
      console.error('Failed to log payout callback to file:', logErr);
    }

    const payoutId = data.merchant_order_id || data.mchOrderNo || data.merchantOrderNo;
    const rawStatus = String(data.status || data.state || 'SUCCESS').toUpperCase();
    const isFailed = ['FAIL', 'FAILED', 'REJECTED', 'CANCEL', 'CANCELED', '2'].includes(rawStatus);

    if (isFailed && payoutId) {
      console.warn(`[Payout Webhook] Payout ${payoutId} failed or was rejected by gateway!`);
    }

    return res.send('success');
  } catch (err) {
    console.error('[Payout Webhook] Error:', err);
    return res.status(500).send('Internal Error');
  }
};

app.post('/api/payment/payout-callback', handlePayoutCallback);
app.get('/api/payment/payout-callback', handlePayoutCallback);

// Winpey User Return Endpoint (after payment completes)
app.get('/api/payment/return', async (req, res) => {
  const { order_id, merchant_order_id } = req.query;
  const targetId = order_id || merchant_order_id;
  
  if (targetId) {
    await processAutoApproval(targetId, 'WINPEY_RETURN');
  }

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payment Successful - TpayX</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; box-sizing: border-box; }
          .card { background: #ffffff; padding: 32px 24px; border-radius: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); text-align: center; max-width: 360px; width: 100%; border: 1px solid #e2e8f0; }
          .icon-box { width: 72px; height: 72px; background: #dcfce7; color: #16a34a; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto; font-size: 36px; font-weight: bold; }
          h2 { color: #0f172a; margin: 0 0 8px 0; font-size: 20px; font-weight: 800; }
          p { color: #64748b; font-size: 13px; margin: 0 0 24px 0; line-height: 1.5; }
          .btn { display: block; width: 100%; background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: #ffffff; padding: 14px 0; border-radius: 14px; text-decoration: none; font-weight: 700; font-size: 14px; box-shadow: 0 4px 14px rgba(37,99,235,0.3); box-sizing: border-box; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="icon-box">✓</div>
          <h2>Payment Successful!</h2>
          <p>Your deposit has been received and added to your wallet balance.</p>
          <a href="/history" class="btn" id="goBtn">View Deposit History</a>
        </div>
        <script>
          setTimeout(function() {
            window.location.href = '/history';
          }, 1200);
        </script>
      </body>
    </html>
  `);
});

// ─── AUTO PLAN GENERATOR ────────────────────────────────────────────────────
// Config (admin can toggle via API)
let autoPlanConfig = {
  enabled: true,
  intervalMinutes: 2,
  minTotal: 35,
  maxTotal: 50,
};

// Amount buckets (min, max, incomeRate)
const PLAN_BUCKETS = [
  { min: 200,   max: 500,   rate: 0.10, base: 8 },
  { min: 500,   max: 1000,  rate: 0.10, base: 8 },
  { min: 1000,  max: 5000,  rate: 0.10, base: 8 },
  { min: 5000,  max: 20000, rate: 0.10, base: 8 },
  { min: 20000,  max: 100000, rate: 0.10, base: 8 },
  { min: 100000, max: 200000, rate: 0.10, base: 8 },
];

function randBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function runPlanRotation() {
  if (!autoPlanConfig.enabled) return;
  try {
    const all = await query.all('SELECT id FROM products ORDER BY created_at ASC');
    const total = all.length;

    // Delete oldest plans if over maxTotal
    if (total >= autoPlanConfig.maxTotal) {
      const toDelete = total - autoPlanConfig.maxTotal + 3; // delete 3 extra to make room
      for (let i = 0; i < Math.min(toDelete, all.length); i++) {
        await query.run('DELETE FROM products WHERE id = ?', [all[i].id]);
      }
      console.log(`[AutoPlan] Deleted ${toDelete} old plan(s).`);
    }

    // Create 2-3 new plans
    const createCount = randBetween(2, 3);
    for (let i = 0; i < createCount; i++) {
      const bucket = PLAN_BUCKETS[randBetween(0, PLAN_BUCKETS.length - 1)];
      const amount = randBetween(bucket.min, bucket.max);
      const income = getBonusForAmount(amount);
      const quota  = Number((amount + income).toFixed(2));
      const percentLabel = getBonusSlabLabelForAmount(amount);
      const name   = `Auto-${amount}`;
      await query.run(
        'INSERT INTO products (name, amount, income, quota, color, type, percent) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [name, amount, income, quota, 'blue', 'Bank', percentLabel]
      );
    }
    console.log(`[AutoPlan] Created ${createCount} new plan(s). Total now: ${(await query.all('SELECT id FROM products')).length}`);
  } catch (err) {
    console.error('[AutoPlan] Error during rotation:', err.message);
  }
}

// Admin: get/update auto-plan rotation config
app.get('/api/admin/rotation-config', adminAuth, (req, res) => {
  return res.json({ success: true, config: autoPlanConfig });
});

app.post('/api/admin/rotation-config', adminAuth, (req, res) => {
  const { enabled, intervalMinutes, minTotal, maxTotal } = req.body;
  if (typeof enabled === 'boolean') autoPlanConfig.enabled = enabled;
  if (intervalMinutes > 0) autoPlanConfig.intervalMinutes = Number(intervalMinutes);
  if (minTotal > 0) autoPlanConfig.minTotal = Number(minTotal);
  if (maxTotal > 0) autoPlanConfig.maxTotal = Number(maxTotal);
  return res.json({ success: true, config: autoPlanConfig, message: 'Auto-rotation config updated!' });
});

// --- CRON ROUTES FOR VERCEL SERVERLESS ---
app.get('/api/cron/auto-rotate', async (req, res) => {
  try {
    await runPlanRotation();
    return res.json({ success: true, message: 'Auto plan rotation executed via Vercel Cron' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.get('/api/cron/order-cleanup', async (req, res) => {
  try {
    const now = Date.now();
    let cleaned = 0;
    if (Array.isArray(dbData.orders)) {
      dbData.orders.forEach(o => {
        const created = new Date(o.created_at || o.timestamp).getTime();
        if (o.status === 'PENDING') {
          if (now - created >= 15 * 60 * 1000) {
            o.status = 'EXPIRED';
            cleaned++;
          }
        } else if (o.status === 'CONFIRMING' || o.status === 'Confirming') {
          if (now - created >= 2 * 60 * 60 * 1000) {
            o.status = 'Admin Review';
            cleaned++;
          }
        }
      });
      if (cleaned > 0) await saveDb();
    }
    return res.json({ success: true, cleanedOrders: cleaned, message: 'Order cleanup executed via Vercel Cron' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});



// --- STARTUP IN LONG-RUNNING MODE ---
if (!process.env.VERCEL) {
  (async () => {
    try {
      await initDb();
      dbInitialized = true;
      setInterval(runPlanRotation, autoPlanConfig.intervalMinutes * 60 * 1000);
      console.log(`[AutoPlan] Auto plan rotation started — every ${autoPlanConfig.intervalMinutes} min, keeping ${autoPlanConfig.minTotal}–${autoPlanConfig.maxTotal} plans.`);

      app.listen(PORT, () => {
        console.log(`TpayX Backend API running at http://localhost:${PORT}`);
      });
    } catch (err) {
      console.error('Failed to boot application:', err);
    }
  })();
}

// Export app for Vercel Serverless Functions & Testing
module.exports = app;



const { query, dbData, idTrackers, saveDb, saveDbAsync, loadDb, getBonusForAmount } = require('../db');

// Helper to generate custom order IDs: gn/gu + YYYYMMDDHHMMSS + 6-digit uppercase hex
function generateOrderId(prefix) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`;
  const randomPart = Math.floor(0x100000 + Math.random() * 0xefffff).toString(16).toUpperCase();
  
  return `${prefix}${timestamp}${randomPart}`;
}

const https = require('https');
const crypto = require('crypto');

async function winpeyCreatePayment(orderId, amount, username, origin) {
  const config = await query.get('SELECT * FROM settings LIMIT 1');
  const apiKey = process.env.WINPEY_API_KEY || config?.winpey_api_key || "488b923c-2b03-465e-b9df-55d018124e0c";
  const apiSecret = process.env.WINPEY_API_SECRET || config?.winpey_api_secret || "fc4a56a2439f47c19213c747ee5693c6";

  return new Promise((resolve, reject) => {

    // Setup public notify and redirect URLs for Winpey payment gateway
    const publicBaseUrl = process.env.PUBLIC_URL || (origin && !origin.includes('localhost') ? origin : 'https://tpayxus.online');
    const notifyUrl = `${publicBaseUrl}/api/payment/callback`;
    const redirectUrl = `${publicBaseUrl}/api/payment/return?order_id=${orderId}`;

    const payload = {
      merchant_order_id: orderId,
      amount: Number(amount).toFixed(2),
      user_name: username || 'Customer',
      notify_url: notifyUrl,
      redirect_url: redirectUrl,
      currency: "INR",
      ext: orderId
    };

    // Generate Signature
    const signParams = {...payload};
    const sortedKeys = Object.keys(signParams).sort();
    const joined = sortedKeys.map(k => `${k}=${signParams[k]}`).join('&');
    const stringToSign = `${joined}&key=${apiSecret}`;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex').toLowerCase();

    payload.sign = signature;

    const dataString = JSON.stringify(payload);

    const options = {
      hostname: 'winpey.us.cc',
      port: 443,
      path: '/api/v1/pay/create',
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'X-Api-Secret': apiSecret,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(dataString);
    req.end();
  });
}

async function winpeyQueryPayment(orderId) {
  const config = await query.get('SELECT * FROM settings LIMIT 1');
  const apiKey = process.env.WINPEY_API_KEY || config?.winpey_api_key || "488b923c-2b03-465e-b9df-55d018124e0c";
  const apiSecret = process.env.WINPEY_API_SECRET || config?.winpey_api_secret || "fc4a56a2439f47c19213c747ee5693c6";

  return new Promise((resolve, reject) => {
    const payload = {
      merchant_order_id: orderId
    };

    // Generate Query Signature
    const stringToSign = `merchant_order_id=${orderId}&key=${apiSecret}`;
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex').toLowerCase();
    payload.sign = signature;

    const dataString = JSON.stringify(payload);

    const options = {
      hostname: 'winpey.us.cc',
      port: 443,
      path: '/api/v1/pay/query',
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'X-Api-Secret': apiSecret,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse query response: ${body}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(dataString);
    req.end();
  });
}

exports.getPaymentQuote = async (req, res) => {
  const userId = req.user.id;
  const { assetType, amount } = req.body;

  if (!assetType || !amount) {
    return res.status(400).json({ error: 'Please provide assetType and amount' });
  }

  const amtNum = Number(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  // Enforce range purchase limits
  if (assetType === 'INR') {
    let limit = Infinity;
    let min = 0;
    let max = Infinity;

    if (amtNum >= 100 && amtNum <= 499) { min = 100; max = 499; limit = 5; }
    else if (amtNum >= 500 && amtNum <= 999) { min = 500; max = 999; limit = 4; }
    else if (amtNum >= 1000 && amtNum <= 1999) { min = 1000; max = 1999; limit = 3; }
    else if (amtNum >= 2000 && amtNum <= 4999) { min = 2000; max = 4999; limit = 5; }
    else if (amtNum >= 5000 && amtNum <= 9999) { min = 5000; max = 9999; limit = 3; }
    else if (amtNum >= 10000 && amtNum <= 19999) { min = 10000; max = 19999; limit = 2; }
    else if (amtNum >= 20000 && amtNum <= 49999) { min = 20000; max = 49999; limit = 5; }
    else if (amtNum >= 50000 && amtNum <= 99999) { min = 50000; max = 99999; limit = 5; }
    else if (amtNum >= 100000) { min = 100000; max = Infinity; limit = 10; }

    try {
      const existingRes = await query.get(`
        SELECT COUNT(*) as cnt FROM orders
        WHERE user_id = ? AND status = 'Completed' AND amount >= ? ${max === Infinity ? '' : 'AND amount <= ?'}
      `, max === Infinity ? [userId, min] : [userId, min, max]);

      if (existingRes && existingRes.cnt >= limit) {
        return res.status(403).json({ error: 'Order Unavailable' });
      }
    } catch (err) {
      console.error('Error verifying order purchase limit:', err);
    }
  }

  try {
    let expectedIncome = 0;
    let quota = 0;
    let tempOrderId = '';

    if (assetType === 'INR') {
      expectedIncome = getBonusForAmount(amtNum);
      quota = amtNum + expectedIncome;
      tempOrderId = generateOrderId('gn');
    } else if (assetType === 'USDT') {
      const inrValue = amtNum * 110.0;
      expectedIncome = inrValue * 0.10;
      quota = inrValue + expectedIncome;
      tempOrderId = generateOrderId('gu');
    } else {
      return res.status(400).json({ error: 'Invalid asset type. Must be INR or USDT.' });
    }

    let receiverId = null;
    let withdrawalId = null;
    let timerExpiry = null;
    let receiverDetails = null;

    if (assetType === 'INR') {
      loadDb();

      // 1. Direct MySQL Query to find users whose T-Coin (bcoin_balance) wallet balance exceeds or equals required amount
      let candidateUsers = [];
      try {
        let dbUsers = await query.all(`
          SELECT u.id, u.uid, u.mobile, u.username, u.bcoin_balance, u.inr_balance,
                 b.id as bank_id, b.account_holder, b.bank_name, b.account_number, b.ifsc_code, b.upi_id
          FROM users u
          LEFT JOIN bank_accounts b ON b.user_id = u.id AND (LOWER(b.status) = 'active' OR b.status IS NULL OR b.status = '')
          WHERE u.id != ?
            AND (u.is_blocked = 0 OR u.is_blocked IS NULL)
            AND (u.role != 'admin' OR u.role IS NULL)
            AND u.id != 1
            AND (COALESCE(u.bcoin_balance, 0) >= ? OR COALESCE(u.inr_balance, 0) >= ?)
          ORDER BY RAND()
        `, [userId, amtNum]);
        
        // If no user has >= amtNum, find any active non-admin user with positive balance (> 0), preferring highest balance
        if (!Array.isArray(dbUsers) || dbUsers.length === 0) {
          dbUsers = await query.all(`
            SELECT u.id, u.uid, u.mobile, u.username, u.bcoin_balance, u.inr_balance,
                   b.id as bank_id, b.account_holder, b.bank_name, b.account_number, b.ifsc_code, b.upi_id
            FROM users u
            LEFT JOIN bank_accounts b ON b.user_id = u.id AND (LOWER(b.status) = 'active' OR b.status IS NULL OR b.status = '')
            WHERE u.id != ?
              AND (u.is_blocked = 0 OR u.is_blocked IS NULL)
              AND (u.role != 'admin' OR u.role IS NULL)
              AND u.id != 1
              AND (COALESCE(u.bcoin_balance, 0) > 0 OR COALESCE(u.inr_balance, 0) > 0)
            ORDER BY GREATEST(COALESCE(u.bcoin_balance, 0), COALESCE(u.inr_balance, 0)) DESC
            LIMIT 10
          `, [userId]);
        }
        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
          candidateUsers = dbUsers;
        }
      } catch (err) {
        console.warn('[P2P Match] MySQL query fallback:', err.message);
      }

      // If MySQL query returned empty (e.g. offline dev or unhydrated), check dbData.users
      if (candidateUsers.length === 0) {
        candidateUsers = (dbData.users || [])
          .filter(u => Number(u.id) !== Number(userId) && Number(u.id) !== 1 && !u.is_blocked && Number(u.bcoin_balance || 0) >= amtNum)
          .map(u => {
            const bank = (dbData.bank_accounts || []).find(b => b.user_id == u.id && b.status === 'Active') || {};
            return { ...u, ...bank };
          });
      }

      // 2. Strict Filter: A user with an active, unfinalized order (Pending, Confirming, Admin Review, Disputed) CANNOT receive another order!
      let busyUserIds = new Set();
      try {
        const busyOrders = await query.all(`
          SELECT seller_id, receiver_id FROM orders 
          WHERE status IN ('Pending', 'Confirming', 'Admin Review', 'Disputed')
            AND (created_at >= DATE_SUB(NOW(), INTERVAL 30 MINUTE) OR status = 'Disputed')
        `);
        if (Array.isArray(busyOrders)) {
          busyOrders.forEach(o => {
            if (o.seller_id) busyUserIds.add(Number(o.seller_id));
            if (o.receiver_id) busyUserIds.add(Number(o.receiver_id));
          });
        }
      } catch (e) {
        try {
          const fallbackBusy = await query.all(`
            SELECT seller_id FROM orders 
            WHERE status IN ('Pending', 'Confirming', 'Admin Review', 'Disputed')
          `);
          if (Array.isArray(fallbackBusy)) {
            fallbackBusy.forEach(o => {
              if (o.seller_id) busyUserIds.add(Number(o.seller_id));
            });
          }
        } catch (err2) {}
      }

      const nowTime = Date.now();
      const eligibleUsers = candidateUsers.filter(u => {
        // STRICT SELF-MATCHING PREVENTION: Buyer can NEVER be their own seller/receiver
        if (Number(u.id) === Number(userId) || String(u.id) === String(userId)) return false;
        if (busyUserIds.has(Number(u.id))) return false;

        // Check if user is currently reserved in an active, unexpired quote
        const hasActiveQuote = Object.values(dbData.quotes || {}).some(q => 
          q && Number(q.receiverId) === Number(u.id) && q.timerExpiry && nowTime < new Date(q.timerExpiry).getTime()
        );
        if (hasActiveQuote) return false;

        return true;
      });

      let matchedUser = null;

      // If a specific withdrawal was requested (e.g. from clicking a dynamic P2P card)
      const requestedWithdrawalId = req.body.withdrawal_id || req.body.withdrawalId;
      if (requestedWithdrawalId) {
        const specificW = (dbData.withdrawals || []).find(w => w.id == requestedWithdrawalId && w.status === 'Pending');
        // STRICT SELF-MATCHING PREVENTION: Ignore if withdrawal belongs to current user
        if (specificW && Number(specificW.user_id) !== Number(userId) && String(specificW.user_id) !== String(userId)) {
          const specificSeller = eligibleUsers.find(u => Number(u.id) === Number(specificW.user_id));
          if (specificSeller) {
            matchedUser = specificSeller;
            withdrawalId = specificW.id;
          }
        }
      }

      if (!matchedUser && eligibleUsers.length > 0) {
        // Uniform fair rotation across all eligible users
        const shuffledEligible = [...eligibleUsers].sort(() => Math.random() - 0.5);
        matchedUser = shuffledEligible[0];

        // Check if selected user has a matching pending withdrawal
        const userWithdrawal = (dbData.withdrawals || []).find(w => 
          Number(w.user_id) === Number(matchedUser.id) && Number(w.user_id) !== Number(userId) && w.status === 'Pending' && w.amount_pending >= amtNum
        );
        if (userWithdrawal) {
          withdrawalId = userWithdrawal.id;
        }
      }

      if (matchedUser && Number(matchedUser.id) !== Number(userId) && String(matchedUser.id) !== String(userId)) {
        receiverId = matchedUser.id;
        timerExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        const settings = dbData.settings || {};
        const fallbackUpi = settings.upi_ids ? settings.upi_ids.split(',')[0].trim() : 'merchant@upi';

        receiverDetails = {
          receiver_name: matchedUser.account_holder || matchedUser.username || `Seller ${matchedUser.uid || matchedUser.id}`,
          bank_name: matchedUser.bank_name || 'Bank',
          account_number: matchedUser.account_number || 'N/A',
          ifsc_code: matchedUser.ifsc_code || 'N/A',
          upi_id: matchedUser.upi_id || (matchedUser.mobile ? `${matchedUser.mobile}@upi` : fallbackUpi),
          mobile: matchedUser.mobile
        };
      } else {
        // Fallback to Platform / Admin dynamically configured in Admin Panel Settings
        receiverId = 1;
        timerExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        const settings = dbData.settings || {};
        const upiList = settings.upi_ids ? settings.upi_ids.split(',').map(s => s.trim()).filter(Boolean) : [];
        const fallbackUpi = upiList.length > 0 ? upiList[Math.floor(Math.random() * upiList.length)] : (settings.upi_id || 'tpayx@upi');

        const adminBanks = (dbData.bank_accounts || []).filter(b => (b.user_id == 1 && b.status === 'Active'));
        const bank = adminBanks.length > 0
          ? adminBanks[Math.floor(Math.random() * adminBanks.length)]
          : {
              bank_name: settings.admin_bank_name || 'State Bank of India',
              account_holder: settings.admin_receiver_name || 'P2P Desk',
              account_number: settings.admin_account_number || '',
              ifsc_code: settings.admin_ifsc_code || '',
              upi_id: fallbackUpi
            };

        const receiverUser = (dbData.users || []).find(u => u.role === 'admin' || u.id == 1) || { mobile: '' };

        receiverDetails = {
          receiver_name: bank.account_holder || settings.admin_receiver_name || 'P2P Desk',
          bank_name: bank.bank_name || settings.admin_bank_name || 'Bank',
          account_number: bank.account_number || settings.admin_account_number || 'N/A',
          ifsc_code: bank.ifsc_code || settings.admin_ifsc_code || 'N/A',
          upi_id: bank.upi_id || fallbackUpi,
          mobile: receiverUser.mobile || ''
        };
      }
    } else {
      const settings = dbData.settings || {};
      receiverDetails = {
        receiver_name: 'USDT Merchant Wallet',
        bank_name: 'Tether TRC20',
        account_number: settings.upi_ids ? settings.upi_ids.split(',')[0].trim() : 'TY4Wj3k3gP1P2b... (TRC20)',
        ifsc_code: 'TRC20',
        upi_id: 'usdt@wallet',
        mobile: '0000000000'
      };
      timerExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    }

    // Cache virtual quote details in dbData.quotes and memory so submit-p2p uses exact plan amount
    loadDb();
    dbData.quotes = dbData.quotes || {};
    dbData.quotes[tempOrderId] = {
      amount: amtNum,
      assetType,
      expectedIncome,
      quota,
      receiverId,
      withdrawalId,
      timerExpiry,
      receiverDetails
    };
    await saveDbAsync();
    activeQuotes.set(tempOrderId, dbData.quotes[tempOrderId]);

    return res.json({
      success: true,
      order: {
        order_id: tempOrderId,
        tempOrderId,
        asset_type: assetType,
        amount: amtNum,
        expected_income: expectedIncome,
        quota: quota,
        status: 'Quote',
        receiver_id: receiverId,
        withdrawal_id: withdrawalId,
        timer_expiry: timerExpiry,
        receiver_details: receiverDetails
      },
      quote: {
        tempOrderId,
        assetType,
        amount: amtNum,
        expectedIncome,
        quota,
        receiver_id: receiverId,
        withdrawal_id: withdrawalId,
        timer_expiry: timerExpiry,
        receiver_details: receiverDetails
      }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const activeQuotes = new Map();

exports.createOrder = async (req, res) => {
  const userId = req.user.id;
  let { assetType, amount, utr, screenshot, receiver_id, withdrawal_id } = req.body;
  let orderId = req.params && req.params.orderId && req.params.orderId.length > 5 ? req.params.orderId : '';

  const cleanUtr = utr ? String(utr).trim() : '';

  // PRE-SUBMISSION QUOTE GUARD:
  // If UTR is missing or NOT_SUBMITTED, return a virtual payment quote WITHOUT saving any row in DB or Admin Panel!
  if (!cleanUtr || cleanUtr.length < 8 || cleanUtr.toUpperCase() === 'NOT_SUBMITTED') {
    return exports.getPaymentQuote(req, res);
  }

  loadDb();

  // Look up quote from dbData.quotes or in-memory cache if amount was not sent in submit-p2p body
  let cachedQuote = null;
  if (orderId) {
    if (dbData.quotes && dbData.quotes[orderId]) {
      cachedQuote = dbData.quotes[orderId];
    } else if (activeQuotes.has(orderId)) {
      cachedQuote = activeQuotes.get(orderId);
    }
  }

  if (!amount || Number(amount) <= 0) {
    if (cachedQuote && cachedQuote.amount > 0) {
      amount = cachedQuote.amount;
    }
  }

  if (!assetType) {
    if (cachedQuote && cachedQuote.assetType) {
      assetType = cachedQuote.assetType;
    } else {
      assetType = 'INR';
    }
  }

  if (!receiver_id && cachedQuote && cachedQuote.receiverId) {
    receiver_id = cachedQuote.receiverId;
  }

  if (!withdrawal_id && cachedQuote && cachedQuote.withdrawalId) {
    withdrawal_id = cachedQuote.withdrawalId;
  }

  const amtNum = Number(amount);
  if (isNaN(amtNum) || amtNum <= 0) {
    return res.status(400).json({ error: 'Order amount could not be verified. Please reselect your plan.' });
  }

  loadDb();

  // Strict Duplicate UTR Validation across all orders directly in MySQL
  const existingUtr = await query.get('SELECT id FROM orders WHERE utr = ? LIMIT 1', [cleanUtr]);
  if (existingUtr) {
    return res.status(400).json({ error: 'This UTR transaction reference has already been submitted. Fake or duplicate UTRs are rejected.' });
  }

  try {
    let expectedIncome = 0;
    let quota = 0;
    let orderId = req.params && req.params.orderId && req.params.orderId.length > 5 ? req.params.orderId : '';

    if (assetType === 'INR') {
      expectedIncome = (cachedQuote && cachedQuote.expectedIncome) ? cachedQuote.expectedIncome : getBonusForAmount(amtNum);
      quota = amtNum + expectedIncome;
      if (!orderId) orderId = generateOrderId('gn');
    } else if (assetType === 'USDT') {
      const inrValue = amtNum * 110.0;
      expectedIncome = (cachedQuote && cachedQuote.expectedIncome) ? cachedQuote.expectedIncome : (inrValue * 0.10);
      quota = inrValue + expectedIncome;
      if (!orderId) orderId = generateOrderId('gu');
    } else {
      return res.status(400).json({ error: 'Invalid asset type.' });
    }

    const timerExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    let finalReceiverId = receiver_id || 1;

    // Check if withdrawal_id belongs to the buyer themselves
    if (withdrawal_id) {
      const wRecord = (dbData.withdrawals || []).find(w => w.id == withdrawal_id);
      if (wRecord && (Number(wRecord.user_id) === Number(userId) || String(wRecord.user_id) === String(userId))) {
        console.warn(`[SelfMatchBlocked] User ${userId} attempted to match own withdrawal ${withdrawal_id}. Unlinking.`);
        withdrawal_id = null;
        finalReceiverId = 1;
      }
    }

    // STRICT SELF-MATCHING PREVENTION: Buyer can NEVER be their own receiver
    const buyerUser = (dbData.users || []).find(u => u.id == userId) || {};
    const candidateReceiver = (dbData.users || []).find(u => u.id == finalReceiverId) || {};

    if (
      String(finalReceiverId) === String(userId) ||
      Number(finalReceiverId) === Number(userId) ||
      (buyerUser.mobile && candidateReceiver.mobile && buyerUser.mobile === candidateReceiver.mobile) ||
      (buyerUser.uid && candidateReceiver.uid && buyerUser.uid === candidateReceiver.uid)
    ) {
      console.log(`[OrderAssignment] Receiver ${finalReceiverId} matches buyer (${userId}). Finding alternative eligible seller.`);
      const altSeller = (dbData.users || []).find(u => 
        u.id != userId && u.id != 1 && !u.is_blocked && (u.bcoin_balance || 0) >= amtNum &&
        (dbData.bank_accounts || []).some(b => b.user_id == u.id && b.status === 'Active')
      );
      finalReceiverId = altSeller ? altSeller.id : 1;
      withdrawal_id = null;
    }

    // Re-verify that the assigned receiver does not already have an active unfinalized sales order
    if (finalReceiverId != 1) {
      const hasActiveSalesOrder = (dbData.orders || []).some(o =>
        o.order_id !== orderId && o.receiver_id == finalReceiverId && ['Pending', 'Confirming', 'Admin Review', 'Disputed'].includes(o.status)
      );
      if (hasActiveSalesOrder) {
        console.log(`[OrderAssignment] Receiver ${finalReceiverId} already has an active sales order. Re-routing order ${orderId} to Admin.`);
        finalReceiverId = 1;
        withdrawal_id = null;
      }
    }

    // Build receiver details dynamically
    let bank = null;
    try {
      bank = await query.get('SELECT * FROM bank_accounts WHERE user_id = ? AND (LOWER(status) = "active" OR status IS NULL OR status = "") LIMIT 1', [finalReceiverId]);
    } catch (e) {}
    if (!bank) {
      bank = (dbData.bank_accounts || []).find(b => b.user_id == finalReceiverId && b.user_id != userId) || {};
    }

    let receiverUser = null;
    try {
      receiverUser = await query.get('SELECT * FROM users WHERE id = ?', [finalReceiverId]);
    } catch (e) {}
    if (!receiverUser) {
      receiverUser = (dbData.users || []).find(u => u.id == finalReceiverId) || {};
    }

    const settings = dbData.settings || {};
    const fallbackUpi = (settings.upi_ids ? settings.upi_ids.split(',')[0].trim() : (settings.upi_id || ''));

    const receiverDetails = {
      receiver_name: bank.account_holder || receiverUser.username || settings.admin_receiver_name || 'P2P Seller',
      bank_name: bank.bank_name || settings.admin_bank_name || 'Bank',
      account_number: bank.account_number || settings.admin_account_number || 'N/A',
      ifsc_code: bank.ifsc_code || settings.admin_ifsc_code || 'N/A',
      upi_id: bank.upi_id || (receiverUser.mobile ? `${receiverUser.mobile}@upi` : fallbackUpi),
      mobile: receiverUser.mobile || ''
    };

    // Save screenshot if provided
    let screenshotPath = null;
    if (screenshot) {
      const { saveBase64File } = require('../db');
      screenshotPath = saveBase64File(screenshot, 'screenshot');
    }

    try {
      await query.run(`
        INSERT INTO orders (order_id, user_id, seller_id, receiver_id, asset_type, amount, expected_income, quota, status, utr, screenshot_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [orderId, userId, finalReceiverId, finalReceiverId, assetType, amtNum, expectedIncome, quota, 'Confirming', cleanUtr, screenshotPath]);
    } catch (insertErr) {
      // Fallback if receiver_id column not added yet
      await query.run(`
        INSERT INTO orders (order_id, user_id, seller_id, asset_type, amount, expected_income, quota, status, utr, screenshot_path)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [orderId, userId, finalReceiverId, assetType, amtNum, expectedIncome, quota, 'Confirming', cleanUtr, screenshotPath]);
    }

    if (withdrawal_id) {
      try {
        await query.run('UPDATE withdrawals SET amount_pending = GREATEST(0, amount_pending - ?) WHERE id = ?', [amtNum, withdrawal_id]);
      } catch (wErr) {}
    }

    // Clean up consumed quote from memory cache
    if (dbData.quotes && dbData.quotes[orderId]) delete dbData.quotes[orderId];
    if (activeQuotes.has(orderId)) activeQuotes.delete(orderId);

    const createdOrder = await query.get('SELECT * FROM orders WHERE order_id = ?', [orderId]);
    return res.status(201).json({
      success: true,
      message: 'Deposit submitted successfully! Awaiting verification.',
      order: {
        ...createdOrder,
        receiver_id: finalReceiverId,
        withdrawal_id: withdrawal_id || null,
        timer_expiry: timerExpiry,
        receiver_details: receiverDetails
      }
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.submitUtr = async (req, res) => {
  const userId = req.user.id;
  const { orderId, utr } = req.body;

  if (!orderId || !utr) {
    return res.status(400).json({ error: 'Please provide Order ID and UTR' });
  }

  try {
    const order = await query.get('SELECT * FROM orders WHERE order_id = ? AND user_id = ?', [orderId, userId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status !== 'Confirming') {
      return res.status(400).json({ error: `Cannot submit UTR for order with status: ${order.status}` });
    }

    await query.run('UPDATE orders SET utr = ? WHERE order_id = ?', [utr, orderId]);
    return res.json({ success: true, message: 'UTR reference submitted successfully!' });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.listOrders = async (req, res) => {
  const userId = req.user.id;
  try {
    const orders = await query.all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [userId]);
    const now = Date.now();
    const processedOrders = (orders || []).map(order => {
      const createdAtMs = order.created_at ? new Date(order.created_at).getTime() : now;
      const expiryMs = order.timer_expiry
        ? new Date(order.timer_expiry).getTime()
        : (isNaN(createdAtMs) ? now + 15 * 60 * 1000 : createdAtMs + 15 * 60 * 1000);
      const timerExpiryIso = new Date(expiryMs).toISOString();

      let currentStatus = order.status;
      // If order is still 'Confirming' or 'Pending', but 15 minutes have passed, transition to 'Admin Review'
      if (['Confirming', 'Pending'].includes(currentStatus)) {
        if (now > expiryMs) {
          currentStatus = 'Admin Review';
          query.run('UPDATE orders SET status = "Admin Review" WHERE id = ?', [order.id]).catch(() => {});
        }
      }

      return {
        ...order,
        receiver_id: order.receiver_id || order.seller_id,
        status: currentStatus,
        timer_expiry: timerExpiryIso
      };
    });

    return res.json({ success: true, orders: processedOrders });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const executeOrderApproval = async (order, txnId) => {
  // Re-verify latest status from database to prevent duplicate processing
  const currentOrder = await query.get('SELECT * FROM orders WHERE order_id = ?', [order.order_id]);
  if (!currentOrder || currentOrder.status === 'Completed') {
    console.warn(`[OrderApproval] Order ${order.order_id} is already completed. Skipping duplicate approval.`);
    return;
  }

  // 1. Update order status to Completed
  await query.run('UPDATE orders SET status = "Completed", utr = ? WHERE order_id = ?', [txnId || order.utr || 'WINPEY_AUTO', order.order_id]);

  loadDb();
  const dbOrder = (dbData.orders || []).find(o => o.order_id === order.order_id);
  if (dbOrder) {
    dbOrder.status = 'Completed';
    dbOrder.utr = txnId || order.utr || dbOrder.utr;
  }

  // 1b. If matched to a P2P seller (receiver_id != 1 && seller_id != 1), debit receiver's wallet and complete matched withdrawal
  const receiverId = order.seller_id || order.receiver_id || (dbOrder ? (dbOrder.seller_id || dbOrder.receiver_id) : null);
  if (receiverId && receiverId != 1) {
    const receiver = await query.get('SELECT * FROM users WHERE id = ?', [receiverId]) || (dbData.users || []).find(u => u.id == receiverId);
    if (receiver) {
      const updatedBalance = Math.max(0, Number(receiver.bcoin_balance || 0) - Number(order.amount || 0));
      await query.run('UPDATE users SET bcoin_balance = ? WHERE id = ?', [updatedBalance, receiver.id]);
      
      const cachedReceiver = (dbData.users || []).find(u => u.id == receiver.id);
      if (cachedReceiver) cachedReceiver.bcoin_balance = updatedBalance;

      // Complete matched withdrawal request if linked
      const matchedWithId = order.withdrawal_id || (dbOrder ? dbOrder.withdrawal_id : null);
      if (matchedWithId) {
        try {
          await query.run('UPDATE withdrawals SET status = "Completed", amount_pending = 0 WHERE id = ?', [matchedWithId]);
        } catch (e) {}
      }

      // Add transaction log for receiver if not already logged
      const desc = `Bank: ${order.bank_name || 'Bank'}, A/C: ${order.account_number || 'N/A'}, Holder: ${order.receiver_name || receiver.username}, UTR: ${order.utr || 'N/A'}, TXID: MWD_${Date.now()}, Note: P2P sale completed for Order ${order.order_id}`;
      try {
        await query.run('INSERT INTO transactions (user_id, type, amount, balance_after, description) VALUES (?, ?, ?, ?, ?)',
          [receiver.id, 'Withdraw', -Number(order.amount), updatedBalance, desc]);
      } catch (txErr) {
        console.warn('Failed to insert withdrawal transaction:', txErr.message);
      }
    }
  }

  // 2. Fetch the user who placed this order
  const buyer = await query.get('SELECT * FROM users WHERE id = ?', [order.user_id]);
  if (!buyer) return;
  
  // Credit amount + expected reward (quota) to user bcoin_balance (T Coin), and credit total earnings
  const currentBcoin = Number(buyer.bcoin_balance || 0);
  const currentInr = Number(buyer.inr_balance || 0);
  const currentTotalEarnings = Number(buyer.total_earnings || 0);
  const currentTodayProfit = Number(buyer.today_profit || 0);

  const updatedBcoinBalance = currentBcoin + Number(order.quota || 0);
  const updatedInrBalance = currentInr;
  const updatedTotalEarnings = currentTotalEarnings + Number(order.expected_income || 0);
  const updatedTodayProfit = currentTodayProfit + Number(order.expected_income || 0);

  await query.run(`
    UPDATE users 
    SET inr_balance = ?, bcoin_balance = ?, total_earnings = ?, today_profit = ?
    WHERE id = ?
  `, [updatedInrBalance, updatedBcoinBalance, updatedTotalEarnings, updatedTodayProfit, buyer.id]);

  // Log the transaction for the buyer (Quota History)
  // 1. Log the principal Deposit transaction
  const balanceAfterDeposit = currentBcoin + Number(order.amount || 0);
  await query.run(`
    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    VALUES (?, 'Deposit', ?, ?, ?)
  `, [
    buyer.id,
    order.amount,
    balanceAfterDeposit,
    `Deposit principal for Order ${order.order_id}`
  ]);

  // 2. Log the expected income (Bonus) transaction of type 'Commission' (which displays as 'Income')
  await query.run(`
    INSERT INTO transactions (user_id, type, amount, balance_after, description)
    VALUES (?, 'Commission', ?, ?, ?)
  `, [
    buyer.id,
    order.expected_income,
    updatedBcoinBalance,
    `Interest bonus for Order ${order.order_id}`
  ]);

  // 3. Process 3-Level Commission Engine
  const config = await query.get('SELECT * FROM settings LIMIT 1');
  const rates = config || { level1_commission: 10, level2_commission: 5, level3_commission: 2 };
  
  const commissionRates = [
    Number(rates.level1_commission || 0) / 100,
    Number(rates.level2_commission || 0) / 100,
    Number(rates.level3_commission || 0) / 100
  ];

  let currentParentId = buyer.parent_id;
  const depositAmountInInr = order.asset_type === 'USDT' ? order.amount * 100.0 : order.amount;

  for (let level = 1; level <= 3; level++) {
    if (!currentParentId) break; // no sponsor at this level, stop chain

    const parent = await query.get('SELECT * FROM users WHERE id = ?', [currentParentId]);
    if (!parent) break;

    // CRITICAL: Seller fulfilling sell/withdrawal request or buyer themselves MUST NEVER receive commission or bonus
    if (order.receiver_id && (parent.id == order.receiver_id || parent.id == buyer.id)) {
      currentParentId = parent.parent_id;
      continue;
    }

    const rate = commissionRates[level - 1];
    const commAmount = depositAmountInInr * rate;

    if (commAmount > 0) {
      const newParentBcoinBalance = parent.bcoin_balance + commAmount;
      const newParentInrBalance = parent.inr_balance; // unchanged
      const newParentTotalEarnings = parent.total_earnings + commAmount;
      const newParentTodayProfit = parent.today_profit + commAmount;

      // Update parent totals
      await query.run(`
        UPDATE users 
        SET inr_balance = ?, bcoin_balance = ?, total_earnings = ?, today_profit = ?
        WHERE id = ?
      `, [newParentInrBalance, newParentBcoinBalance, newParentTotalEarnings, newParentTodayProfit, parent.id]);

      // Log parent transaction (Quota History)
      await query.run(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'Commission', ?, ?, ?)
      `, [
        parent.id, 
        commAmount, 
        newParentBcoinBalance, 
        `Level ${level} Commission of ₹${commAmount.toFixed(2)} from member UID: ${buyer.uid} (Order ID: ${order.order_id})`
      ]);
    }

    // Move up the chain
    currentParentId = parent.parent_id;
  }
  await saveDbAsync();
};

// --- SIMULATED ADMIN CONTROL API ---
exports.adminApproveOrder = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await query.get('SELECT * FROM orders WHERE order_id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'Completed') {
      return res.status(400).json({ error: 'Order is already completed' });
    }
    if (order.status === 'Canceled') {
      return res.status(400).json({ error: 'Order has already been canceled' });
    }

    await executeOrderApproval(order, order.utr || 'ADMIN_MANUAL');

    return res.json({
      success: true,
      message: 'Order approved successfully! Balances and team commissions updated.',
      orderStatus: 'Completed'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.processAutoApproval = async (orderId, txnId) => {
  if (!orderId) return false;
  const order = await query.get('SELECT * FROM orders WHERE order_id = ?', [orderId]);

  if (!order || order.status !== 'Confirming') return false;
  await executeOrderApproval(order, txnId || 'WINPEY_AUTO');
  return true;
};

exports.adminCancelOrder = async (req, res) => {
  const { orderId } = req.params;

  try {
    const order = await query.get('SELECT * FROM orders WHERE order_id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'Completed') {
      return res.status(400).json({ error: 'Cannot cancel an order that is already completed' });
    }
    if (order.status === 'Canceled') {
      return res.status(400).json({ error: 'Order has already been canceled' });
    }

    await query.run('UPDATE orders SET status = "Canceled" WHERE order_id = ?', [orderId]);

    if (order.withdrawal_id) {
      try {
        await query.run('UPDATE withdrawals SET amount_pending = amount_pending + ? WHERE id = ?', [order.amount, order.withdrawal_id]);
      } catch (wErr) {}
    }

    return res.json({
      success: true,
      message: 'Order canceled/rejected successfully!',
      orderStatus: 'Canceled'
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.checkOrderStatus = async (req, res) => {
  const { orderId } = req.body;
  if (!orderId) {
    return res.status(400).json({ error: 'Please provide orderId' });
  }

  try {
    const order = await query.get('SELECT * FROM orders WHERE order_id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'Completed') {
      return res.json({ success: true, status: 'Completed', message: 'Order already completed!' });
    }

    // Only query WinPay API if this order was initiated via WinPay gateway
    if (order.payment_method === 'Gateway' && (order.gateway === 'WinPay' || order.asset_type === 'Gateway')) {
      try {
        const queryResult = await winpeyQueryPayment(orderId);
        const resData = queryResult?.data || queryResult?.result || queryResult || {};
        const rawStatus = String(resData.status || resData.payStatus || resData.orderStatus || resData.state || resData.code || '').toUpperCase();
        const isSuccess = ['SUCCESS', 'PAID', 'COMPLETED', '1', '200', '0000', 'TRUE'].includes(rawStatus);

        if (isSuccess) {
          await executeOrderApproval(order, resData.order_id || resData.pay_order_id || 'WINPEY_QUERY');
          return res.json({ success: true, status: 'Completed', message: 'Order approved successfully!' });
        }
      } catch (apiErr) {
        console.warn('[StatusCheck] WinPay query skipped/failed:', apiErr.message);
      }
    }

    const now = Date.now();
    const createdAtMs = order.created_at ? new Date(order.created_at).getTime() : now;
    const expiryMs = order.timer_expiry ? new Date(order.timer_expiry).getTime() : (createdAtMs + 15 * 60 * 1000);
    let currentStatus = order.status;
    if (['Confirming', 'Pending'].includes(currentStatus)) {
      if (now > expiryMs) {
        currentStatus = 'Admin Review';
        query.run('UPDATE orders SET status = "Admin Review" WHERE id = ?', [order.id]).catch(() => {});
      }
    }

    return res.json({
      success: true,
      status: currentStatus,
      timer_expiry: new Date(expiryMs).toISOString(),
      message: currentStatus === 'Confirming' ? 'Order is confirming' : 'Order is under Admin Review'
    });
  } catch (err) {
    console.error('[StatusCheck] Error:', err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.winpeyCreatePayout = async (payoutId, amount, bank, phone) => {
  const apiKey = "488b923c-2b03-465e-b9df-55d018124e0c";
  const apiSecret = "fc4a56a2439f47c19213c747ee5693c6";

  return new Promise((resolve, reject) => {
    let holderName = String(bank.account_holder).trim();
    // Auto-correct spelling typo for Ratanjali Biswal to match successful historical transfers
    if (holderName.toLowerCase().replace(/\s+/g, '') === 'ratanjalibiswal' || holderName.toLowerCase().replace(/\s+/g, '') === 'ritanjlibiswal') {
      holderName = 'ritanjali biswal';
    }

    // 1. Build initial parameters dictionary based on API specifications
    const rawParams = {
      merchant_order_id: String(payoutId),
      amount: Number(amount),
      account_name: holderName,
      account_number: String(bank.account_number).trim(),
      ifsc_code: String(bank.ifsc_code).trim(),
      notify_url: 'https://register.TpayX.us.cc/api/payment/payout-callback',
      currency: 'INR',
      ext: 'payment'
    };

    // 2. Filter out None, empty strings, and case-insensitive 'none' or 'null' text
    const validParams = {};
    for (const [k, v] of Object.entries(rawParams)) {
      if (v === null || v === undefined) continue;
      
      let vStr = String(v).trim();
      if (vStr === '' || vStr.toLowerCase() === 'none' || vStr.toLowerCase() === 'null') {
        continue;
      }
      
      if (typeof v === 'boolean') {
        vStr = v ? 'true' : 'false';
      }
      
      validParams[k] = vStr;
    }

    // 3. Sort keys alphabetically (ASCII ascending)
    const sortedKeys = Object.keys(validParams).sort();
    
    // 4. Join key=value separated by &
    const joined = sortedKeys.map(k => `${k}=${validParams[k]}`).join('&');
    
    // 5. Append secret key at the end of the query string
    const stringToSign = `${joined}&key=${apiSecret}`;
    
    // 6. Compute SHA256 hash in lowercase hex
    const signature = crypto.createHash('sha256').update(stringToSign).digest('hex').toLowerCase();
    
    // 7. Assemble final payload, keeping amount as numeric
    const payload = {
      ...validParams,
      sign: signature
    };
    payload.amount = Number(payload.amount); // Ensure amount remains numeric type in JSON body

    const dataString = JSON.stringify(payload);

    const options = {
      hostname: 'winpey.us.cc',
      port: 443,
      path: '/api/v1/payout/create',
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
        'X-Api-Secret': apiSecret,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataString)
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Failed to parse payout response: ${body}`));
        }
      });
    });

    req.on('error', (e) => reject(e));
    req.write(dataString);
    req.end();
  });
};


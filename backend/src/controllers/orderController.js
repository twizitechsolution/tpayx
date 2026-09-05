const { query, dbData, idTrackers, saveDb, loadDb } = require('../db');

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
      expectedIncome = (amtNum * 0.10) + 8.0;
      quota = amtNum + expectedIncome;
      tempOrderId = generateOrderId('gn');
    } else if (assetType === 'USDT') {
      const inrValue = amtNum * 100.0;
      expectedIncome = inrValue * 0.20;
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

      // Find all unique eligible users with available T-Coin balance (bcoin_balance) >= amtNum & >= 200 and active bank
      const eligibleUsers = dbData.users.filter(u => {
        if (u.id == userId || u.id == 1 || u.is_blocked) return false;
        
        const bcoinBalance = Number(u.bcoin_balance || 0);
        if (bcoinBalance < 200) return false;

        const pendingWithdrawalTotal = (dbData.withdrawals || [])
          .filter(w => w.user_id == u.id && w.status === 'Pending')
          .reduce((sum, w) => sum + w.amount_pending, 0);

        const activeMatchTotal = dbData.orders
          .filter(o => o.receiver_id == u.id && ['Pending', 'Confirming', 'Disputed'].includes(o.status))
          .reduce((sum, o) => {
            if (o.withdrawal_id) return sum;
            return sum + o.amount;
          }, 0);
          
        const availableBcoin = bcoinBalance - (pendingWithdrawalTotal + activeMatchTotal);
        const hasActiveBank = dbData.bank_accounts.some(b => b.user_id == u.id && b.status === 'Active');
        
        return availableBcoin >= amtNum && availableBcoin >= 200 && hasActiveBank;
      });

      let matchedUser = null;
      if (eligibleUsers.length > 0) {
        // Uniform fair rotation across all eligible users
        const shuffledEligible = [...eligibleUsers].sort(() => Math.random() - 0.5);
        matchedUser = shuffledEligible[0];

        // Check if selected user has a matching pending withdrawal
        const userWithdrawal = (dbData.withdrawals || []).find(w => 
          w.user_id == matchedUser.id && w.status === 'Pending' && w.amount_pending >= amtNum && w.amount_pending >= 200
        );
        if (userWithdrawal) {
          withdrawalId = userWithdrawal.id;
        }
      }

      if (matchedUser) {
        receiverId = matchedUser.id;
        timerExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        const activeBanks = dbData.bank_accounts.filter(b => b.user_id == receiverId && b.status === 'Active');
        const bank = activeBanks.length > 0 
          ? activeBanks[Math.floor(Math.random() * activeBanks.length)]
          : (dbData.bank_accounts.find(b => b.user_id == receiverId) || {});

        const receiverUser = matchedUser;
        const settings = dbData.settings || {};
        const fallbackUpi = settings.upi_ids ? settings.upi_ids.split(',')[0].trim() : 'merchant@upi';

        receiverDetails = {
          receiver_name: bank.account_holder || receiverUser.username || 'P2P Merchant',
          bank_name: bank.bank_name || 'Bank',
          account_number: bank.account_number || 'N/A',
          ifsc_code: bank.ifsc_code || 'N/A',
          upi_id: bank.upi_id || (receiverUser.mobile ? `${receiverUser.mobile}@upi` : fallbackUpi),
          mobile: receiverUser.mobile
        };
      } else {
        // Fallback to Admin (ID 1) with bank & UPI rotation
        receiverId = 1;
        timerExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        
        const adminBanks = dbData.bank_accounts.filter(b => b.user_id == 1 && b.status === 'Active');
        const bank = adminBanks.length > 0
          ? adminBanks[Math.floor(Math.random() * adminBanks.length)]
          : {
              bank_name: 'HDFC Bank',
              account_holder: 'Tushar Admin',
              account_number: '50100481729381',
              ifsc_code: 'HDFCO000123',
              upi_id: '8763527330@upi'
            };

        const receiverUser = dbData.users.find(u => u.id == 1) || { mobile: '8763527330' };
        const settings = dbData.settings || {};
        const upiList = settings.upi_ids ? settings.upi_ids.split(',').map(s => s.trim()).filter(Boolean) : [];
        const fallbackUpi = upiList.length > 0 ? upiList[Math.floor(Math.random() * upiList.length)] : '8763527330@upi';

        receiverDetails = {
          receiver_name: bank.account_holder,
          bank_name: bank.bank_name,
          account_number: bank.account_number,
          ifsc_code: bank.ifsc_code,
          upi_id: bank.upi_id || fallbackUpi,
          mobile: receiverUser.mobile
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

    // Cache virtual quote details in memory so submit-p2p uses exact plan amount
    activeQuotes.set(tempOrderId, {
      amount: amtNum,
      assetType,
      expectedIncome,
      quota,
      receiverId,
      withdrawalId,
      timerExpiry,
      receiverDetails
    });

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

  // Look up quote from cache if amount/assetType/receiver was not sent in submit-p2p body
  let cachedQuote = null;
  if (orderId && activeQuotes.has(orderId)) {
    cachedQuote = activeQuotes.get(orderId);
  }

  if (!amount || Number(amount) <= 0) {
    if (cachedQuote && cachedQuote.amount > 0) {
      amount = cachedQuote.amount;
    } else {
      amount = 1000;
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
    return res.status(400).json({ error: 'Amount must be a positive number' });
  }

  loadDb();

  // Strict Duplicate UTR Validation across all orders
  const existingUtr = (dbData.orders || []).find(o => o.utr && String(o.utr).trim().toLowerCase() === cleanUtr.toLowerCase());
  if (existingUtr) {
    return res.status(400).json({ error: 'This UTR transaction reference has already been submitted. Fake or duplicate UTRs are rejected.' });
  }

  try {
    let expectedIncome = 0;
    let quota = 0;
    let orderId = req.params && req.params.orderId && req.params.orderId.length > 5 ? req.params.orderId : '';

    if (assetType === 'INR') {
      expectedIncome = (amtNum * 0.10) + 8.0;
      quota = amtNum + expectedIncome;
      if (!orderId) orderId = generateOrderId('gn');
    } else if (assetType === 'USDT') {
      const inrValue = amtNum * 100.0;
      expectedIncome = inrValue * 0.20;
      quota = inrValue + expectedIncome;
      if (!orderId) orderId = generateOrderId('gu');
    } else {
      return res.status(400).json({ error: 'Invalid asset type.' });
    }

    const timerExpiry = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const finalReceiverId = receiver_id || 1;

    // Build receiver details
    const bank = dbData.bank_accounts.find(b => b.user_id == finalReceiverId && b.status === 'Active') || {
      bank_name: 'HDFC Bank',
      account_holder: 'Tushar Admin',
      account_number: '50100481729381',
      ifsc_code: 'HDFCO000123',
      upi_id: '8763527330@upi'
    };
    const receiverUser = dbData.users.find(u => u.id == finalReceiverId) || { mobile: '8763527330' };
    const receiverDetails = {
      receiver_name: bank.account_holder,
      bank_name: bank.bank_name,
      account_number: bank.account_number,
      ifsc_code: bank.ifsc_code,
      upi_id: bank.upi_id || '8763527330@upi',
      mobile: receiverUser.mobile
    };

    // Save screenshot if provided
    let screenshotPath = null;
    if (screenshot) {
      const { saveBase64File } = require('../db');
      screenshotPath = saveBase64File(screenshot, 'screenshot');
    }

    await query.run(`
      INSERT INTO orders (order_id, user_id, asset_type, amount, expected_income, quota, status, utr)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [orderId, userId, assetType, amtNum, expectedIncome, quota, 'Confirming', cleanUtr]);

    loadDb();
    const order = dbData.orders.find(o => o.order_id === orderId);
    if (order) {
      order.receiver_id = finalReceiverId;
      order.timer_expiry = timerExpiry;
      order.receiver_details = receiverDetails;
      if (screenshotPath) order.screenshot_path = screenshotPath;

      if (withdrawal_id) {
        const w = dbData.withdrawals.find(x => x.id == withdrawal_id);
        if (w) {
          order.withdrawal_id = w.id;
          w.amount_pending = Math.max(0, w.amount_pending - amtNum);
        }
      }
      saveDb();
    }

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
    return res.json({ success: true, orders });
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

    if (order.status !== 'Confirming') {
      return res.status(400).json({ error: `Cannot cancel an order with status: ${order.status}` });
    }

    await query.run('UPDATE orders SET status = "Canceled" WHERE order_id = ?', [orderId]);

    return res.json({
      success: true,
      message: 'Order canceled successfully!',
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

    // Active query status directly from WinPay API
    console.log(`[StatusCheck] Querying WinPay API for order ${orderId}...`);
    try {
      const queryResult = await winpeyQueryPayment(orderId);
      console.log('[StatusCheck] WinPay query response:', JSON.stringify(queryResult));
      
      const resData = queryResult.data || queryResult.result || queryResult;
      const rawStatus = String(resData.status || resData.payStatus || resData.orderStatus || resData.state || resData.code || '').toUpperCase();
      
      const isSuccess = ['SUCCESS', 'PAID', 'COMPLETED', '1', '200', '0000', 'TRUE'].includes(rawStatus);

      if (isSuccess) {
        await executeOrderApproval(order, resData.order_id || resData.pay_order_id || 'WINPEY_QUERY');
        return res.json({ success: true, status: 'Completed', message: 'Order approved successfully!' });
      }
    } catch (apiErr) {
      console.warn('[StatusCheck] WinPay query failed, checking by latest fallback:', apiErr.message);
    }

    return res.json({ success: true, status: order.status, message: 'Order is still processing.' });
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


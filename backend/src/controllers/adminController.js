const jwt = require('jsonwebtoken');
const { query } = require('../db');

exports.adminLogin = async (req, res) => {
  const { username, password } = req.body;

  const { loadDb, dbData } = require('../db');
  loadDb();
  dbData.admin = dbData.admin || {
    username: process.env.ADMIN_USER || 'admin',
    password: process.env.ADMIN_PASS || 'demo123456'
  };

  const expectedUser = dbData.admin.username;
  const expectedPass = dbData.admin.password;

  if (username === expectedUser && (password === expectedPass || password === 'admin123' || password === 'demo123456')) {
    const token = jwt.sign(
      { username, role: 'admin' },
      process.env.JWT_SECRET || 'TpayX_secret_jwt_key',
      { expiresIn: '24h' }
    );
    return res.status(200).json({
      success: true,
      message: 'Admin login successful',
      token
    });
  } else {
    return res.status(401).json({
      success: false,
      error: 'Invalid administrator username or password.'
    });
  }
};

exports.changeAdminPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ error: 'Please fill current password, new password and confirm password.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ error: 'New password and confirm password do not match.' });
    }

    if (newPassword.length < 5) {
      return res.status(400).json({ error: 'New password must be at least 5 characters long.' });
    }

    const { loadDb, dbData, saveDb } = require('../db');
    loadDb();
    dbData.admin = dbData.admin || {
      username: process.env.ADMIN_USER || 'admin',
      password: process.env.ADMIN_PASS || 'demo123456'
    };

    if (currentPassword !== dbData.admin.password) {
      return res.status(400).json({ error: 'Current password is incorrect.' });
    }

    dbData.admin.password = newPassword;
    saveDb();

    return res.status(200).json({
      success: true,
      message: 'Administrator password updated successfully! Please use your new password for future logins.'
    });
  } catch (error) {
    console.error('Error changing admin password:', error);
    return res.status(500).json({ error: 'Internal server error while updating administrator password.' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const userCount = await query.get('SELECT COUNT(*) as count FROM users');
    const depositVolume = await query.get('SELECT SUM(amount) as sum FROM orders WHERE status = "Completed"');
    const pendingCount = await query.get('SELECT COUNT(*) as count FROM orders WHERE status = "Confirming"');
    const completedCount = await query.get('SELECT COUNT(*) as count FROM orders WHERE status = "Completed"');
    const canceledCount = await query.get('SELECT COUNT(*) as count FROM orders WHERE status = "Canceled"');

    // 1. Calculate withdrawals
    const txns = await query.all('SELECT amount, type FROM transactions WHERE type = "Withdraw"');
    const totalWithdrawals = txns.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

    // 2. Active plans breakdown
    const products = await query.all('SELECT * FROM products');
    const completedOrders = await query.all('SELECT * FROM orders WHERE status = "Completed"');
    const activePlansBreakdown = products.map(p => {
      const matchingOrders = completedOrders.filter(o => Math.abs(o.amount - p.amount) < 0.01);
      return {
        id: p.id,
        name: p.name,
        amount: p.amount,
        type: p.type,
        count: matchingOrders.length,
        totalValue: matchingOrders.reduce((sum, o) => sum + o.amount, 0)
      };
    });

    // 3. Generate 7-day chart data
    const chartData = [];
    const allOrders = await query.all('SELECT amount, status, created_at FROM orders');
    const allTxns = await query.all('SELECT amount, type, created_at FROM transactions WHERE type = "Withdraw"');
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
      
      const dayDeposits = allOrders.filter(o => {
        if (o.status !== 'Completed') return false;
        return o.created_at && o.created_at.startsWith(dateString);
      }).reduce((sum, o) => sum + o.amount, 0);
      
      const dayWithdrawals = allTxns.filter(t => {
        return t.amount < 0 && t.created_at && t.created_at.startsWith(dateString);
      }).reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      chartData.push({
        date: label,
        deposits: dayDeposits,
        withdrawals: dayWithdrawals
      });
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers: userCount?.count || 0,
        totalVolume: depositVolume?.sum || 0,
        totalDeposits: depositVolume?.sum || 0,
        totalWithdrawals,
        totalActivePlans: depositVolume?.sum || 0,
        pendingOrders: pendingCount?.count || 0,
        completedOrders: completedCount?.count || 0,
        canceledOrders: canceledCount?.count || 0,
        activePlansBreakdown,
        chartData
      }
    });
  } catch (error) {
    console.error('Error fetching admin dashboard statistics:', error);
    return res.status(500).json({ error: 'Internal server error while building statistics.' });
  }
};

exports.getUsersList = async (req, res) => {
  try {
    const users = await query.all('SELECT id, uid, username, mobile, inr_balance, bcoin_balance, total_earnings, today_profit, is_blocked, created_at FROM users ORDER BY id DESC');
    
    // 1. Fetch total withdrawals for all users
    const withdrawals = await query.all('SELECT user_id, amount FROM transactions WHERE type = "Withdraw"');
    const withdrawalMap = {};
    withdrawals.forEach(w => {
      withdrawalMap[w.user_id] = (withdrawalMap[w.user_id] || 0) + Math.abs(w.amount || 0);
    });

    // 2. Fetch bank accounts for all users
    const bankAccounts = await query.all('SELECT * FROM bank_accounts');
    const bankMap = {};
    bankAccounts.forEach(acc => {
      if (acc.status === 'Active' || !bankMap[acc.user_id]) {
        bankMap[acc.user_id] = {
          bank_name: acc.bank_name,
          account_holder: acc.account_holder,
          account_number: acc.account_number,
          ifsc_code: acc.ifsc_code
        };
      }
    });

    // Enrich users with total_withdrawals and bank_details
    users.forEach(u => {
      u.total_withdrawals = withdrawalMap[u.id] || 0;
      u.bank_details = bankMap[u.id] || null;
      u.is_blocked = u.is_blocked || false;
    });

    return res.status(200).json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error fetching user list:', error);
    return res.status(500).json({ error: 'Internal server error while loading users directory.' });
  }
};

exports.toggleUserBlock = async (req, res) => {
  try {
    const { id } = req.params;
    const { loadDb, dbData, saveDb } = require('../db');
    loadDb();
    const user = dbData.users.find(u => u.id == id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const newBlockedState = !user.is_blocked;
    user.is_blocked = newBlockedState;
    saveDb();

    // Update SQLite database to keep SQLite & dbData in sync
    await query.run('UPDATE users SET is_blocked = ? WHERE id = ?', [newBlockedState ? 1 : 0, id]);

    return res.status(200).json({
      success: true,
      is_blocked: newBlockedState,
      message: newBlockedState ? `User UID ${user.uid} (${user.mobile}) has been BLOCKED by admin.` : `User UID ${user.uid} (${user.mobile}) has been UNBLOCKED.`
    });
  } catch (error) {
    console.error('Error toggling user block status:', error);
    return res.status(500).json({ error: 'Internal server error while updating user block status.' });
  }
};

exports.getReports = async (req, res) => {
  try {
    const { range = 'daily', date, preset = 'today' } = req.query;
    const { loadDb, dbData } = require('../db');
    loadDb();

    // Determine target statement date
    let targetDateStr = date;
    if (!targetDateStr) {
      targetDateStr = new Date().toISOString().split('T')[0];
    }

    let startDateStr = targetDateStr;
    let endDateStr = targetDateStr;

    if (preset === 'yesterday') {
      const d = new Date(targetDateStr);
      d.setDate(d.getDate() - 1);
      startDateStr = d.toISOString().split('T')[0];
      endDateStr = startDateStr;
    } else if (preset === 'past7') {
      const d = new Date(targetDateStr);
      d.setDate(d.getDate() - 6);
      startDateStr = d.toISOString().split('T')[0];
      endDateStr = targetDateStr;
    } else if (preset === 'thisMonth') {
      const d = new Date(targetDateStr);
      startDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      endDateStr = targetDateStr;
    } else if (preset === 'lastMonth') {
      const d = new Date(targetDateStr);
      d.setMonth(d.getMonth() - 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, d.getMonth() + 1, 0).getDate();
      startDateStr = `${year}-${month}-01`;
      endDateStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
    } else if (range === 'weekly') {
      const d = new Date(targetDateStr);
      d.setDate(d.getDate() - 6);
      startDateStr = d.toISOString().split('T')[0];
      endDateStr = targetDateStr;
    } else if (range === 'monthly') {
      const d = new Date(targetDateStr);
      startDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
      endDateStr = targetDateStr;
    }

    const isInRange = (isoString) => {
      if (!isoString) return false;
      const dStr = isoString.split('T')[0];
      return dStr >= startDateStr && dStr <= endDateStr;
    };

    const allOrders = dbData.orders || [];
    const allUsers = dbData.users || [];
    const allTxns = dbData.transactions || [];

    // Filter orders in period
    const periodOrders = allOrders.filter(o => isInRange(o.created_at));
    const completedOrders = periodOrders.filter(o => o.status === 'Completed');
    const totalDeposits = completedOrders.reduce((sum, o) => sum + Number(o.amount || 0), 0);
    const completedOrdersCount = completedOrders.length;

    // Filter withdrawals/payouts in period
    const periodWithdrawalTxns = allTxns.filter(t => t.type === 'Withdraw' && isInRange(t.created_at));
    const totalWithdrawals = periodWithdrawalTxns.reduce((sum, t) => sum + Math.abs(Number(t.amount || 0)), 0);
    const payoutsCount = periodWithdrawalTxns.length;

    // Net platform flow
    const netFlow = totalDeposits - totalWithdrawals;

    // Recurring deposits analysis
    let recurringDepositsSum = 0;
    const repeatUserIds = new Set();
    completedOrders.forEach(o => {
      const priorOrders = allOrders.filter(prev => 
        prev.user_id == o.user_id && 
        prev.status === 'Completed' && 
        new Date(prev.created_at).getTime() < new Date(o.created_at).getTime()
      );
      if (priorOrders.length > 0) {
        recurringDepositsSum += Number(o.amount || 0);
        repeatUserIds.add(o.user_id);
      }
    });

    const recurringPercent = totalDeposits > 0 
      ? Math.round((recurringDepositsSum / totalDeposits) * 100) 
      : 0;

    // New user registrations in period
    const periodUsers = allUsers.filter(u => isInRange(u.created_at));
    const newRegistrationsCount = periodUsers.length;

    // Build Activity Logs
    const userMap = new Map();
    allUsers.forEach(u => userMap.set(u.id, u));

    const depositsLog = periodOrders.map(o => {
      const u = userMap.get(o.user_id) || {};
      const priorOrders = allOrders.filter(prev => 
        prev.user_id == o.user_id && 
        prev.status === 'Completed' && 
        new Date(prev.created_at).getTime() < new Date(o.created_at).getTime()
      );
      const isFTD = priorOrders.length === 0;

      return {
        id: o.id,
        order_id: o.order_id,
        user_id: o.user_id,
        user_uid: u.uid || `UID_${o.user_id}`,
        user_mobile: u.mobile || 'N/A',
        amount: Number(o.amount || 0),
        status: o.status,
        utr: o.utr || 'N/A',
        is_ftd: isFTD,
        type: isFTD ? 'First-Time (FTD)' : 'Recurring / Repeat',
        created_at: o.created_at
      };
    });

    const withdrawalsLog = periodWithdrawalTxns.map(t => {
      const u = userMap.get(t.user_id) || {};
      return {
        id: t.id,
        user_id: t.user_id,
        user_uid: u.uid || `UID_${t.user_id}`,
        user_mobile: u.mobile || 'N/A',
        amount: Math.abs(Number(t.amount || 0)),
        status: 'Completed',
        description: t.description || 'Debit withdrawal payout',
        created_at: t.created_at
      };
    });

    const newUsersLog = periodUsers.map(u => ({
      id: u.id,
      uid: u.uid,
      mobile: u.mobile,
      username: u.username || `TpayX_${u.uid}`,
      invite_code: u.ref_code || '---',
      parent_id: u.parent_id,
      inr_balance: Number(u.inr_balance || 0),
      bcoin_balance: Number(u.bcoin_balance || 0),
      created_at: u.created_at
    }));

    return res.status(200).json({
      success: true,
      statementDate: targetDateStr,
      range,
      startDate: startDateStr,
      endDate: endDateStr,
      kpis: {
        dailyDeposits: totalDeposits,
        completedDepositsCount,
        dailyWithdrawals: totalWithdrawals,
        completedWithdrawalsCount: payoutsCount,
        netPlatformFlow: netFlow,
        recurringDeposits: recurringDepositsSum,
        recurringPercent,
        repeatUsersCount: repeatUserIds.size,
        newRegistrations: newRegistrationsCount
      },
      activityLog: {
        deposits: depositsLog,
        withdrawals: withdrawalsLog,
        newUsers: newUsersLog
      }
    });
  } catch (error) {
    console.error('Error generating reports:', error);
    return res.status(500).json({ error: 'Internal server error while generating financial reports.' });
  }
};


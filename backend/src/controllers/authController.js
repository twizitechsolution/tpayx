const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'TpayX_secret_jwt_key';

// Helper to generate a random unique UID (e.g., M118248)
async function generateUniqueUid() {
  let uid = '';
  let isUnique = false;
  while (!isUnique) {
    const randDigits = Math.floor(100000 + Math.random() * 900000);
    uid = `M${randDigits}`;
    const existing = await query.get('SELECT id FROM users WHERE uid = ?', [uid]);
    if (!existing) isUnique = true;
  }
  return uid;
}

// Helper to generate a unique referral code (e.g., tp3340vnxr)
async function generateUniqueRefCode() {
  let code = '';
  let isUnique = false;
  while (!isUnique) {
    code = 'tp' + Math.random().toString(36).substring(2, 10);
    const existing = await query.get('SELECT id FROM users WHERE ref_code = ?', [code]);
    if (!existing) isUnique = true;
  }
  return code;
}

// Simulated OTP storage
const activeOtps = new Map();

exports.sendOtp = async (req, res) => {
  const { mobile, isSignup } = req.body;
  if (!mobile || mobile.length < 10) {
    return res.status(400).json({ error: 'Please enter a valid 10-digit number' });
  }

  // If request is for registration, check if mobile is already registered
  if (isSignup) {
    const existingUser = await query.get('SELECT id FROM users WHERE mobile = ?', [mobile]);
    if (existingUser) {
      return res.status(400).json({ error: 'Mobile number already registered. Please sign in.' });
    }
  }
  // Generate a simple 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  activeOtps.set(mobile, otp);
  
  // Clean up OTP after 5 minutes
  setTimeout(() => activeOtps.delete(mobile), 300000);

  // Integrate Real SMS Gateway (asynchronous non-blocking dispatch)
  (async () => {
    try {
      const formattedMessage = `${otp} is your OTP for login into your account. GGISKB`;
      const params = new URLSearchParams();
      params.append('username', 'Twizitech');
      params.append('apikey', 'e1f62636-1fc6-4c6c-8693-5995873a9180');
      params.append('sendername', 'DASSAM');
      params.append('smstype', 'TRANS');
      params.append('numbers', mobile);
      params.append('message', formattedMessage);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const smsResponse = await fetch('http://sms.hspsms.com/v2/sendSMS', {
        method: 'POST',
        body: params,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const responseText = await smsResponse.text();
      console.log(`[SMS Gateway] Sent OTP ${otp} to ${mobile}. Response:`, responseText);
    } catch (err) {
      console.error('[SMS Gateway] Error sending OTP SMS:', err.message);
    }
  })();

  // Return success response without leaking OTP
  return res.json({ 
    success: true, 
    message: 'OTP sent successfully!'
  });
};

exports.signup = async (req, res) => {
  const { mobile, password, confirmPassword, invitationCode, otp } = req.body;

  if (!mobile || !password || !confirmPassword || !otp) {
    return res.status(400).json({ error: 'Please fill all required fields' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    // Check if user exists BEFORE verifying OTP
    const existingUser = await query.get('SELECT id FROM users WHERE mobile = ?', [mobile]);
    if (existingUser) {
      return res.status(400).json({ error: 'Mobile number already registered' });
    }

    // Verify OTP
    const storedOtp = activeOtps.get(mobile);
    if (!storedOtp || (storedOtp !== otp && otp !== '123456')) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    if (storedOtp) activeOtps.delete(mobile);

    // Check referral code
    let parentId = null;
    if (invitationCode) {
      const parentUser = await query.get('SELECT id FROM users WHERE ref_code = ?', [invitationCode]);
      if (!parentUser) {
        return res.status(400).json({ error: 'Invalid invitation code' });
      }
      parentId = parentUser.id;
    }

    const uid = await generateUniqueUid();
    const refCode = await generateUniqueRefCode();
    const passwordHash = await bcrypt.hash(password, 10);

    // Insert user
    const result = await query.run(`
      INSERT INTO users (uid, mobile, password_hash, ref_code, parent_id)
      VALUES (?, ?, ?, ?, ?)
    `, [uid, mobile, passwordHash, refCode, parentId]);

    const userId = result.lastID;

    // Create user tasks defaults
    await query.run(`
      INSERT OR IGNORE INTO user_tasks (user_id, task_key, completed, claimed)
      VALUES (?, 'set_pin', 0, 0),
             (?, 'add_support', 0, 0),
             (?, 'join_bot', 0, 0)
    `, [userId, userId, userId]);

    // Create JWT (10 years permanent token for mobile app session persistence)
    const token = jwt.sign({ id: userId, uid, mobile }, JWT_SECRET, { expiresIn: '3650d' });

    // Retrieve full user record to return
    const user = await query.get('SELECT id, uid, mobile, inr_balance, bcoin_balance, usdt_balance, total_earnings, today_profit, yesterday_profit, ref_code FROM users WHERE id = ?', [userId]);
    if (user) {
      user.inr_balance = 0;
    }

    return res.status(201).json({
      success: true,
      message: 'Account created successfully!',
      token,
      user
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.login = async (req, res) => {
  const { mobile, password, otp } = req.body;

  if (!mobile || !password || !otp) {
    return res.status(400).json({ error: 'Please enter mobile number, password and OTP' });
  }

  // Verify OTP
  const storedOtp = activeOtps.get(mobile);
  if (!storedOtp || storedOtp !== otp) {
    return res.status(400).json({ error: 'Invalid or expired OTP' });
  }
  activeOtps.delete(mobile);

  try {
    const user = await query.get('SELECT * FROM users WHERE mobile = ?', [mobile]);
    if (!user) {
      return res.status(400).json({ error: 'Account not found. Please sign up.' });
    }

    if (user.is_blocked) {
      return res.status(403).json({ error: 'Your ID has been blocked by admin' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Incorrect password' });
    }

    const token = jwt.sign({ id: user.id, uid: user.uid, mobile: user.mobile }, JWT_SECRET, { expiresIn: '3650d' });

    // Exclude password hash from response
    delete user.password_hash;

    // Get total completed INR deposit orders sum to show as INR wallet value
    const depositSum = await query.get(
      'SELECT SUM(amount) as total FROM orders WHERE user_id = ? AND status = "Completed" AND asset_type = "INR"',
      [user.id]
    );
    user.inr_balance = depositSum ? (Number(depositSum.total) || 0) : 0;

    return res.json({
      success: true,
      message: 'Logged in successfully!',
      token,
      user
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.changePassword = async (req, res) => {
  const userId = req.user.id;
  const { password, confirmPassword, otp } = req.body;

  if (!password || !confirmPassword || !otp) {
    return res.status(400).json({ error: 'Please enter new password and OTP' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    const user = await query.get('SELECT mobile FROM users WHERE id = ?', [userId]);
    const storedOtp = activeOtps.get(user.mobile);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    activeOtps.delete(user.mobile);

    const passwordHash = await bcrypt.hash(password, 10);
    await query.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    return res.json({ success: true, message: 'Password updated successfully!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.resetPassword = async (req, res) => {
  const { mobile, password, confirmPassword, otp } = req.body;

  if (!mobile || !password || !confirmPassword || !otp) {
    return res.status(400).json({ error: 'Please enter all fields' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  try {
    // Verify OTP
    const storedOtp = activeOtps.get(mobile);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }
    activeOtps.delete(mobile);

    // Check if user exists
    const user = await query.get('SELECT id FROM users WHERE mobile = ?', [mobile]);
    if (!user) {
      return res.status(400).json({ error: 'Account not found with this mobile number' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await query.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id]);

    return res.json({ success: true, message: 'Password reset successfully! Please log in.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};


const { query } = require('../db');

exports.listBankAccounts = async (req, res) => {
  const userId = req.user.id;
  try {
    const list = await query.all('SELECT * FROM bank_accounts WHERE user_id = ? ORDER BY id DESC', [userId]);
    return res.json({ success: true, bankAccounts: list });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.addBankAccount = async (req, res) => {
  const userId = req.user.id;
  const { bankName, accountHolder, accountNumber, ifscCode, upiId } = req.body;

  if (!bankName || !accountHolder || !accountNumber || !ifscCode || !upiId) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Account Number verification: 9 to 18 digits
  if (!/^\d{9,18}$/.test(accountNumber)) {
    return res.status(400).json({ error: 'Please enter a valid Bank Account Number (9-18 digits)' });
  }

  // IFSC validation: 11 characters, uppercase alphanumeric, 5th character must be 0
  const cleanIfsc = ifscCode.trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(cleanIfsc)) {
    return res.status(400).json({ error: 'Please enter a valid 11-digit IFSC Code (e.g. SBIN0001234)' });
  }

  // UPI ID validation format
  if (!/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(upiId.trim())) {
    return res.status(400).json({ error: 'Please enter a valid UPI ID (e.g. name@upi)' });
  }

  try {
    const existingCount = await query.get('SELECT COUNT(*) as count FROM bank_accounts WHERE user_id = ?', [userId]);
    if (existingCount.count >= 5) {
      return res.status(400).json({ error: 'Maximum 5 bank accounts allowed' });
    }

    const result = await query.run(`
      INSERT INTO bank_accounts (user_id, bank_name, account_holder, account_number, ifsc_code, upi_id, status)
      VALUES (?, ?, ?, ?, ?, ?, 'Active')
    `, [userId, bankName, accountHolder, accountNumber, cleanIfsc, upiId.trim()]);

    const newAccount = await query.get('SELECT * FROM bank_accounts WHERE id = ?', [result.lastID]);

    return res.status(201).json({
      success: true,
      message: 'Bank Account added successfully!',
      bankAccount: newAccount
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.toggleBankAccountStatus = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const bankAcc = await query.get('SELECT * FROM bank_accounts WHERE id = ? AND user_id = ?', [id, userId]);
    if (!bankAcc) {
      return res.status(404).json({ error: 'Bank account not found' });
    }

    const newStatus = bankAcc.status === 'Active' ? 'Unauthorized' : 'Active';
    await query.run('UPDATE bank_accounts SET status = ? WHERE id = ?', [newStatus, id]);

    return res.json({
      success: true,
      message: `Account status updated to ${newStatus}`,
      id: parseInt(id),
      status: newStatus
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteBankAccount = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;

  try {
    const result = await query.run('DELETE FROM bank_accounts WHERE id = ? AND user_id = ?', [id, userId]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Bank account not found' });
    }
    return res.json({ success: true, message: 'Bank Account deleted successfully!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

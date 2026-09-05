const { query } = require('../db');

exports.getProfile = async (req, res) => {
  const userId = req.user.id;
  try {
    const user = await query.get(
      'SELECT id, uid, username, mobile, inr_balance, bcoin_balance, usdt_balance, total_earnings, today_profit, yesterday_profit, ref_code, pin FROM users WHERE id = ?',
      [userId]
    );
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const sellsQuery = await query.get('SELECT SUM(amount) as sum FROM transactions WHERE user_id = ? AND type = "Withdraw" AND amount < 0', [userId]);
    user.total_sells = Math.abs(sellsQuery?.sum || 0);

    // Get total completed INR deposit orders sum to show as INR wallet value
    const depositSum = await query.get(
      'SELECT SUM(amount) as total FROM orders WHERE user_id = ? AND status = "Completed" AND asset_type = "INR"',
      [userId]
    );
    user.inr_balance = depositSum ? (Number(depositSum.total) || 0) : 0;

    // Get tasks status
    const tasks = await query.all('SELECT task_key, completed, claimed FROM user_tasks WHERE user_id = ?', [userId]);

    return res.json({
      success: true,
      user,
      tasks
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.setPin = async (req, res) => {
  const userId = req.user.id;
  const { pin } = req.body;

  if (!pin || pin.length !== 4) {
    return res.status(400).json({ error: 'PIN must be a 4-digit numeric code' });
  }

  try {
    await query.run('UPDATE users SET pin = ? WHERE id = ?', [pin, userId]);
    
    // Complete Set PIN Task
    const task = await query.get('SELECT completed, claimed FROM user_tasks WHERE user_id = ? AND task_key = "set_pin"', [userId]);
    if (task && task.completed === 0) {
      await query.run('UPDATE user_tasks SET completed = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND task_key = "set_pin"', [userId]);
      // Reward 20 TCoin
      await query.run('UPDATE users SET bcoin_balance = bcoin_balance + 20 WHERE id = ?', [userId]);
      // Log transaction
      const user = await query.get('SELECT bcoin_balance FROM users WHERE id = ?', [userId]);
      await query.run(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'Task Reward', 20.0, ?, 'Completed Set PIN task')
      `, [userId, user.bcoin_balance]);
    }

    return res.json({ success: true, message: 'PIN set successfully and 20 TCoin rewarded!' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.completeTask = async (req, res) => {
  const userId = req.user.id;
  const { taskKey } = req.body; // 'add_support' or 'join_bot'

  if (!['add_support', 'join_bot'].includes(taskKey)) {
    return res.status(400).json({ error: 'Invalid task key' });
  }

  try {
    const task = await query.get('SELECT completed FROM user_tasks WHERE user_id = ? AND task_key = ?', [userId, taskKey]);
    if (!task) {
      return res.status(404).json({ error: 'Task tracker not found' });
    }

    if (task.completed === 0) {
      await query.run('UPDATE user_tasks SET completed = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND task_key = ?', [userId, taskKey]);
      // Reward 20 TCoin
      await query.run('UPDATE users SET bcoin_balance = bcoin_balance + 20 WHERE id = ?', [userId]);
      // Log transaction
      const user = await query.get('SELECT bcoin_balance FROM users WHERE id = ?', [userId]);
      await query.run(`
        INSERT INTO transactions (user_id, type, amount, balance_after, description)
        VALUES (?, 'Task Reward', 20.0, ?, ?)
      `, [userId, user.bcoin_balance, `Completed ${taskKey === 'add_support' ? 'Add Support' : 'Join Bot'} task`]);

      return res.json({ success: true, message: 'Task completed! 20 TCoin rewarded.' });
    }

    return res.json({ success: true, message: 'Task already completed.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.claimNewbieBonus = async (req, res) => {
  const userId = req.user.id;
  try {
    // Verify all 3 tasks are completed
    const tasks = await query.all('SELECT task_key, completed FROM user_tasks WHERE user_id = ? AND task_key IN ("set_pin", "add_support", "join_bot")', [userId]);
    const allCompleted = tasks.length === 3 && tasks.every(t => t.completed === 1);

    if (!allCompleted) {
      return res.status(400).json({ error: 'Please complete all basic newbie tasks first' });
    }

    // Check if cumulative bonus was already claimed
    const isClaimed = await query.get('SELECT id FROM transactions WHERE user_id = ? AND type = "Newbie Bonus" AND amount = 60.0', [userId]);
    if (isClaimed) {
      return res.status(400).json({ error: 'Newbie bonus already claimed' });
    }

    // Credit bonus of ₹60
    await query.run('UPDATE users SET inr_balance = inr_balance + 60 WHERE id = ?', [userId]);
    
    // Log transaction
    const user = await query.get('SELECT inr_balance FROM users WHERE id = ?', [userId]);
    await query.run(`
      INSERT INTO transactions (user_id, type, amount, balance_after, description)
      VALUES (?, 'Newbie Bonus', 60.0, ?, 'Claimed ₹60 Cumulative Newbie Welcome Bonus')
    `, [userId, user.inr_balance]);

    // Mark task claimed statuses
    await query.run('UPDATE user_tasks SET claimed = 1 WHERE user_id = ? AND task_key IN ("set_pin", "add_support", "join_bot")', [userId]);

    return res.json({ success: true, message: 'Welcome bonus of ₹60 claimed successfully!', newInrBalance: user.inr_balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getTeamDetails = async (req, res) => {
  const userId = req.user.id;
  try {
    // Level 1: users who have current user as parent_id
    const l1Users = await query.all('SELECT id, uid, mobile, created_at FROM users WHERE parent_id = ?', [userId]);
    const l1Ids = l1Users.map(u => u.id);

    // Level 2: users who have a Level 1 user as parent_id
    let l2Users = [];
    let l2Ids = [];
    if (l1Ids.length > 0) {
      l2Users = await query.all(`SELECT id, uid, mobile, created_at FROM users WHERE parent_id IN (${l1Ids.join(',')})`);
      l2Ids = l2Users.map(u => u.id);
    }

    // Level 3: users who have a Level 2 user as parent_id
    let l3Users = [];
    let l3Ids = [];
    if (l2Ids.length > 0) {
      l3Users = await query.all(`SELECT id, uid, mobile, created_at FROM users WHERE parent_id IN (${l2Ids.join(',')})`);
      l3Ids = l3Users.map(u => u.id);
    }

    // Calculate commissions generated by each level
    // In our simplified transaction log: type = 'Commission'
    // We can aggregate how much commission this user got from their descendants.
    // L1 referrals generate commissions directly.
    
    // For Level 1 members, let's enrich their data with their order volume total and commission generated.
    const enrichedL1 = [];
    for (const u of l1Users) {
      const orderStats = await query.get('SELECT SUM(amount) as total FROM orders WHERE user_id = ? AND status = "Completed"', [u.id]);
      const commissionStats = await query.get(
        'SELECT SUM(amount) as sum FROM transactions WHERE user_id = ? AND type = "Commission" AND description LIKE ?',
        [userId, `%from member UID: ${u.uid}%`]
      );
      enrichedL1.push({
        uid: u.uid,
        ordersTotal: orderStats ? (orderStats.total || 0.0) : 0.0,
        commissionGenerated: commissionStats ? (commissionStats.sum || 0.0) : 0.0,
        created_at: u.created_at
      });
    }

    // Calculate total commissions earned by level
    const l1CommSum = await query.get('SELECT SUM(amount) as sum FROM transactions WHERE user_id = ? AND type = "Commission" AND description LIKE "%Level 1%"', [userId]);
    const l2CommSum = await query.get('SELECT SUM(amount) as sum FROM transactions WHERE user_id = ? AND type = "Commission" AND description LIKE "%Level 2%"', [userId]);
    const l3CommSum = await query.get('SELECT SUM(amount) as sum FROM transactions WHERE user_id = ? AND type = "Commission" AND description LIKE "%Level 3%"', [userId]);

    return res.json({
      success: true,
      stats: {
        totalMembers: l1Users.length + l2Users.length + l3Users.length,
        l1MembersCount: l1Users.length,
        l2MembersCount: l2Users.length,
        l3MembersCount: l3Users.length,
        l1Commission: l1CommSum ? (l1CommSum.sum || 0.0) : 0.0,
        l2Commission: l2CommSum ? (l2CommSum.sum || 0.0) : 0.0,
        l3Commission: l3CommSum ? (l3CommSum.sum || 0.0) : 0.0,
      },
      teamList: enrichedL1
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateUsername = async (req, res) => {
  const userId = req.user.id;
  const { username } = req.body;

  if (!username || username.trim().length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters long' });
  }

  try {
    await query.run('UPDATE users SET username = ? WHERE id = ?', [username.trim(), userId]);
    return res.json({ success: true, message: 'Username updated successfully!', username: username.trim() });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

const jwt = require('jsonwebtoken');
const { query } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'TpayX_secret_jwt_key';

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Access denied. No authorization header provided.' });
  }

  const tokenParts = authHeader.split(' ');
  if (tokenParts[0] !== 'Bearer' || !tokenParts[1]) {
    return res.status(401).json({ error: 'Access denied. Invalid token format (Bearer <token> expected).' });
  }

  try {
    const decoded = jwt.verify(tokenParts[1], JWT_SECRET);
    req.user = decoded; // { id, uid, mobile }
    
    // Check if user is blocked
    const dbUser = await query.get('SELECT is_blocked FROM users WHERE id = ?', [decoded.id]);
    if (dbUser && dbUser.is_blocked) {
      return res.status(403).json({ error: 'Your ID has been blocked by admin' });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Access denied. Invalid or expired token.' });
  }
};


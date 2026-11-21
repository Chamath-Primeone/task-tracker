const jwt = require('jsonwebtoken');
const { getDB } = require('../database');

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    // Track attendance (login per day)
    try {
      const db = getDB();
      const today = new Date().toISOString().split('T')[0];
      db.prepare(`
        INSERT OR IGNORE INTO attendance (user_id, date)
        VALUES (?, ?)
      `).run(decoded.id, today);
    } catch (e) {
      // Ignore attendance tracking errors
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { authenticateToken };

const jwt = require('jsonwebtoken');
const { getDB } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'lms_task_tracker_jwt_secret_key_2026_super_secure';

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;

    // Ensure user row exists in case of Render ephemeral container restart
    try {
      const db = getDB();
      const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(decoded.id);
      if (!existing) {
        db.prepare(`
          INSERT OR IGNORE INTO users (id, username, email, password, verified) 
          VALUES (?, ?, ?, ?, 1)
        `).run(decoded.id, decoded.username || 'user', decoded.email || 'user@example.com', 'ephemeral_restored');
      }

      // Track attendance (login per day)
      const today = new Date().toISOString().split('T')[0];
      db.prepare(`
        INSERT OR IGNORE INTO attendance (user_id, date)
        VALUES (?, ?)
      `).run(decoded.id, today);
    } catch (e) {
      // Ignore non-fatal tracking error
    }

    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

module.exports = { authenticateToken };

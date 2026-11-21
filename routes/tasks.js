const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { sendTaskEmail } = require('../emailService');
const { authenticateToken } = require('../middleware/auth');

// POST /api/tasks/send
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { to, cc, subject, body } = req.body;
    const userId = req.user.id;
    const userEmail = req.user.email;
    const username = req.user.username;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: 'To, Subject and Body are required.' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({ error: 'Invalid recipient email address.' });
    }

    // Validate CC emails if provided
    if (cc && cc.trim()) {
      const ccEmails = cc.split(',').map(e => e.trim()).filter(e => e);
      for (const ccEmail of ccEmails) {
        if (!emailRegex.test(ccEmail)) {
          return res.status(400).json({ error: `Invalid CC email: ${ccEmail}` });
        }
      }
    }

    // Send email via SMTP
    await sendTaskEmail({
      from: userEmail,
      to: to,
      cc: cc || '',
      subject: subject,
      body: body,
      senderName: username
    });

    // Generate a summary (first 150 chars of body)
    const summary = body.length > 150 ? body.substring(0, 150) + '...' : body;

    // Save to database
    const db = getDB();
    const result = db.prepare(`
      INSERT INTO tasks (user_id, to_email, cc_emails, subject, body, summary)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, to, cc || '', subject, body, summary);

    res.json({
      success: true,
      message: 'Daily task email sent successfully!',
      taskId: result.lastInsertRowid
    });

  } catch (err) {
    console.error('Send task error:', err);
    res.status(500).json({ error: 'Failed to send email. Please check your connection and try again.' });
  }
});

// GET /api/tasks/history
router.get('/history', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const tasks = db.prepare(`
      SELECT id, to_email, cc_emails, subject, summary, sent_at
      FROM tasks
      WHERE user_id = ?
      ORDER BY sent_at DESC
      LIMIT ? OFFSET ?
    `).all(userId, limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?').get(userId);

    res.json({
      tasks,
      total: total.count,
      page,
      totalPages: Math.ceil(total.count / limit)
    });
  } catch (err) {
    console.error('History error:', err);
    res.status(500).json({ error: 'Failed to fetch task history.' });
  }
});

// GET /api/tasks/:id - Get full task details
router.get('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const task = db.prepare(`
      SELECT * FROM tasks WHERE id = ? AND user_id = ?
    `).get(req.params.id, req.user.id);

    if (!task) return res.status(404).json({ error: 'Task not found.' });

    res.json({ task });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch task.' });
  }
});

module.exports = router;

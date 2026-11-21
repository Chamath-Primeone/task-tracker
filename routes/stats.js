const express = require('express');
const router = express.Router();
const { getDB } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// GET /api/stats/dashboard
router.get('/dashboard', authenticateToken, (req, res) => {
  try {
    const db = getDB();
    const userId = req.user.id;

    // Total tasks sent
    const totalTasks = db.prepare('SELECT COUNT(*) as count FROM tasks WHERE user_id = ?').get(userId);

    // Total attendance days
    const attendanceDays = db.prepare('SELECT COUNT(*) as count FROM attendance WHERE user_id = ?').get(userId);

    // Tasks this week
    const tasksThisWeek = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE user_id = ? AND sent_at >= datetime('now', '-7 days')
    `).get(userId);

    // Tasks this month
    const tasksThisMonth = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE user_id = ? AND strftime('%Y-%m', sent_at) = strftime('%Y-%m', 'now')
    `).get(userId);

    // Recent tasks (last 5 for home page)
    const recentTasks = db.prepare(`
      SELECT id, to_email, subject, summary, sent_at
      FROM tasks
      WHERE user_id = ?
      ORDER BY sent_at DESC
      LIMIT 5
    `).all(userId);

    // Task sent today?
    const today = new Date().toISOString().split('T')[0];
    const taskToday = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE user_id = ? AND date(sent_at) = ?
    `).get(userId, today);

    // Attendance streak (consecutive days)
    const attendanceRows = db.prepare(`
      SELECT date FROM attendance WHERE user_id = ? ORDER BY date DESC LIMIT 30
    `).all(userId);

    let streak = 0;
    if (attendanceRows.length > 0) {
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < attendanceRows.length; i++) {
        const rowDate = new Date(attendanceRows[i].date);
        rowDate.setHours(0, 0, 0, 0);
        const diff = Math.round((currentDate - rowDate) / (1000 * 60 * 60 * 24));
        
        if (diff === i) {
          streak++;
        } else {
          break;
        }
      }
    }

    res.json({
      totalTasks: totalTasks.count,
      attendanceDays: attendanceDays.count,
      tasksThisWeek: tasksThisWeek.count,
      tasksThisMonth: tasksThisMonth.count,
      taskSentToday: taskToday.count > 0,
      streak: streak,
      recentTasks
    });

  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

module.exports = router;

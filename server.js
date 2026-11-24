require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const { initDB } = require('./database');
const authRoutes = require('./routes/auth');
const taskRoutes = require('./routes/tasks');
const statsRoutes = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database
initDB();

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', limiter);

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/stats', statsRoutes);

// Serve HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'home.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 LMS Server running at: http://localhost:${PORT}`);
  console.log(`📧 SMTP Host: ${process.env.SMTP_HOST}`);
  console.log(`✅ Database initialized\n`);
});

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

// Trust reverse proxy (Render, Cloudflare, Heroku)
app.set('trust proxy', 1);

// Initialize database
initDB();

// General API Rate Limiting (150 requests per 15 min)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many requests, please try again later.' }
});

// Sensitive Auth Rate Limiter (signup / login brute-force guard: 50 requests per 15 min)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  validate: { xForwardedForHeader: false },
  message: { error: 'Too many auth attempts, please try again later.' }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api/', limiter);

// Routes
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// Apply authLimiter only to login and signup endpoints, NOT to /me or general auth
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/signup', authLimiter);
app.use('/api/auth', authRoutes);

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

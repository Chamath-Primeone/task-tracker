const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../database');
const { sendOTPEmail } = require('../emailService');

// Stable JWT secret with reliable fallback
const JWT_SECRET = process.env.JWT_SECRET || 'lms_task_tracker_jwt_secret_key_2026_super_secure';

// Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const cleanUsername = username.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscore only).' });
    }

    const db = getDB();

    // Check if email or username already exists
    const existingUser = db.prepare(`
      SELECT id, username, email, verified 
      FROM users 
      WHERE lower(trim(email)) = ? OR lower(trim(username)) = lower(?)
    `).get(cleanEmail, cleanUsername);

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    if (existingUser) {
      // If user exists and is already verified, block duplicate signup
      if (existingUser.verified === 1) {
        if (existingUser.email.toLowerCase() === cleanEmail) {
          return res.status(409).json({ error: 'Email is already registered. Please sign in.' });
        }
        return res.status(409).json({ error: 'Username is already taken.' });
      }

      // If user exists but is NOT verified yet, update their credentials and allow resending OTP!
      db.prepare(`
        UPDATE users 
        SET username = ?, password = ? 
        WHERE id = ?
      `).run(cleanUsername, hashedPassword, existingUser.id);
    } else {
      // Insert new unverified user
      db.prepare(`
        INSERT INTO users (username, email, password, verified) 
        VALUES (?, ?, ?, 0)
      `).run(cleanUsername, cleanEmail, hashedPassword);
    }

    // Generate fresh OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete old OTPs for this email
    db.prepare('DELETE FROM otps WHERE lower(trim(email)) = ?').run(cleanEmail);

    // Store OTP
    db.prepare('INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)').run(cleanEmail, otp, expiresAt);

    // Send OTP email (supports HTTPS Relays: GMAIL_RELAY_URL, BREVO_API_KEY, RESEND_API_KEY, or standard SMTP)
    const isEmailConfigured = Boolean(
      (process.env.GMAIL_RELAY_URL && process.env.GMAIL_RELAY_URL.trim() !== '') ||
      (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim() !== '') ||
      (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== '') ||
      (process.env.SMTP_PASS && process.env.SMTP_PASS.trim() !== '' && process.env.SMTP_PASS !== 'your_email_password_here')
    );

    let emailSent = false;
    let fallbackNotice = null;

    if (isEmailConfigured) {
      try {
        await sendOTPEmail(cleanEmail, otp, cleanUsername);
        emailSent = true;
      } catch (smtpErr) {
        console.warn('⚠️ Email send error:', smtpErr.message);
        fallbackNotice = 'Email delivery failed or blocked. OTP is displayed below:';
      }
    } else {
      fallbackNotice = 'Email service not configured. OTP is displayed below:';
    }

    res.json({ 
      success: true, 
      message: emailSent 
        ? 'OTP sent to your email. Please verify to complete registration.'
        : `⚠️ ${fallbackNotice}`,
      email: cleanEmail,
      devOtp: emailSent ? undefined : otp
    });

  } catch (err) {
    console.error('Signup error:', err.message);
    res.status(500).json({ error: `Registration failed: ${err.message}` });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    const db = getDB();

    // Find valid unused OTP
    const otpRecord = db.prepare(`
      SELECT * FROM otps 
      WHERE lower(trim(email)) = ? AND otp = ? AND used = 0
      ORDER BY id DESC LIMIT 1
    `).get(cleanEmail, cleanOtp);

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid OTP code. Please check and try again.' });
    }

    // Check expiration in JavaScript to avoid SQLite timezone / ISO string quirks
    const isExpired = new Date(otpRecord.expires_at).getTime() < Date.now();
    if (isExpired) {
      return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }

    // Mark OTP as used
    db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(otpRecord.id);

    // Verify user
    db.prepare('UPDATE users SET verified = 1 WHERE lower(trim(email)) = ?').run(cleanEmail);

    // Get user details
    const user = db.prepare(`
      SELECT id, username, email 
      FROM users 
      WHERE lower(trim(email)) = ?
    `).get(cleanEmail);

    if (!user) {
      return res.status(404).json({ error: 'User account not found.' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

    // Auto-login: generate JWT token directly upon OTP verification!
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ 
      success: true, 
      message: 'Email verified successfully! Logging you in...',
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });

  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getDB();

    const user = db.prepare('SELECT * FROM users WHERE lower(trim(email)) = ?').get(cleanEmail);
    if (!user) {
      return res.status(404).json({ error: 'No account found with this email.' });
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare('DELETE FROM otps WHERE lower(trim(email)) = ?').run(cleanEmail);
    db.prepare('INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)').run(cleanEmail, otp, expiresAt);

    const isEmailConfigured = Boolean(
      (process.env.GMAIL_RELAY_URL && process.env.GMAIL_RELAY_URL.trim() !== '') ||
      (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim() !== '') ||
      (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== '') ||
      (process.env.SMTP_PASS && process.env.SMTP_PASS.trim() !== '' && process.env.SMTP_PASS !== 'your_email_password_here')
    );

    let emailSent = false;
    let fallbackNotice = null;

    if (isEmailConfigured) {
      try {
        await sendOTPEmail(cleanEmail, otp, user.username);
        emailSent = true;
      } catch (smtpErr) {
        console.warn('⚠️ Resend email error:', smtpErr.message);
        fallbackNotice = 'Email delivery failed or blocked. OTP is displayed below:';
      }
    } else {
      fallbackNotice = 'Email service not configured. OTP is displayed below:';
    }

    res.json({ 
      success: true, 
      message: emailSent ? 'New OTP sent to your email.' : `⚠️ ${fallbackNotice}`,
      devOtp: emailSent ? undefined : otp
    });
  } catch (err) {
    console.error('Resend OTP error:', err);
    res.status(500).json({ error: 'Failed to resend OTP.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE lower(trim(email)) = ?').get(cleanEmail);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Auto-verify if the user has entered the correct password
    if (!user.verified) {
      db.prepare('UPDATE users SET verified = 1 WHERE id = ?').run(user.id);
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

    // Generate JWT (7 days)
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDB();
    const user = db.prepare('SELECT id, username, email, created_at, last_login FROM users WHERE id = ?').get(decoded.id);

    // If SQLite was reset on Render container restart, restore user so foreign keys never fail
    if (!user) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO users (id, username, email, password, verified) 
          VALUES (?, ?, ?, ?, 1)
        `).run(decoded.id, decoded.username || 'user', decoded.email || 'user@example.com', 'ephemeral_restored');
      } catch (e) {}

      return res.json({ 
        user: { 
          id: decoded.id, 
          username: decoded.username || 'Student', 
          email: decoded.email || '' 
        } 
      });
    }

    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
});

module.exports = router;

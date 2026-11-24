const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getDB } = require('../database');
const { sendOTPEmail } = require('../emailService');

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

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: 'Username must be 3-20 characters (letters, numbers, underscore only).' });
    }

    const db = getDB();

    // Check if email or username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ? OR username = ?').get(email, username);
    if (existingUser) {
      const emailExists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (emailExists) {
        return res.status(409).json({ error: 'Email is already registered.' });
      }
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create unverified user (or update if exists unverified)
    const existingUnverified = db.prepare('SELECT id FROM users WHERE email = ? AND verified = 0').get(email);
    if (existingUnverified) {
      db.prepare('UPDATE users SET username = ?, password = ? WHERE email = ? AND verified = 0')
        .run(username, hashedPassword, email);
    } else {
      db.prepare('INSERT INTO users (username, email, password, verified) VALUES (?, ?, ?, 0)')
        .run(username, email, hashedPassword);
    }

    // Generate OTP
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // Delete old OTPs for this email
    db.prepare('DELETE FROM otps WHERE email = ?').run(email);

    // Store OTP
    db.prepare('INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)').run(email, otp, expiresAt);

    // Send OTP email (with fallback if Render Free tier blocks outbound SMTP ports 465/587)
    const isSmtpConfigured = process.env.SMTP_PASS && 
      process.env.SMTP_PASS.trim() !== '' && 
      process.env.SMTP_PASS !== 'your_email_password_here';

    let emailSent = false;
    let fallbackNotice = null;

    if (isSmtpConfigured) {
      try {
        await sendOTPEmail(email, otp, username);
        emailSent = true;
      } catch (smtpErr) {
        console.warn('⚠️ SMTP send error (Render Free blocks outbound SMTP):', smtpErr.message);
        fallbackNotice = 'Render Free tier blocks outbound SMTP ports. OTP is displayed below:';
      }
    } else {
      fallbackNotice = 'SMTP_PASS not set on server. OTP is displayed below:';
    }

    res.json({ 
      success: true, 
      message: emailSent 
        ? 'OTP sent to your email. Please verify to complete registration.'
        : `⚠️ ${fallbackNotice}`,
      email: email,
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

    const db = getDB();

    // Find valid OTP
    const otpRecord = db.prepare(`
      SELECT * FROM otps 
      WHERE email = ? AND otp = ? AND used = 0 AND expires_at > datetime('now')
      ORDER BY created_at DESC LIMIT 1
    `).get(email, otp);

    if (!otpRecord) {
      return res.status(400).json({ error: 'Invalid or expired OTP. Please try again.' });
    }

    // Mark OTP as used
    db.prepare('UPDATE otps SET used = 1 WHERE id = ?').run(otpRecord.id);

    // Verify user
    db.prepare('UPDATE users SET verified = 1 WHERE email = ?').run(email);

    res.json({ success: true, message: 'Email verified successfully! You can now log in.' });

  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Verification failed. Please try again.' });
  }
});

// POST /api/auth/resend-otp
router.post('/resend-otp', async (req, res) => {
  try {
    const { email } = req.body;
    const db = getDB();

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND verified = 0').get(email);
    if (!user) {
      return res.status(404).json({ error: 'No pending verification for this email.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    db.prepare('DELETE FROM otps WHERE email = ?').run(email);
    db.prepare('INSERT INTO otps (email, otp, expires_at) VALUES (?, ?, ?)').run(email, otp, expiresAt);

    const isSmtpConfigured = process.env.SMTP_PASS && 
      process.env.SMTP_PASS.trim() !== '' && 
      process.env.SMTP_PASS !== 'your_email_password_here';

    let emailSent = false;
    let fallbackNotice = null;

    if (isSmtpConfigured) {
      try {
        await sendOTPEmail(email, otp, user.username);
        emailSent = true;
      } catch (smtpErr) {
        console.warn('⚠️ Resend SMTP error (Render Free blocks outbound SMTP):', smtpErr.message);
        fallbackNotice = 'Render Free blocks outbound SMTP ports. OTP is displayed below:';
      }
    } else {
      fallbackNotice = 'SMTP_PASS not set on server. OTP is displayed below:';
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

    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.verified) {
      return res.status(401).json({ error: 'Please verify your email before logging in.', needsVerification: true, email: email });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Update last login
    db.prepare('UPDATE users SET last_login = datetime(\'now\') WHERE id = ?').run(user.id);

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
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
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const db = getDB();
    const user = db.prepare('SELECT id, username, email, created_at, last_login FROM users WHERE id = ?').get(decoded.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
});

module.exports = router;

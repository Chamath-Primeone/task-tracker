const nodemailer = require('nodemailer');

// Universal HTTPS Email Sender (Bypasses Render Free Tier blocked SMTP ports 25, 465, 587)
async function sendViaHttps({ to, cc, subject, html, text, fromName, fromEmail }) {
  // Option 1: Google Apps Script Web App (Gmail HTTPS Relay - 100% Free, sends from your own Gmail)
  if (process.env.GMAIL_RELAY_URL && process.env.GMAIL_RELAY_URL.trim() !== '') {
    const relayUrl = process.env.GMAIL_RELAY_URL.trim();
    const res = await fetch(relayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, cc, subject, html, text })
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success !== false) {
      return true;
    }
    throw new Error(data.error || `Gmail Relay error (${res.status})`);
  }

  // Option 2: Brevo (Sendinblue) REST API (300 free emails/day over HTTPS)
  if (process.env.BREVO_API_KEY && process.env.BREVO_API_KEY.trim() !== '') {
    const sender = {
      name: fromName || process.env.SMTP_FROM_NAME || 'LMS Task Tracker',
      email: fromEmail || process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'no-reply@lms.local'
    };
    const toList = [{ email: to }];
    const ccList = cc ? cc.split(',').map(e => ({ email: e.trim() })).filter(e => e.email) : undefined;

    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'api-key': process.env.BREVO_API_KEY.trim()
      },
      body: JSON.stringify({
        sender,
        to: toList,
        cc: ccList,
        subject,
        htmlContent: html,
        textContent: text
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Brevo API error: ${res.status}`);
    }
    return true;
  }

  // Option 3: Resend REST API (100 free emails/day over HTTPS)
  if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim() !== '') {
    const sender = `${fromName || process.env.SMTP_FROM_NAME || 'LMS Task Tracker'} <${process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev'}>`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: sender,
        to: [to],
        cc: cc ? cc.split(',').map(e => e.trim()).filter(Boolean) : undefined,
        subject,
        html,
        text
      })
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.message || `Resend API error: ${res.status}`);
    }
    return true;
  }

  return false;
}

function createTransporter() {
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');

  const timeoutConfig = {
    connectionTimeout: 5000,
    greetingTimeout: 5000,
    socketTimeout: 5000
  };

  if (process.env.SMTP_HOST === 'smtp.gmail.com' || user.endsWith('@gmail.com')) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: user,
        pass: pass,
      },
      ...timeoutConfig
    });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
    auth: {
      user: user,
      pass: pass,
    },
    tls: {
      rejectUnauthorized: false
    },
    ...timeoutConfig
  });
}

async function sendOTPEmail(toEmail, otp, username) {
  const user = (process.env.SMTP_USER || '').trim();
  const fromName = (process.env.SMTP_FROM_NAME || 'LMS Task Tracker').trim();
  const fromEmail = (process.env.SMTP_FROM_EMAIL || user).trim();

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; background: #0a0f1e; margin: 0; padding: 20px; }
      .container { max-width: 500px; margin: 0 auto; background: #0d1b2a; border: 1px solid #1e3a5f; border-radius: 12px; padding: 40px; }
      .logo { text-align: center; margin-bottom: 30px; }
      .logo h1 { color: #00d4ff; font-size: 28px; margin: 0; }
      .logo p { color: #64748b; margin: 5px 0 0; }
      h2 { color: #e2e8f0; text-align: center; margin-bottom: 10px; }
      p { color: #94a3b8; line-height: 1.6; }
      .otp-box { background: linear-gradient(135deg, #0066cc, #00d4ff); border-radius: 10px; padding: 25px; text-align: center; margin: 25px 0; }
      .otp-code { font-size: 42px; font-weight: bold; color: #ffffff; letter-spacing: 10px; font-family: monospace; }
      .otp-label { color: rgba(255,255,255,0.8); font-size: 13px; margin-top: 8px; }
      .warning { background: #1e3a5f; border-left: 4px solid #f59e0b; padding: 12px 15px; border-radius: 5px; color: #fbbf24; font-size: 13px; }
      .footer { text-align: center; margin-top: 30px; color: #475569; font-size: 12px; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="logo">
        <h1>🎓 LMS Task Tracker</h1>
        <p>Email Verification</p>
      </div>
      <h2>Welcome, ${username}! 👋</h2>
      <p>Thank you for signing up. Please use the OTP below to verify your email address and complete your registration.</p>
      <div class="otp-box">
        <div class="otp-code">${otp}</div>
        <div class="otp-label">One-Time Password (OTP)</div>
      </div>
      <div class="warning">
        ⏱️ This OTP will expire in <strong>10 minutes</strong>. Do not share it with anyone.
      </div>
      <p style="text-align:center; margin-top: 20px; color: #64748b; font-size: 13px;">
        If you did not create an account, please ignore this email.
      </p>
      <div class="footer">
        &copy; 2024 LMS Task Tracker &bull; Automated Email - Do Not Reply
      </div>
    </div>
  </body>
  </html>
  `;

  // 1. Try sending via HTTPS REST APIs (works on Render Free tier without port blocking)
  const sentViaHttps = await sendViaHttps({
    to: toEmail,
    subject: '🔐 Your OTP for LMS Task Tracker Verification',
    html: html,
    text: `Your LMS Task Tracker OTP is: ${otp}. It expires in 10 minutes.`,
    fromName,
    fromEmail
  });

  if (sentViaHttps) return;

  // 2. Fallback to standard SMTP (Nodemailer)
  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: toEmail,
    subject: '🔐 Your OTP for LMS Task Tracker Verification',
    html: html,
  });
}

async function sendTaskEmail({ from, to, cc, subject, body, senderName }) {
  const user = (process.env.SMTP_USER || '').trim();
  const fromName = senderName || process.env.SMTP_FROM_NAME || 'LMS Task Tracker';
  const fromEmail = (process.env.SMTP_FROM_EMAIL || user).trim();

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8">
    <style>
      body { font-family: Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 20px; }
      .container { max-width: 650px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #0a0f1e, #0d1b2a); padding: 25px 30px; }
      .header h1 { color: #00d4ff; margin: 0; font-size: 20px; }
      .header p { color: #94a3b8; margin: 5px 0 0; font-size: 13px; }
      .content { padding: 30px; }
      .meta { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; }
      .meta-row { display: flex; padding: 5px 0; color: #475569; font-size: 14px; }
      .meta-label { font-weight: bold; color: #334155; min-width: 70px; }
      .body-section { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; white-space: pre-wrap; font-family: monospace; color: #1e293b; line-height: 1.6; font-size: 14px; }
      .footer { background: #f1f5f9; padding: 15px 30px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px solid #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🎓 LMS Task Tracker - Daily Task Report</h1>
        <p>Sent via LMS Task Management System</p>
      </div>
      <div class="content">
        <div class="meta">
          <div class="meta-row"><span class="meta-label">From:</span>&nbsp;${senderName} &lt;${from}&gt;</div>
          <div class="meta-row"><span class="meta-label">Subject:</span>&nbsp;${subject}</div>
          ${cc ? `<div class="meta-row"><span class="meta-label">CC:</span>&nbsp;${cc}</div>` : ''}
        </div>
        <div class="body-section">${body}</div>
      </div>
      <div class="footer">
        Sent via LMS Task Tracker &bull; ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Colombo' })} (Sri Lanka Time)
      </div>
    </div>
  </body>
  </html>
  `;

  // 1. Try sending via HTTPS REST APIs (works on Render Free tier)
  const sentViaHttps = await sendViaHttps({
    to,
    cc,
    subject,
    html,
    text: body,
    fromName,
    fromEmail
  });

  if (sentViaHttps) return;

  // 2. Fallback to standard SMTP (Nodemailer)
  const transporter = createTransporter();
  const mailOptions = {
    from: `"${fromName}" <${fromEmail}>`,
    replyTo: from,
    to: to,
    subject: subject,
    html: html,
    text: body,
  };

  if (cc && cc.trim()) {
    mailOptions.cc = cc;
  }

  await transporter.sendMail(mailOptions);
}

module.exports = { sendOTPEmail, sendTaskEmail };

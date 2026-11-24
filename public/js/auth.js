// ============================================
//  AUTH.JS - LMS Task Tracker
//  Bot Verification, Login, Signup, OTP
// ============================================

const API = '';
let pendingEmail = '';
let otpTimer = null;
let captchaAnswer = 0;

// ===== CAPTCHA =====
const captchaOps = [
  (a, b) => ({ q: `${a} + ${b} = ?`, ans: a + b }),
  (a, b) => ({ q: `${a + b} − ${b} = ?`, ans: a }),
  (a, b) => ({ q: `${a} × ${b} = ?`, ans: a * b }),
];

function generateCaptcha() {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 9) + 1;
  const op = captchaOps[Math.floor(Math.random() * captchaOps.length)](a, b);
  captchaAnswer = op.ans;
  document.getElementById('captchaEquation').textContent = op.q;
  document.getElementById('captchaAnswer').value = '';
  document.getElementById('captchaAnswer').focus();
}

function verifyCaptcha() {
  const userAns = parseInt(document.getElementById('captchaAnswer').value);
  const errEl = document.getElementById('captchaError');

  if (isNaN(userAns)) {
    showAlert(errEl, 'error', 'Please enter a number.');
    return;
  }

  if (userAns !== captchaAnswer) {
    showAlert(errEl, 'error', '❌ Wrong answer! Please try again.');
    generateCaptcha();
    document.getElementById('captchaAnswer').focus();
    return;
  }

  hideAlert(errEl);
  showStep('stepLogin');
}

// Allow Enter key on captcha
document.getElementById('captchaAnswer').addEventListener('keydown', e => {
  if (e.key === 'Enter') verifyCaptcha();
});

// ===== LOGIN =====
async function handleLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  if (!email || !password) {
    showAlert(errEl, 'error', 'Please enter your email and password.');
    return;
  }

  setLoading(btn, true);
  hideAlert(errEl);

  try {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      if (data.needsVerification) {
        pendingEmail = data.email || email;
        showAlert(errEl, 'warning', '⚠️ Your email is not verified. Please check your inbox for OTP.');
        // Show OTP step
        setTimeout(() => {
          document.getElementById('otpEmailDisplay').textContent = pendingEmail;
          showStep('stepOTP');
          startOTPTimer();
        }, 1500);
      } else {
        showAlert(errEl, 'error', data.error || 'Login failed.');
      }
      return;
    }

    // Save token and redirect
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    
    showAlert(errEl, 'success', '✅ Login successful! Redirecting...');
    setTimeout(() => { window.location.href = '/home'; }, 1000);

  } catch (err) {
    showAlert(errEl, 'error', 'Network error. Please check your connection.');
  } finally {
    setLoading(btn, false);
  }
}

// Allow Enter on login
document.getElementById('loginPassword').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});
document.getElementById('loginEmail').addEventListener('keydown', e => {
  if (e.key === 'Enter') handleLogin();
});

// ===== SIGNUP =====
async function handleSignup() {
  const username = document.getElementById('signupUsername').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;
  const errEl = document.getElementById('signupError');
  const btn = document.getElementById('signupBtn');

  hideAlert(errEl);

  if (!username || !email || !password) {
    showAlert(errEl, 'error', 'All fields are required.');
    return;
  }

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    showAlert(errEl, 'error', 'Username: 3-20 chars, letters/numbers/underscore only.');
    return;
  }

  if (password.length < 6) {
    showAlert(errEl, 'error', 'Password must be at least 6 characters.');
    return;
  }

  setLoading(btn, true);

  try {
    const res = await fetch(`${API}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(errEl, 'error', data.error || 'Signup failed.');
      return;
    }

    pendingEmail = email;
    document.getElementById('otpEmailDisplay').textContent = email;
    showStep('stepOTP');
    startOTPTimer();

    if (data.devOtp) {
      const otpErr = document.getElementById('otpError');
      showAlert(otpErr, 'warning', `⚠️ SMTP not set on server. Your OTP code is: ${data.devOtp}`);
    }

  } catch (err) {
    showAlert(errEl, 'error', 'Network error. Please try again.');
  } finally {
    setLoading(btn, false);
  }
}

// ===== OTP VERIFICATION =====
async function handleVerifyOTP() {
  const otp = getOTPValue();
  const errEl = document.getElementById('otpError');
  const btn = document.getElementById('otpBtn');

  if (otp.length !== 6) {
    showAlert(errEl, 'error', 'Please enter all 6 digits of the OTP.');
    return;
  }

  setLoading(btn, true);
  hideAlert(errEl);

  try {
    const res = await fetch(`${API}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail, otp })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(errEl, 'error', data.error || 'OTP verification failed.');
      clearOTPInputs();
      return;
    }

    clearInterval(otpTimer);
    showStep('stepSuccess');

  } catch (err) {
    showAlert(errEl, 'error', 'Network error. Please try again.');
  } finally {
    setLoading(btn, false);
  }
}

// ===== RESEND OTP =====
async function handleResendOTP() {
  const errEl = document.getElementById('otpError');
  const resendLink = document.getElementById('resendLink');

  resendLink.style.pointerEvents = 'none';
  resendLink.textContent = 'Sending...';

  try {
    const res = await fetch(`${API}/api/auth/resend-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(errEl, 'error', data.error);
    } else {
      if (data.devOtp) {
        showAlert(errEl, 'warning', `⚠️ SMTP not set on server. Your OTP code is: ${data.devOtp}`);
      } else {
        showAlert(errEl, 'success', '✅ New OTP sent! Check your email.');
      }
      clearOTPInputs();
      clearInterval(otpTimer);
      startOTPTimer();
    }
  } catch (err) {
    showAlert(errEl, 'error', 'Failed to resend OTP.');
  } finally {
    setTimeout(() => {
      resendLink.style.pointerEvents = 'auto';
      resendLink.textContent = 'Resend OTP';
    }, 30000);
  }
}

// ===== OTP INPUT HANDLERS =====
function otpInputHandler(el, prevId, nextId) {
  el.value = el.value.replace(/[^0-9]/g, '');
  
  if (el.value.length === 1) {
    el.classList.add('filled');
    if (nextId) document.getElementById(nextId).focus();
  } else {
    el.classList.remove('filled');
  }

  if (el.value === '' && prevId) {
    // handled by keydown
  }
}

// Add keydown for backspace navigation
['otp1','otp2','otp3','otp4','otp5','otp6'].forEach((id, i) => {
  const el = document.getElementById(id);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && el.value === '' && i > 0) {
      const prevId = `otp${i}`;
      document.getElementById(prevId).focus();
    }
    if (e.key === 'Enter') handleVerifyOTP();
  });

  el.addEventListener('paste', (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    ['otp1','otp2','otp3','otp4','otp5','otp6'].forEach((oid, oi) => {
      const inp = document.getElementById(oid);
      inp.value = pasted[oi] || '';
      if (pasted[oi]) inp.classList.add('filled');
    });
    if (pasted.length === 6) document.getElementById('otp6').focus();
  });
});

function getOTPValue() {
  return ['otp1','otp2','otp3','otp4','otp5','otp6']
    .map(id => document.getElementById(id).value)
    .join('');
}

function clearOTPInputs() {
  ['otp1','otp2','otp3','otp4','otp5','otp6'].forEach(id => {
    const el = document.getElementById(id);
    el.value = '';
    el.classList.remove('filled');
  });
  document.getElementById('otp1').focus();
}

// ===== OTP TIMER =====
function startOTPTimer() {
  let seconds = 10 * 60;
  const countdownEl = document.getElementById('otpCountdown');

  function update() {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    countdownEl.textContent = `${m}:${s}`;

    if (seconds <= 60) {
      countdownEl.style.color = '#ef4444';
    }

    if (seconds <= 0) {
      clearInterval(otpTimer);
      countdownEl.textContent = 'EXPIRED';
      document.getElementById('otpBtn').disabled = true;
      showAlert(document.getElementById('otpError'), 'error', 'OTP has expired. Please request a new one.');
    }
    seconds--;
  }

  update();
  otpTimer = setInterval(update, 1000);
}

// ===== PASSWORD STRENGTH =====
document.getElementById('signupPassword').addEventListener('input', function() {
  const val = this.value;
  const fill = document.getElementById('strengthFill');
  const text = document.getElementById('strengthText');

  let strength = 0;
  if (val.length >= 6) strength++;
  if (val.length >= 10) strength++;
  if (/[A-Z]/.test(val)) strength++;
  if (/[0-9]/.test(val)) strength++;
  if (/[^A-Za-z0-9]/.test(val)) strength++;

  const levels = [
    { pct: '0%', color: '#ef4444', label: '' },
    { pct: '25%', color: '#ef4444', label: 'Weak' },
    { pct: '50%', color: '#f59e0b', label: 'Fair' },
    { pct: '75%', color: '#3b82f6', label: 'Good' },
    { pct: '90%', color: '#10b981', label: 'Strong' },
    { pct: '100%', color: '#00ff88', label: '💪 Very Strong' },
  ];

  const level = levels[Math.min(strength, 5)];
  fill.style.width = level.pct;
  fill.style.background = level.color;
  text.textContent = level.label;
  text.style.color = level.color;
});

// ===== STEP NAVIGATION =====
const stepDotMap = {
  stepCaptcha: 0,
  stepLogin: 1,
  stepSignup: 1,
  stepOTP: 2,
  stepSuccess: 2
};

function showStep(stepId) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(stepId).classList.add('active');

  // Update progress dots
  const dotIdx = stepDotMap[stepId] ?? 0;
  document.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('active', i <= dotIdx);
  });
}

// ===== UTILS =====
function showAlert(el, type, msg) {
  el.textContent = msg;
  el.className = `alert ${type}`;
}

function hideAlert(el) {
  el.className = 'alert hidden';
}

function setLoading(btn, loading) {
  btn.disabled = loading;
  if (loading) {
    btn.classList.add('loading');
    btn.querySelector('span').textContent = 'Please wait';
  } else {
    btn.classList.remove('loading');
  }
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.textContent = '🙈';
  } else {
    input.type = 'password';
    btn.textContent = '👁';
  }
}

// ===== INIT =====
// Check if already logged in
if (localStorage.getItem('token')) {
  window.location.href = '/home';
}

// Generate initial captcha
generateCaptcha();

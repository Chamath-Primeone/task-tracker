// ============================================
//  HOME.JS - LMS Task Tracker
//  Dashboard, Daily Tasks, History
// ============================================

const API = '';
let currentUser = null;
let currentPage = 1;
let ccEmails = [];
let isCCVisible = false;

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    window.location.href = '/';
    return;
  }

  // Load user info
  try {
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Unauthorized');
    const data = await res.json();
    currentUser = data.user;
    setUserUI();
  } catch {
    localStorage.clear();
    window.location.href = '/';
    return;
  }

  // Set date
  updateDateDisplay();
  setInterval(updateDateDisplay, 60000);

  // Load dashboard
  loadDashboard();
  setupEmailForm();
  setupBodyCounter();

  // Set greeting
  setGreeting();
});

function setUserUI() {
  const initials = currentUser.username.slice(0, 2).toUpperCase();
  document.getElementById('userAvatar').textContent = initials;
  document.getElementById('userName').textContent = currentUser.username;
  document.getElementById('userEmail').textContent = currentUser.email;
  document.getElementById('welcomeName').textContent = currentUser.username;
  document.getElementById('formFromEmail').textContent = currentUser.email;
  document.getElementById('formFromAvatar').textContent = initials;
}

function setGreeting() {
  const hour = new Date().getHours();
  let greeting = 'Good day';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';
  else if (hour < 21) greeting = 'Good evening';
  else greeting = 'Good night';
  document.getElementById('timeGreeting').textContent = greeting;
}

function updateDateDisplay() {
  const now = new Date();
  document.getElementById('topbarDate').textContent = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ===== DASHBOARD =====
async function loadDashboard() {
  const token = localStorage.getItem('token');

  try {
    const res = await fetch(`${API}/api/stats/dashboard`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    // Animate stats
    animateCount('valAttendance', data.attendanceDays);
    animateCount('valTasks', data.totalTasks);
    animateCount('valWeek', data.tasksThisWeek);
    animateCount('valMonth', data.tasksThisMonth);

    // Streak
    document.getElementById('streakCount').textContent = data.streak;

    // Today status
    updateTodayStatus(data.taskSentToday);

    // Recent tasks
    renderRecentTasks(data.recentTasks);

    // Update task badge
    document.getElementById('tasksTodayBadge').textContent = 
      data.taskSentToday ? '✅ Sent today' : '⏳ Not sent today';

  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

function animateCount(elId, target) {
  const el = document.getElementById(elId);
  const duration = 800;
  const start = Date.now();
  const startVal = 0;

  function update() {
    const elapsed = Date.now() - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(startVal + (target - startVal) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function updateTodayStatus(sentToday) {
  const icon = document.getElementById('todayIcon');
  const title = document.getElementById('todayTitle');
  const desc = document.getElementById('todayDesc');
  const cta = document.getElementById('todayCTA');

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  if (sentToday) {
    icon.textContent = '✅';
    title.textContent = "Today's task report sent!";
    desc.textContent = `${today} · Great job keeping up!`;
    cta.style.display = 'none';
  } else {
    icon.textContent = '📋';
    title.textContent = "Today's task report not sent yet";
    desc.textContent = `${today} · Don't forget to send your daily task!`;
    cta.style.display = 'block';
  }
}

function renderRecentTasks(tasks) {
  const container = document.getElementById('recentTaskList');

  if (!tasks || tasks.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>No task reports sent yet. <a href="#" onclick="showTab('tasks', document.querySelector('.nav-item:nth-child(2))'))">Send your first task →</a></p>
      </div>`;
    return;
  }

  container.innerHTML = tasks.map(task => `
    <div class="task-item" onclick="viewTask(${task.id})">
      <div class="task-item-icon">📨</div>
      <div class="task-item-body">
        <div class="task-item-subject">${escapeHtml(task.subject)}</div>
        <div class="task-item-to">→ ${escapeHtml(task.to_email)}</div>
        <div class="task-item-summary">${escapeHtml(task.summary || '')}</div>
      </div>
      <div class="task-item-time">${formatDate(task.sent_at)}</div>
    </div>
  `).join('');
}

// ===== HISTORY =====
async function loadHistory(page = 1) {
  const token = localStorage.getItem('token');
  const container = document.getElementById('historyList');

  container.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><span>Loading...</span></div>`;

  try {
    const res = await fetch(`${API}/api/tasks/history?page=${page}&limit=10`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    document.getElementById('historyTotal').textContent = `${data.total} total`;

    if (!data.tasks || data.tasks.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <p>No task history yet.</p>
        </div>`;
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    container.innerHTML = data.tasks.map(task => `
      <div class="task-item" onclick="viewTask(${task.id})">
        <div class="task-item-icon">📨</div>
        <div class="task-item-body">
          <div class="task-item-subject">${escapeHtml(task.subject)}</div>
          <div class="task-item-to">→ ${escapeHtml(task.to_email)}${task.cc_emails ? ` <span style="color:var(--text-muted)">· CC: ${escapeHtml(task.cc_emails)}</span>` : ''}</div>
          <div class="task-item-summary">${escapeHtml(task.summary || '')}</div>
        </div>
        <div class="task-item-time">${formatDate(task.sent_at)}</div>
      </div>
    `).join('');

    // Pagination
    renderPagination(data.page, data.totalPages);

  } catch (err) {
    container.innerHTML = `<div class="empty-state"><p>Failed to load history.</p></div>`;
  }
}

function renderPagination(current, total) {
  const container = document.getElementById('pagination');
  if (total <= 1) { container.innerHTML = ''; return; }

  let html = '';
  for (let i = 1; i <= total; i++) {
    html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="loadHistory(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}

// ===== VIEW TASK DETAIL =====
async function viewTask(id) {
  const token = localStorage.getItem('token');
  const overlay = document.getElementById('modalOverlay');
  const modalBody = document.getElementById('modalBody');
  const modalTitle = document.getElementById('modalTitle');

  overlay.classList.add('open');
  modalBody.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><span>Loading...</span></div>`;

  try {
    const res = await fetch(`${API}/api/tasks/${id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    const task = data.task;

    modalTitle.textContent = `📧 ${task.subject}`;

    modalBody.innerHTML = `
      <div class="modal-field">
        <div class="modal-field-label">To</div>
        <div class="modal-field-value" style="color:var(--neon)">${escapeHtml(task.to_email)}</div>
      </div>
      ${task.cc_emails ? `
      <div class="modal-field">
        <div class="modal-field-label">CC</div>
        <div class="modal-field-value">${escapeHtml(task.cc_emails)}</div>
      </div>` : ''}
      <div class="modal-field">
        <div class="modal-field-label">Subject</div>
        <div class="modal-field-value">${escapeHtml(task.subject)}</div>
      </div>
      <div class="modal-field">
        <div class="modal-field-label">Sent At</div>
        <div class="modal-field-value" style="font-family:'JetBrains Mono',monospace;font-size:13px;color:var(--text-secondary)">${formatDate(task.sent_at, true)}</div>
      </div>
      <div class="modal-field">
        <div class="modal-field-label">Message Body</div>
        <div class="modal-body-text">${escapeHtml(task.body)}</div>
      </div>
    `;
  } catch {
    modalBody.innerHTML = `<p style="color:var(--neon-red)">Failed to load task details.</p>`;
  }
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
}

// ===== EMAIL FORM =====
function setupEmailForm() {
  // Auto-fill today's date in subject
  const today = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric'
  });
  document.getElementById('emailSubject').value = `Daily Task Report - ${today}`;

  // CC input handler
  const ccInput = document.getElementById('ccInput');
  ccInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addCCEmail(ccInput.value.trim().replace(/,$/, ''));
    } else if (e.key === 'Backspace' && ccInput.value === '' && ccEmails.length > 0) {
      removeCCEmail(ccEmails.length - 1);
    }
  });

  // Hide CC by default
  document.getElementById('ccContainer').style.display = 'none';
}

function toggleCC() {
  isCCVisible = !isCCVisible;
  const ccContainer = document.getElementById('ccContainer');
  const ccToggle = document.getElementById('ccToggle');
  ccContainer.style.display = isCCVisible ? 'flex' : 'none';
  ccToggle.textContent = isCCVisible ? '× CC' : '+ CC';
  if (isCCVisible) document.getElementById('ccInput').focus();
}

function addCCEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return;
  if (!emailRegex.test(email)) {
    showToast('Invalid email: ' + email, 'error');
    return;
  }
  if (ccEmails.includes(email)) {
    showToast('Email already added', 'warning');
    return;
  }
  ccEmails.push(email);
  renderCCTags();
  document.getElementById('ccInput').value = '';
}

function removeCCEmail(idx) {
  ccEmails.splice(idx, 1);
  renderCCTags();
}

function renderCCTags() {
  const container = document.getElementById('ccTags');
  container.innerHTML = ccEmails.map((email, i) => `
    <div class="cc-tag">
      <span>${escapeHtml(email)}</span>
      <button onclick="removeCCEmail(${i})" title="Remove">×</button>
    </div>
  `).join('');
}

function setupBodyCounter() {
  const textarea = document.getElementById('emailBody');
  textarea.addEventListener('input', () => {
    const text = textarea.value;
    document.getElementById('charCount').textContent = `${text.length} characters`;
    document.getElementById('wordCount').textContent = `${text.trim() ? text.trim().split(/\s+/).length : 0} words`;
  });
}

function insertTemplate() {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const username = currentUser ? currentUser.username : 'Student';
  
  const template = `Dear Teacher,

I hope this email finds you well. Please find below my daily task report.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Date: ${today}
👤 Student: ${username}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TASKS COMPLETED TODAY:
1. 
2. 
3. 

🔄 TASKS IN PROGRESS:
1. 

⚠️ CHALLENGES / BLOCKERS:
- 

📌 NOTES & OBSERVATIONS:
- 

🗓️ TOMORROW'S PLAN:
1. 
2. 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you for your guidance and support.

Best regards,
${username}`;

  document.getElementById('emailBody').value = template;
  // Update counters
  document.getElementById('emailBody').dispatchEvent(new Event('input'));
}

function clearBody() {
  if (confirm('Clear the email body?')) {
    document.getElementById('emailBody').value = '';
    document.getElementById('emailBody').dispatchEvent(new Event('input'));
  }
}

function clearForm() {
  if (confirm('Clear all form fields?')) {
    document.getElementById('toEmail').value = '';
    ccEmails = [];
    renderCCTags();
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
    document.getElementById('emailSubject').value = `Daily Task Report - ${today}`;
    document.getElementById('emailBody').value = '';
    document.getElementById('emailBody').dispatchEvent(new Event('input'));
    hideAlert(document.getElementById('sendAlert'));
  }
}

// ===== SEND TASK =====
async function handleSendTask() {
  const token = localStorage.getItem('token');
  const toEmail = document.getElementById('toEmail').value.trim();
  const subject = document.getElementById('emailSubject').value.trim();
  const body = document.getElementById('emailBody').value.trim();
  const alertEl = document.getElementById('sendAlert');
  const sendBtn = document.getElementById('sendBtn');

  hideAlert(alertEl);

  if (!toEmail) { showAlert(alertEl, 'error', 'Please enter recipient email (To).'); return; }
  if (!subject) { showAlert(alertEl, 'error', 'Please enter a subject.'); return; }
  if (!body) { showAlert(alertEl, 'error', 'Please write your daily task log.'); return; }

  // Finalize any CC input
  const ccInputVal = document.getElementById('ccInput').value.trim();
  if (ccInputVal) addCCEmail(ccInputVal.replace(/,$/, ''));

  const cc = ccEmails.join(', ');

  sendBtn.disabled = true;
  sendBtn.querySelector('span').textContent = '📡 Sending...';

  try {
    const res = await fetch(`${API}/api/tasks/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ to: toEmail, cc, subject, body })
    });

    const data = await res.json();

    if (!res.ok) {
      showAlert(alertEl, 'error', data.error || 'Failed to send email.');
      return;
    }

    showAlert(alertEl, 'success', '✅ Task report sent successfully! Check your email for confirmation.');
    showToast('📧 Task email sent!', 'success');

    // Update today status and reload stats
    loadDashboard();

  } catch (err) {
    showAlert(alertEl, 'error', 'Network error. Please try again.');
  } finally {
    sendBtn.disabled = false;
    sendBtn.querySelector('span').textContent = '📤 Send Task Report';
  }
}

// ===== TAB NAVIGATION =====
function showTab(tabName, navEl) {
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show selected
  document.getElementById('tab' + capitalize(tabName)).classList.add('active');
  if (navEl) navEl.classList.add('active');

  // Update page title
  const titles = { home: 'Dashboard', tasks: 'Daily Tasks', history: 'Task History' };
  document.getElementById('pageTitle').textContent = titles[tabName] || tabName;

  // Load data for history tab
  if (tabName === 'history') loadHistory(1);

  // Close mobile sidebar
  document.getElementById('sidebar').classList.remove('mobile-open');
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

// ===== SIDEBAR TOGGLE =====
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('mobile-open');
  }
}

// ===== LOGOUT =====
function handleLogout() {
  if (confirm('Are you sure you want to sign out?')) {
    localStorage.clear();
    window.location.href = '/';
  }
}

// ===== UTILS =====
function showAlert(el, type, msg) {
  el.textContent = msg;
  el.className = `alert ${type}`;
}

function hideAlert(el) {
  el.className = 'alert hidden';
}

let toastTimer;
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  const colors = { 
    success: 'rgba(0,255,136,0.1)', 
    error: 'rgba(239,68,68,0.1)', 
    warning: 'rgba(245,158,11,0.1)',
    info: 'rgba(0,212,255,0.1)'
  };
  toast.style.background = colors[type] || colors.info;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function formatDate(dateStr, full = false) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (full) {
    return date.toLocaleString('en-US', { 
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }
  const now = new Date();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ============================================
//  HOME.JS - LMS Task Tracker
//  Dashboard, Daily Tasks, History
// ============================================

// ============================================
//  TEACHER CONFIGURATION (Easy to edit names & emails)
// ============================================
const TEACHERS_CONFIG = [
  { id: 'teacher1', name: 'Teacher 1 Name', email: 'teacher1@example.com' },
  { id: 'teacher2', name: 'Teacher 2 Name', email: 'teacher2@example.com' },
  { id: 'teacher3', name: 'Teacher 3 Name', email: 'teacher3@example.com' },
];

const API = '';
let currentUser = null;
let currentPage = 1;
let selectedTeacherIds = ['teacher1', 'teacher2', 'teacher3']; // Default: all 3 selected

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

  // Load dashboard & setup task form
  loadDashboard();
  setupTaskFormDefaults();

  // Set greeting
  setGreeting();
});

function setUserUI() {
  const initials = currentUser.username.slice(0, 2).toUpperCase();
  if (document.getElementById('userAvatar')) document.getElementById('userAvatar').textContent = initials;
  if (document.getElementById('userName')) document.getElementById('userName').textContent = currentUser.username;
  if (document.getElementById('userEmail')) document.getElementById('userEmail').textContent = currentUser.email;
  if (document.getElementById('welcomeName')) document.getElementById('welcomeName').textContent = currentUser.username;
  if (document.getElementById('studentName') && !document.getElementById('studentName').value) {
    document.getElementById('studentName').value = currentUser.username;
    updateLivePreview();
  }
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

// ===== TASK FORM & TEACHER SELECTION =====
function setupTaskFormDefaults() {
  // 1. Date picker (today's date in YYYY-MM-DD)
  const dateInput = document.getElementById('taskDate');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }

  // 2. Student name
  const studentNameInput = document.getElementById('studentName');
  if (studentNameInput && currentUser && !studentNameInput.value) {
    studentNameInput.value = currentUser.username;
  }

  // 3. Student ID (from localStorage or default)
  const studentIdInput = document.getElementById('studentId');
  if (studentIdInput && !studentIdInput.value) {
    studentIdInput.value = localStorage.getItem('student_id') || 'ST-2024-001';
  }

  renderTeacherCheckboxes();
  updateLivePreview();
  updateCounters();
}

function saveStudentId() {
  const input = document.getElementById('studentId');
  if (input) {
    const val = input.value.trim();
    if (val) localStorage.setItem('student_id', val);
  }
}

function renderTeacherCheckboxes() {
  const container = document.getElementById('teachersContainer');
  if (!container) return;

  container.innerHTML = TEACHERS_CONFIG.map((teacher) => {
    const isChecked = selectedTeacherIds.includes(teacher.id);
    let roleClass = 'none';
    let roleText = '';

    if (isChecked) {
      const selectedIndex = selectedTeacherIds.indexOf(teacher.id);
      if (selectedIndex === 0) {
        roleClass = 'to';
        roleText = 'To (Primary)';
      } else {
        roleClass = 'cc';
        roleText = `CC #${selectedIndex}`;
      }
    }

    return `
      <div class="teacher-card ${isChecked ? 'selected' : ''}" onclick="toggleTeacherSelect('${teacher.id}')">
        <input type="checkbox" class="teacher-checkbox" id="chk_${teacher.id}" 
               ${isChecked ? 'checked' : ''} 
               onclick="event.stopPropagation(); toggleTeacherSelect('${teacher.id}')">
        <div class="teacher-info">
          <div class="teacher-name-row">
            <span class="teacher-name">${escapeHtml(teacher.name)}</span>
            <span class="role-badge ${roleClass}">${roleText}</span>
          </div>
          <div class="teacher-email">${escapeHtml(teacher.email)}</div>
        </div>
      </div>
    `;
  }).join('');

  updateRecipientPreview();
  updateLivePreview();
}

function toggleTeacherSelect(teacherId) {
  const index = selectedTeacherIds.indexOf(teacherId);
  if (index > -1) {
    if (selectedTeacherIds.length === 1) {
      showToast('⚠️ At least 1 teacher must be selected!', 'warning');
      return;
    }
    selectedTeacherIds.splice(index, 1);
  } else {
    selectedTeacherIds.push(teacherId);
  }
  renderTeacherCheckboxes();
}

function getSelectedRecipients() {
  const selectedTeachers = selectedTeacherIds
    .map(id => TEACHERS_CONFIG.find(t => t.id === id))
    .filter(Boolean);

  if (selectedTeachers.length === 0) {
    return { to: '', cc: '', toTeacher: null, ccTeachers: [] };
  }

  const toTeacher = selectedTeachers[0];
  const ccTeachers = selectedTeachers.slice(1);

  return {
    to: toTeacher.email,
    cc: ccTeachers.map(t => t.email).join(', '),
    toTeacher,
    ccTeachers
  };
}

function updateRecipientPreview() {
  const { toTeacher, ccTeachers } = getSelectedRecipients();
  const previewTo = document.getElementById('previewTo');
  const previewCC = document.getElementById('previewCC');

  if (previewTo) {
    previewTo.textContent = toTeacher ? `${toTeacher.name} <${toTeacher.email}>` : 'None (Please select at least 1)';
    previewTo.style.color = toTeacher ? '#00ff88' : '#ff4757';
  }

  if (previewCC) {
    if (ccTeachers.length > 0) {
      previewCC.textContent = ccTeachers.map(t => `${t.name} <${t.email}>`).join(', ');
      previewCC.style.color = 'var(--neon)';
    } else {
      previewCC.textContent = 'None';
      previewCC.style.color = 'var(--text-muted)';
    }
  }
}

function insertBullet(textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  const bullet = '• ';
  const needsNewline = start > 0 && val[start - 1] !== '\n';
  const prefix = needsNewline ? '\n' + bullet : bullet;
  
  textarea.value = val.substring(0, start) + prefix + val.substring(end);
  textarea.focus();
  textarea.selectionStart = textarea.selectionEnd = start + prefix.length;
  updateCounters();
  updateLivePreview();
}

function updateCounters() {
  const textarea = document.getElementById('tasksCompleted');
  const text = textarea ? textarea.value : '';
  const charEl = document.getElementById('completedCharCount');
  const wordEl = document.getElementById('completedWordCount');
  if (charEl) charEl.textContent = `${text.length} characters`;
  if (wordEl) wordEl.textContent = `${text.trim() ? text.trim().split(/\s+/).length : 0} words`;
}

function generateEmailPayload() {
  const { to, cc, toTeacher } = getSelectedRecipients();
  const dateInput = document.getElementById('taskDate');
  const date = dateInput && dateInput.value ? dateInput.value : new Date().toISOString().split('T')[0];
  const studentName = (document.getElementById('studentName') && document.getElementById('studentName').value.trim()) || (currentUser ? currentUser.username : 'Student');
  const studentId = (document.getElementById('studentId') && document.getElementById('studentId').value.trim()) || 'N/A';
  const tasksCompleted = document.getElementById('tasksCompleted') ? document.getElementById('tasksCompleted').value.trim() : '';
  const notes = document.getElementById('taskNotes') ? document.getElementById('taskNotes').value.trim() : '';

  // Subject format: Daily Task Log - {Student Name} ({Student ID}) - {Date}
  const subject = `Daily Task Log - ${studentName} (${studentId}) - ${date}`;

  // Body format: A neat, professional plain-text email template
  let body = `Dear Teachers,\n\n`;
  body += `Please find my daily task log for ${date} below.\n\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  body += `📅 Date: ${date}\n`;
  body += `👤 Student: ${studentName}\n`;
  body += `🆔 Student ID: ${studentId}\n`;
  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  body += `✅ TASKS COMPLETED TODAY:\n`;
  body += `${tasksCompleted || '(No tasks specified)'}\n\n`;

  // Only include in the email body if notes is not empty
  if (notes) {
    body += `⚠️ NOTES / BLOCKERS:\n`;
    body += `${notes}\n\n`;
  }

  body += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  body += `Thank you for your guidance and support.\n\n`;
  body += `Best regards,\n`;
  body += `${studentName}\n`;
  body += `Student ID: ${studentId}\n`;

  return { to, cc, subject, body, studentName, studentId, tasksCompleted, notes, date };
}

function updateLivePreview() {
  const { subject } = generateEmailPayload();
  const preview = document.getElementById('subjectPreview');
  if (preview) preview.textContent = subject;
}

// ===== GMAIL COMPOSE LINK INTEGRATION =====
async function handleSendGmail() {
  const alertEl = document.getElementById('sendAlert');
  hideAlert(alertEl);

  const { to, cc, subject, body, tasksCompleted } = generateEmailPayload();

  // Validation 1: At least 1 teacher selected
  if (!to) {
    showAlert(alertEl, 'error', '❌ Please select at least one teacher.');
    return;
  }

  // Validation 2: Tasks completed is required
  if (!tasksCompleted) {
    showAlert(alertEl, 'error', '❌ Please enter your "Tasks Completed Today" before sending.');
    const el = document.getElementById('tasksCompleted');
    if (el) el.focus();
    return;
  }

  // Build properly encoded Gmail Compose URL
  // Format: https://mail.google.com/mail/?view=cm&fs=1&to={to}&cc={cc}&su={subject}&body={body}
  const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&cc=${encodeURIComponent(cc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  // Open Gmail in a new tab
  window.open(gmailUrl, '_blank');

  // Background log into database for stats & history
  await logTaskToBackend({ to, cc, subject, body });

  showAlert(alertEl, 'success', '🚀 Gmail Compose opened in a new tab! Task record has been logged in your dashboard.');
  showToast('✉️ Gmail opened in new tab!', 'success');
}

// ===== COPY EMAIL TEXT =====
function handleCopyEmailText() {
  const alertEl = document.getElementById('sendAlert');
  hideAlert(alertEl);

  const { body, tasksCompleted } = generateEmailPayload();

  if (!tasksCompleted) {
    showAlert(alertEl, 'error', '❌ Please enter "Tasks Completed Today" before copying.');
    const el = document.getElementById('tasksCompleted');
    if (el) el.focus();
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(body).then(() => {
      showAlert(alertEl, 'success', '📋 Email text successfully copied to clipboard!');
      showToast('📋 Copied to clipboard!', 'success');
    }).catch(() => {
      fallbackCopyText(body, alertEl);
    });
  } else {
    fallbackCopyText(body, alertEl);
  }
}

function fallbackCopyText(text, alertEl) {
  const dummy = document.createElement('textarea');
  dummy.value = text;
  dummy.setAttribute('readonly', '');
  dummy.style.position = 'absolute';
  dummy.style.left = '-9999px';
  document.body.appendChild(dummy);
  dummy.select();
  try {
    document.execCommand('copy');
    showAlert(alertEl, 'success', '📋 Email text successfully copied to clipboard!');
    showToast('📋 Copied to clipboard!', 'success');
  } catch {
    showAlert(alertEl, 'error', 'Failed to copy to clipboard.');
  }
  document.body.removeChild(dummy);
}

async function logTaskToBackend({ to, cc, subject, body }) {
  try {
    const token = localStorage.getItem('token');
    await fetch(`${API}/api/tasks/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ to, cc, subject, body })
    });
    // Reload dashboard stats
    loadDashboard();
  } catch (err) {
    console.warn('Task logging warning:', err);
  }
}

function clearTaskForm() {
  if (confirm('Clear the task form fields?')) {
    if (document.getElementById('tasksCompleted')) document.getElementById('tasksCompleted').value = '';
    if (document.getElementById('taskNotes')) document.getElementById('taskNotes').value = '';
    selectedTeacherIds = ['teacher1', 'teacher2', 'teacher3'];
    renderTeacherCheckboxes();
    updateCounters();
    updateLivePreview();
    hideAlert(document.getElementById('sendAlert'));
    showToast('Form cleared', 'info');
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

# 🎓 LMS Task Tracker & Email Reporting System

A full-stack LMS Task Management application built with **Node.js**, **Express**, **SQLite**, and **Vanilla JavaScript**. It features bot verification, two-factor email OTP authentication, automated daily attendance tracking, daily task submission via SMTP email, and an interactive dashboard.

---

## 🌟 Key Features

- **🤖 Bot Verification (Math CAPTCHA):** Dynamic arithmetic verification before sign in/sign up.
- **🔐 2-Factor Authentication (OTP):** User signup with email verification via a 6-digit expiring OTP sent through SMTP.
- **🛡️ Secure Auth & Session Handling:** Passwords encrypted using `bcryptjs` and session authentication powered by `jsonwebtoken` (JWT).
- **📅 Automated Attendance & Streak Tracking:** Automatically registers daily attendance upon sign-in and tracks consecutive day streaks.
- **📊 Interactive Dashboard:**
  - Days present counter
  - Total tasks submitted
  - Weekly & Monthly task statistics
  - Recent task logs overview
- **📧 Daily Task Email Submission:**
  - Send structured daily task logs to instructors/supervisors.
  - Multi-recipient CC tag input.
  - Auto-generated templates and live character/word counters.
  - SMTP email dispatch with responsive HTML email templates.
- **📋 Task History & Archive:** Paginated history list with full task preview modal.
- **🌙 Modern Dark Theme UI:** Styled with a Deep Blue & Neon Cyan aesthetic, fully responsive across desktop and mobile devices.

---

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js, SQLite (`better-sqlite3`), Nodemailer
- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Security:** bcryptjs, jsonwebtoken, express-rate-limit

---

## 🚀 Getting Started

### 1. Clone the repository
```bash
git clone <your-repository-url>
cd "Task Form"
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root directory based on `.env.example`:
```env
PORT=3000
JWT_SECRET=your_jwt_secret_key

SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@domain.com
SMTP_PASS=your_email_password
SMTP_FROM_NAME=LMS Task Tracker
SMTP_FROM_EMAIL=your_email@domain.com
```

### 4. Run the server
**Using Double-Click:**
Double click `START.bat`

**Or via Terminal:**
```bash
npm start
```

Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📜 License
ISC License

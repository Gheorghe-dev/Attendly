# 📘 User Guide — Attendly

**Attendly** is an open-source academic attendance app that can run on an instructor's computer or a self-managed server. Local installs store course and attendance records in SQLite. Optional Cloudflare tunneling and IP-based location lookup use external services; review institutional privacy requirements before using real student data.

---

## 📑 Table of Contents
1. [Starting and Stopping the Application](#1-starting-and-stopping-the-application)
2. [Initial Setup and Authentication](#2-initial-setup-and-authentication)
3. [Course Management & Student Roster Import](#3-course-management--student-roster-import)
4. [Launching an Attendance Session](#4-launching-an-attendance-session)
5. [Student Check-in Workflow (Mobile Experience)](#5-student-check-in-workflow-mobile-experience)
6. [Live Monitor & Closing Sessions](#6-live-monitor--closing-sessions)
7. [Reports & Official Excel Export](#7-reports--official-excel-export)
8. [Attendance Integrity Checks and Limitations](#8-attendance-integrity-checks-and-limitations)
9. [Troubleshooting & FAQ](#9-troubleshooting--faq)

---

## 1. Starting and Stopping the Application

Attendly can be run either as an installed native desktop application (powered by Electron.js) or as a local web service.

### 📦 1-Click Desktop Installer (Recommended)
Attendly is packaged as a standalone 1-click desktop app:
- **Windows**: Download and run the latest `.exe` installer from [GitHub Releases](https://github.com/Gheorghe-dev/Attendly/releases/latest).
  - Installs in one click without wizard dialogs.
  - Automatically places a desktop shortcut and starts the application.
- **macOS**: Double-click **`Install-Attendly-Mac.command`** in Finder (or download the DMG/PKG release).
  - Installs Attendly directly into `/Applications` and launches it with 1 click.

### Method 2: Native Desktop Launchers from Source (Electron.js)
If running from the source folder without running the installer:
- **1-Click Desktop Shortcut:** Double-click the **`Attendly`** shortcut on your Windows Desktop.
- **Silent Launcher:** Double-click **`Launch-Attendly.vbs`** in this folder (launches cleanly without any console window).
- **Direct Batch Launcher:** Double-click **`Attendly.bat`** in this folder.
- **Terminal Command:**
  ```bash
  npm run desktop
  ```
*When launched, Attendly displays a branded splash screen, starts the local engine and a Cloudflare tunnel, and opens a dedicated desktop window. The tunnel makes the app reachable over the public internet while active.*

### Method 3: Browser / Local Web Mode
- Double-click **`Open-Attendly-Browser.bat`** or **`start.bat`**:
  - Automatically ensures the server is running and opens **[http://localhost:3000](http://localhost:3000)** directly in your default web browser (Chrome, Edge, Firefox, etc.).
- Or run in terminal:
  ```bash
  npm start
  ```
  and navigate to: **[http://localhost:3000](http://localhost:3000)**.

### Mode 3: Unix / macOS / Linux All-In-One Launcher
- Make the script executable and run:
  ```bash
  chmod +x start.sh stop.sh
  ./start.sh
  ```
- To stop the server and tunnels at any time:
  ```bash
  ./stop.sh
  ```

### Mode 4: Docker & Docker Compose (Any Operating System)
Deploy Attendly in a clean, self-contained container without installing Node.js locally:
```bash
docker compose up -d
```
Access Attendly at **`http://localhost:3000`**. Data is persisted in the `attendly-data` volume.

Create a root `.env` file containing a unique `NEXTAUTH_SECRET` before starting Docker Compose. Compose deliberately refuses to start without it. Docker does not create a public tunnel; to use QR check-ins from phones on the same LAN, also set `APP_URL` and `NEXTAUTH_URL` in `.env` to the server's LAN address (for example, `http://192.168.1.50:3000`) and restart the container. Use a properly secured HTTPS deployment for access outside the LAN.

### Mode 5: Lecture Hall Mode with Worldwide Mobile Tunnel
For students to scan the QR code from their mobile phones across 4G/5G mobile data or any university Wi-Fi:
- Run:
  ```bash
  node scripts/start-internet.js
  ```
- *(Note: If you run the Electron Desktop App, this tunnel is started for you automatically!)*

### Stopping the Application
- Run **`stop.bat`** or press `Ctrl + C` in the command window.

---

## 2. Initial Setup and Authentication

On first launch:
1. Navigate to **[http://localhost:3000](http://localhost:3000)** in any modern browser (Chrome, Edge, Safari, Firefox).
2. If no instructor account exists, you are automatically directed to `/setup`:
   - Enter your **Full Name** (e.g., *Prof. Dr. Alex Johnson*).
   - Enter your **Institutional Email** and a **Secure Password** (min. 8 characters).
   - Save the account.
3. For subsequent visits, sign in at `/login`.

> [!NOTE]
> All passwords are cryptographically hashed using **bcrypt** (cost factor 12). Sessions use secure JWT authentication.

---

## 3. Course Management & Student Roster Import

### Step 1: Create a Course
1. On the **Dashboard**, click **"New Course"** (`+ New Course`).
2. Fill in course details:
   - **Course Name / Title**: (e.g., *Distributed Systems (CS 301)*)
   - **Description / Notes**: (optional, e.g., *Year 3, Semester 2*)
3. Click **"Create Course"**.

### Step 2: Import Student Roster from Excel (`.xlsx`)
Attendly includes a resilient parser:
1. Open the course page and select the **Enrolled Students** tab.
2. Click **"Import Excel"**. You can click **"Download Template"** to get a sample `.xlsx` sheet.
3. The expected sheet layout uses 3 columns:
   - **Column 1 (Name)**: `Student Name`, `Name`, `Full Name`
   - **Column 2 (Email)**: `University Email`, `Email`, `Institutional Email`
   - **Column 3 (Group)**: `Group`, `Subgroup`, `Academic Group` (e.g., `CS 3.1A`, `CS 3.2B`)
4. Drag and drop the Excel file or click to browse.
5. Review the validation summary (valid rows, invalid formats, duplicates).
6. Click **"Confirm and Import"** to commit records to the database.

---

## 4. Launching an Attendance Session

When class begins:
1. From the course page, click **"New Session"** or **"Launch Session"**.
2. **Session Details**:
   - Set the lecture title (e.g., *Lecture 1: Introduction*).
   - Select or type the **Classroom / Lecture Hall** (e.g., *Room 101*, *Auditorium A1*, *Lab 204*).
   - The preview updates live with the room's predefined link (e.g., `/attend/room-101`), allowing permanent room QR posters to work seamlessly.
   - Verify scheduled date and time.
3. **Target Groups**:
   - Select specific lab/seminar groups or leave all selected for a general lecture.
   - *Students from unassigned groups will be blocked if they attempt to check in.*
4. Click **"Create Session"**.

---

## 5. Student Check-in Workflow (Mobile Experience)

1. The instructor projects the QR code on the lecture hall screen.
2. The student opens their phone camera or QR scanner.
3. They tap the link to open the check-in page.
4. **Step 1 — Email**: The student enters their institutional university email address.
5. **Step 2 — Instant Verification**:
   - The server validates the email is in the official course roster.
   - The server checks that the student belongs to the scheduled group.
   - The server may use browser/device identifiers to flag repeated check-ins; this does not verify a student's identity.
6. **Step 3 — Success Screen**: A confirmation screen displays student name, group, scan timestamp, and verified status checkmark.

---

## 6. Live Monitor & Closing Sessions

1. On the instructor's laptop, the **Live Session Monitor** updates instantaneously via Server-Sent Events (SSE).
2. As students check in:
   - Their name lights up on the roster table with an audio/visual cue.
   - The large counter increments live (e.g., `42 / 50 confirmed`).
   - The progress ring calculates real-time attendance percentage.
3. **Full-Screen Projection Mode**:
   - Click **"Present Full Screen"** or click full-screen for a distraction-free display for projectors.
   - Press `Esc` at any time to return.
4. **Closing the Session**:
   - Click **"Close Check-in"** once lecture starts. Any subsequent scans will be rejected.
   - You can reopen the session at any time with **"Reopen Session"**.

---

## 7. Reports & Official Excel Export

1. **Per-Session Export**:
   - Click **"Export Excel"** on any session to download a formatted `.xlsx` sheet.
   - Rows are color-coded: present students in soft green, absent students in soft red.
   - Includes verified registration timestamps.
2. **Full Course Export**:
   - On the course page under **Reports & Analytics**, click **"Download Full Course Excel"**.
   - Generates a multi-session sheet suitable for faculty submission.

---

## 8. Attendance Integrity Checks and Limitations

Attendly applies checks that can help instructors review attendance, but they cannot guarantee the identity or physical location of the person checking in:

1. **Duplicate-device signals**: Browser/device identifiers can flag some repeated check-ins. Identifiers can be cleared, changed, or spoofed.
2. **Approximate location**: Browser geolocation may be available; IP-based estimates can be inaccurate and may use an external location service. Treat distance as an indicator only.
3. **Roster and group checks**: The app checks that the submitted email belongs to the course roster and a group allowed for that session.
4. **Session status and logs**: Closed sessions reject check-ins; the app records some rejected attempts with a reason.

---

## 9. Troubleshooting & FAQ

- **Student phone cannot scan the QR from the back row?**
   - Click the **"Copy student direct URL"** copy button and share the short URL or write it on the whiteboard.
- **Student is not found in the roster?**
   - Verify that the student entered the exact institutional email registered in the course roster.
   - An instructor can also manually add a student via **"Add Student"** in the course roster tab.

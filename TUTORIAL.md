# 📖 Attendly — Complete New Computer Tutorial & Guide

Welcome to **Attendly**! This tutorial will walk you step-by-step through setting up, configuring, and using Attendly on any brand-new computer (Windows, macOS, Linux, or Docker).

Whether you are a professor, teaching assistant, or IT administrator, this guide assumes **zero prior technical knowledge**.

---

## 📑 Table of Contents

1. [What is Attendly?](#1-what-is-attendly)
2. [Moving Attendly to a New Computer](#2-moving-attendly-to-a-new-computer)
3. [Prerequisites (What you need)](#3-prerequisites-what-you-need)
4. [First-Time Launch (One-Click Setup)](#4-first-time-launch-one-click-setup)
5. [Creating Your Instructor Account](#5-creating-your-instructor-account)
6. [Creating Your First Course](#6-creating-your-first-course)
7. [Importing Your Student Roster from Excel](#7-importing-your-student-roster-from-excel)
8. [Launching an Attendance Session](#8-launching-an-attendance-session)
9. [Predefined Classroom URLs & Posters](#9-predefined-classroom-urls--posters)
10. [Student Experience (What Students Do)](#10-student-experience-what-students-do)
11. [Attendance Integrity Checks and Limitations](#11-attendance-integrity-checks-and-limitations)
12. [Live Monitoring & Closing the Session](#12-live-monitoring--closing-the-session)
13. [Exporting Official Excel Attendance Reports](#13-exporting-official-excel-attendance-reports)
14. [Backing Up & Transferring Data to Another PC](#14-backing-up--transferring-data-to-another-pc)
15. [Troubleshooting & Common Questions](#15-troubleshooting--common-questions)

---

## 1. What is Attendly?

Attendly is a self-hostable academic attendance tracking app. Instead of passing around paper sign-in sheets:
- You project a dynamic QR code on the lecture hall projector or classroom monitor.
- Students scan the QR code with their mobile phone camera and enter their university email.
- The app checks the roster, group, and session status, and can flag repeated device identifiers and record approximate location information.
- With a local installation, course and attendance records are stored in SQLite (`prisma/dev.db`). Optional Cloudflare tunneling and IP-location lookups use third-party services. Do not use real student data until your institution has approved your hosting and privacy setup.

---

## 2. Moving Attendly to a New Computer

You can install Attendly on a new computer or migrate an existing installation:

### Method A: USB Flash Drive / Copy-Paste (Easiest)
1. Install Node.js on the new computer.
2. Copy the project folder, but do not copy `node_modules` or build output.
3. If you want your existing data, stop Attendly first and copy `prisma/dev.db` into the same path in the new project.
4. Create a new `.env` on the new computer with a fresh `NEXTAUTH_SECRET` (see setup below).
5. Run `npm install`, `npx prisma generate`, and `npx prisma db push`.

Keep a separate backup of the database. Do not replace a newer database without first backing it up.

### Method B: Download as a ZIP from GitHub
1. On your new computer, go to [the Attendly GitHub repository](https://github.com/Gheorghe-dev/Attendly).
2. Click the green **Code** button and select **Download ZIP**.
3. Extract the ZIP file into a folder on your computer.

### Method C: Clone with Git
Open your terminal (PowerShell, Command Prompt, or Terminal) and run:
```bash
git clone https://github.com/Gheorghe-dev/Attendly.git
cd Attendly
```

---

## 3. Prerequisites (What you need)

Attendly only requires **one software prerequisite**:

- **[Node.js](https://nodejs.org/)**: Install Node.js 24 LTS from the official website:
  👉 **https://nodejs.org/**
- Run the downloaded installer and accept the standard defaults.

> [!TIP]
> If your new computer has **Docker Desktop** (Windows/macOS) or Docker Engine with the Compose plugin (Linux), you don't need Node.js on the host; skip to the Docker section in Chapter 4.

The server can run on Windows, macOS, or Linux. Phones and tablets can use Attendly in their browser after connecting to a running server; they do not install this GitHub repository as a native mobile app.

---

## 4. First-Time Launch (One-Click Setup)

The launchers can install dependencies, initialize the database, and build the app when those items are missing. Setup is not identical across platforms: review the environment file and set a real secret before exposing the app to a network. The Windows launchers copy `.env.example` but do not replace its sample `NEXTAUTH_SECRET`.

#### Set your authentication secret on Windows

Before starting the app for the first time:

1. Open PowerShell in the Attendly project folder.
2. If `.env` does not exist yet, create it from the template:
   ```powershell
   Copy-Item .env.example .env
   ```
3. Generate a secret:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   ```
4. Open `.env` in a text editor and replace the sample value of `NEXTAUTH_SECRET` with the generated value. Do not share or commit `.env`.

On macOS/Linux, `./start.sh` creates `.env` and replaces the template secret on first launch. For manual setup on any platform, copy `.env.example` to `.env` and set a unique secret before running the app.

### On Windows

Choose whichever launch option you prefer:

- **Desktop App**: Double-click **`Attendly.bat`**.
  *Starts the Electron desktop window and the local server. This launcher also starts an optional Cloudflare tunnel.*
- **Web Browser + Tunnel**: Run **`start.bat`**. It may request Administrator access to add a firewall rule, and starts a Cloudflare tunnel so phones can connect from other networks. Use this only when you intend to expose the app to student devices.
- **Terminal Command**: Open PowerShell or Command Prompt in the folder and type:
  ```bash
  npm run launch
  ```
  This command also starts the tunnel. For local development without a tunnel, use `npm run dev` instead.

### On macOS or Linux

Open Terminal in the project directory and run:
```bash
chmod +x start.sh stop.sh
./start.sh
```

### With Docker (Any OS)

If you have Docker or Docker Desktop installed:

Docker Compose requires a unique `NEXTAUTH_SECRET`. Create a root-level `.env` file before starting the container.

On macOS or Linux:
```bash
printf 'NEXTAUTH_SECRET=%s\n' "$(openssl rand -base64 32)" > .env
```

On Windows PowerShell:
```powershell
$bytes = New-Object byte[] 32
$rng = [Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
$rng.Dispose()
"NEXTAUTH_SECRET=$secret" | Set-Content .env -Encoding ascii
```

Then start Attendly:
```bash
docker compose up -d
```
Open **`http://localhost:3000`** in your browser.

Docker Compose does not start a public tunnel. To generate QR links that phones on the same LAN can open, add `APP_URL` and `NEXTAUTH_URL` to `.env` with the server's LAN address (for example, `http://192.168.1.50:3000`), then restart the container. Access from outside that LAN requires a properly secured HTTPS setup.

---

## 5. Creating Your Instructor Account

Once Attendly starts, your browser or desktop window will automatically open to:
👉 **`http://localhost:3000`**

1. If this is a fresh database with no accounts, open the **Instructor Setup** screen (`/setup`).
2. Fill in your information:
   - **Full Name & Title**: (e.g., *Prof. Dr. Alan Turing*)
   - **University Email**: (e.g., *prof@university.edu*)
   - **Password**: Create a unique password (minimum 8 characters; use a stronger password for any network-accessible deployment).
3. Click **"Complete Setup & Launch"**.
4. You will be redirected to the sign-in screen (`/login`). Enter your email and password to enter your dashboard.

> [!NOTE]
> **Testing only:** `npm run db:seed` creates the demo account below. The seed script also deletes existing courses belonging to that demo account, so do not run it on a real installation.
> - **Email**: `prof@university.edu`
> - **Password**: `professor123`

---

## 6. Creating Your First Course

From your **Academic Dashboard**:

1. Click the **"+ New Course"** button.
2. In the modal dialog:
   - **Course Name**: Enter the title of your lecture or laboratory (e.g., *Computer Architecture (CS 201)* or *Advanced Physics Lab*).
   - **Description / Semester**: (Optional) e.g., *Semester 1 — Autumn 2026*.
3. Click **"Create Course"**.
4. You will be immediately taken to your course management page.

---

## 7. Importing Your Student Roster from Excel

Attendly has an intelligent, fault-tolerant Excel parser that accepts your existing university class lists.

### Step 1: Open the Roster Tab
1. Inside your course page, click on the **"Enrolled Students"** tab.
2. Click **"Import Excel"**.

### Step 2: Excel File Format
Your spreadsheet should contain 3 columns (any order, case-insensitive headers):
| Column 1 (Name) | Column 2 (Email) | Column 3 (Group) |
|---|---|---|
| `Alice Johnson` | `alice@university.edu` | `Group A` |
| `Bob Smith` | `bob@university.edu` | `Group A` |
| `Charlie Brown` | `charlie@university.edu` | `Group B` |

> [!TIP]
> You can click the **"Download Template"** button in the dialog to get a pre-formatted Excel file ready to fill out!

### Step 3: Upload and Validate
1. Drag and drop your `.xlsx` file into the upload zone.
2. Attendly will instantly preview all detected students and alert you to any missing emails or duplicate rows.
3. Click **"Confirm & Save Roster"**. Your students are now enrolled!

*(You can also add individual students manually at any time by clicking **"Add Student"**).*

---

## 8. Launching an Attendance Session

When lecture time arrives:

1. On your course page, click **"Launch Session"** (or click **"+ New Session"** from the Sessions tab).
2. Configure the session:
   - **Session Title**: (e.g., *Lecture 1: Introduction to Architecture* or *Lab 3: Oscilloscopes*).
   - **Classroom / Lecture Hall**: Choose a preset (e.g., `Room 101`, `Auditorium A1`, `Lab 204`) or type your custom room name.
   - **Date and Time**: Defaults to current time.
   - **Target Groups**: Select which student groups are expected today. (For a full-class lecture, select all groups. For a laboratory section, select only that section, e.g., *Group A*).
3. Click **"Create Session"**.

---

## 9. Predefined Classroom URLs & Posters

One of Attendly's signature features is **Predefined Classroom URLs**:

Instead of messy, random hash URLs, Attendly binds student links directly to physical lecture halls:
- `http://<host>:3000/attend/room-101`
- `http://<host>:3000/attend/auditorium-a1`
- `http://<host>:3000/attend/lab-204`

### How to use this in your faculty:
1. Print a high-resolution QR code poster for your room using the **Present QR** screen.
2. Laminate and hang the poster permanently near the classroom lectern, whiteboard, or doorway.
3. Whenever you launch an open session in that classroom, students scanning that permanent poster are automatically routed to your active lecture!

---

## 10. Student Experience (What Students Do)

When you display the QR code on the lecture hall projector:

1. **Step 1 — Scan**: The student points their smartphone camera (iPhone Camera app or Android Google Lens / Camera) at the projected QR code and taps the link.
2. **Step 2 — Enter Email**: The student enters their institutional university email (e.g., `alice@university.edu`).
3. **Step 3 — Verification**:
   - The server verifies that the email exists in your course roster.
   - The server verifies that the student is assigned to today's scheduled group.
   - The server may use browser/device identifiers to flag repeated check-ins; these identifiers do not establish a student's identity.
4. **Step 4 — Instant Success**:
   - The student sees a green confirmation checkmark, their name, group, scan timestamp, and confirmed room.
   - A soft vibration confirms the submission on their phone.
   - The student can safely lock their phone and pay attention to class.

---

## 11. Attendance Integrity Checks and Limitations

Attendly applies checks that can help instructors review attendance, but no QR or browser-only check can guarantee that the person scanning is the enrolled student or is physically in the room:

1. **Duplicate-device signals**: Browser/device identifiers can help flag multiple check-ins from the same browser or device during a session. Identifiers can be changed, cleared, or spoofed; this does not prove identity and cannot prevent all proxy attendance.
2. **Approximate location**: Browser geolocation may be used when available. IP-based estimates can be inaccurate and may be resolved by an external IP-location service. Treat distance as an indicator only, not proof that a student is in the room.
3. **Roster and group checks**:
   - The app checks that the email is on the course roster and that the student's group is allowed for the session.
4. **Session status**:
   - Check-ins are rejected when the instructor closes the session. Reopening it allows check-ins again.

---

## 12. Live Monitoring & Closing the Session

While students are scanning, your computer displays the **Live Session Monitor**:

- **Real-Time SSE Updates**: As students scan, their names appear live on your roster list without you needing to refresh the page (`F5`).
- **Turnout Counters**: A large display shows the live count (e.g., `45 / 50 Present`) with percentage turnout ring.
- **Projector Fullscreen Mode**:
  - Press the **`P`** key on your keyboard or click **"Present QR"** to enter fullscreen projection.
  - Features high-contrast black-on-white QR rendering visible from the back row of large auditoriums.
  - Press **`Esc`** to exit projection mode.
- **Closing Check-In**:
  - Once class begins or the grace period ends (e.g., 10 minutes in), click **"Close Check-in"** (or press the lock button).
  - The QR code on screen blurs with a "Check-in Closed" badge, and no further check-ins will be accepted.

---

## 13. Exporting Official Excel Attendance Reports

Attendly generates professional Microsoft Excel (`.xlsx`) spreadsheets formatted according to academic standards:

### Single Session Report
1. On any session page, click **"Export Excel"**.
2. Downloads a formatted spreadsheet containing:
   - Student Full Name, University Email, and Academic Group.
   - Status (`Present` in soft green, `Absent` in soft red).
   - Exact check-in timestamps and scan proximity distance.

### Full Course Semester Matrix
1. Open your course page and click the **"Reports & Analytics"** tab.
2. Click **"Download Semester Attendance Matrix (.xlsx)"**.
3. Generates a multi-column spreadsheet with every student as a row, every lecture/lab session as a column, and the final attendance rate percentage computed automatically.

---

## 14. Backing Up & Transferring Data to Another PC

For a non-Docker installation, courses, students, attendance history, and timestamps are stored in:

📁 **`prisma/dev.db`**

### To back up a non-Docker installation:
1. Stop Attendly so the database is not being written.
2. Copy `prisma/dev.db` to a protected backup location.
3. Store the backup securely because it contains student information.

### Docker data
Docker Compose stores the database in the persistent `attendly-data` named volume, not in the project folder. `docker compose down` keeps this volume; `docker compose down -v` deletes it. Back up the volume using your Docker backup procedure before moving or removing it.

---

## 15. Troubleshooting & Common Questions

### Q: What if students have different cellular carriers or Wi-Fi networks?
**A:** `start.bat`, `npm run launch`, and the desktop launcher start an optional Cloudflare Quick Tunnel. The generated HTTPS URL changes when the tunnel restarts and is reachable over the public internet while active. Keep the launcher open during check-in and share the URL only with intended participants.

### Q: Windows Firewall blocked the connection on my new computer?
**A:** `start.bat` may request Administrator access to configure Windows Defender Firewall. If you do not want to change firewall settings or expose the app, use the local development command (`npm run dev`) and open it only on the host computer.

### Q: A student's phone camera is blurry or can't scan from the back row?
**A:** You can copy the short direct link by clicking **"Copy Link"** (or pressing `C` on your keyboard) and paste it into your classroom chat, or write the predefined room link (e.g., `/attend/room-101`) on the whiteboard.

### Q: How do I change my professor password?
**A:** Click **Settings** in the left sidebar menu, enter your current password, and choose your new password.

### Q: How do I stop Attendly when class is over?
**A:** Double-click **`stop.bat`** (or run `./stop.sh` on macOS/Linux), or press `Ctrl + C` in the terminal window. All background processes will terminate cleanly.

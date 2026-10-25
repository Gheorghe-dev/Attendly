# 🎓 Attendly — Academic Attendance Tracking System

<p align="center">
  <strong>An open-source QR attendance app for instructors who want to manage courses, check-ins, and attendance reports from their own computer or server.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-emerald?style=for-the-badge" alt="MIT License" />
  <img src="https://img.shields.io/badge/Next.js-14.2-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=for-the-badge&logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Electron-Desktop-47848F?style=for-the-badge&logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/Platforms-Web_|_Windows_|_macOS_|_Linux-purple?style=for-the-badge" alt="Web and desktop platforms" />
</p>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [App Presentation](#-app-presentation)
- [Why Attendly?](#-why-attendly)
- [Core Features](#-core-features)
- [Quick Start Guide](#-quick-start-guide)
  - [Option A: Windows (One-Click)](#option-a-windows-one-click)
  - [Option B: macOS & Linux](#option-b-macos--linux)
  - [Option C: Docker & Docker Compose](#option-c-docker--docker-compose)
  - [Option D: Developer / Manual CLI](#option-d-developer--manual-cli)
- [Predefined Classroom URLs](#-predefined-classroom-urls)
- [Attendance Integrity Checks](#-attendance-integrity-checks)
- [Excel Import & Export Standards](#-excel-import--export-standards)
- [System Architecture](#-system-architecture)
- [Verification & Automated Tests](#-verification--automated-tests)
- [Contributing](#-contributing)
- [License](#-license)
- [Documentation](#-documentation)

---

## 🌟 Overview

**Attendly** helps instructors manage course rosters and record attendance in lectures, seminars, and laboratory classes. Instructors create a course, import a student roster, open a session, and display its QR code for students to check in.

The web app and SQLite database can run on an instructor's computer or a self-managed server. If you use the optional Cloudflare Quick Tunnel or IP-based location fallback, some network traffic or IP address data is handled by those external services. Review your institution's privacy requirements before using real student data.

## 🎤 App Presentation

**Attendly turns classroom attendance into a simple, repeatable workflow.** An instructor creates a course, imports its student roster, and opens a session for a class meeting. Students scan the session's QR code on their phones and submit a check-in; the instructor can follow submissions live, close or reopen the session, and export the resulting records to Excel.

### A typical class session

1. **Set up a course:** Add course details and import the roster from an Excel workbook.
2. **Open attendance:** Create a session for the course and choose its classroom.
3. **Share the check-in:** Display the session QR code or use a predefined classroom link.
4. **Monitor participation:** Review incoming check-ins in the live dashboard and manage the session.
5. **Keep the record:** Export a session report or a course attendance matrix for follow-up.

Attendly is designed for instructors and academic teams who want a practical alternative to paper sign-in sheets, without requiring dedicated classroom scanning hardware. It can run as a web app or a Windows desktop app, with Docker available for self-managed deployments. Attendance and location signals are intended to assist classroom workflows; they do not independently verify a student's identity or physical presence.

---

## 💡 Why Attendly?

| Traditional Methods | Attendly |
| :--- | :--- |
| **Paper Sign-in Sheets**: Manual collection and data entry. | **QR check-in**: Students scan a session link and the instructor monitors check-ins in the app. |
| **Expensive RFID/Biometric Systems**: High maintenance, fixed room readers, vendor lock-in. | **Zero Hardware**: Uses standard phone cameras and standard classroom projectors. |
| **Cloud SaaS Subscriptions**: Monthly per-student fees and data hosted by a vendor. | **Self-hosted option**: Run the app with a local SQLite database and manage where it is hosted. Optional tunnels and IP geolocation use third-party services. |

---

## ✨ Core Features

- **🏛 Instructor dashboard**: Responsive course and session views, light and dark themes, and live check-in monitoring.
- **📍 Predefined Classroom URLs**: Direct links bound permanently to physical rooms (e.g., `/attend/room-101`, `/attend/auditorium-a1`, `/attend/lab-204`). Instructors can print permanent posters in lecture halls.
- **🛡 Attendance checks**: Roster membership, session status, group rules, and browser/device identifiers help flag duplicate-device check-ins. These checks are not proof of identity or physical presence.
- **📏 Approximate location telemetry**: The app can use browser geolocation and IP-based location estimates. Location may be unavailable or inaccurate; IP geolocation may send an IP address to an external provider.
- **🌐 Optional mobile access**: The launch scripts can create an ephemeral Cloudflare Quick Tunnel so student phones can reach the app without router configuration. This exposes the app over the internet while the tunnel is running.
- **⚡ Real-Time Live Monitor (SSE)**: Live roster dashboard streams check-ins in real time with audio-visual notifications and percentage turnout indicators.
- **📥 Smart Excel Importer**: Drag-and-drop roster upload with automatic column detection (handles any subgroup or section naming convention like `CS 3.1A`, `Group 2`, etc.).
- **📤 Official Excel Reports**: 1-click export of color-coded attendance sheets for individual sessions or full semester course matrices.
- **🖥 Dedicated Native Desktop App**: Runs as a standalone desktop application via Electron with system tray controls, desktop shortcuts, and auto-managed server processes.

---

## 🚀 Quick Start Guide

> **App vs. documentation site:** The optional static guide is in [`docs/`](docs/index.html). The app itself must run on your computer or server; GitHub Pages cannot host its database or API.

### 📦 Desktop Installers — Recommended

Download a ready-to-run installer from the [latest Attendly GitHub Release](https://github.com/Gheorghe-dev/Attendly/releases/latest). You do **not** need to clone or download the source repository.

- **Windows**: Download and run the `.exe` installer. It creates desktop and Start menu shortcuts and launches Attendly.
- **macOS (Apple Silicon & Intel)**: Download the `.dmg` and move Attendly to Applications, or run the `.pkg` installer.
- **Linux**: Download the `.AppImage`, make it executable if prompted, and launch it.

If a release has not been published yet, installers will appear on that page after the desktop build completes. Source-based installation instructions are below.

---

### Install from GitHub Source

You can install the Attendly server on a Windows, macOS, or Linux computer. Install [Node.js 24 LTS](https://nodejs.org/) first. You can either clone the repository with Git or download and extract the ZIP from the green **Code** button on [GitHub](https://github.com/Gheorghe-dev/Attendly).

```bash
git clone https://github.com/Gheorghe-dev/Attendly.git
cd Attendly
```

The web interface also works in a modern browser on phones and tablets. Phones are client devices: they connect to a running Attendly server and do not install the Git repository as a native mobile app. To let student devices connect from other networks, start the optional tunnel from the host computer; its temporary public URL is only available while that tunnel is running. GitHub Pages hosts the guide, not the attendance application.

### Option A: Windows (One-Click)

In the cloned or extracted project folder, run one of the Windows launchers:

Before the first launch, create `.env` from `.env.example` if needed and replace the sample `NEXTAUTH_SECRET` with a unique value. Windows launchers copy the template but do not generate a replacement secret. See [TUTORIAL.md](TUTORIAL.md) for the exact steps.

1. **Native Desktop App**:
   - Double-click **`Attendly.bat`** (or use the desktop shortcut).
   - Installs dependencies and initializes/builds the app when needed, then opens the desktop window. The desktop launcher also starts a Cloudflare tunnel.
   - Before your first launch, replace the sample `NEXTAUTH_SECRET` in `.env` with a generated value (steps in [TUTORIAL.md](TUTORIAL.md)).

2. **Web Browser + Worldwide Mobile Tunnel**:
   - Run **`start.bat`** (it may request Administrator permission to configure Windows Firewall).
   - Starts the server and Cloudflare tunnel, then opens `http://localhost:3000`.
   - Use this only when you intend to let student phones connect over the network. The tunnel URL is publicly reachable while active.

3. **To stop**: Double-click **`stop.bat`**.

---

### Option B: macOS & Linux

Attendly includes shell launchers for macOS and Linux:

```bash
# From inside the cloned or extracted Attendly folder:
chmod +x start.sh stop.sh

# Launch Attendly
./start.sh
```
`./start.sh` checks Node.js, creates `.env` from `.env.example` (and replaces its sample secret), installs dependencies if needed, initializes the database if missing, builds the app if needed, and starts the server and Cloudflare tunnel.

To stop Attendly at any time:
```bash
./stop.sh
```

---

### Option C: Docker & Docker Compose

Deploy Attendly on any server or workstation without installing Node.js on the host.
Create a root-level `.env` file with a unique authentication secret before starting Docker. Do not expose the app with the sample/default secret:

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

Then start the app, follow logs, and stop it with:
```bash
docker compose up -d
docker compose logs -f
docker compose down
```

Access Attendly in your browser at: **`http://localhost:3000`**. Docker Compose does not start a public tunnel. To let phones on your local network scan working QR links, add `APP_URL=http://<host-LAN-IP>:3000` and `NEXTAUTH_URL=http://<host-LAN-IP>:3000` to `.env`, then restart Compose; use a trusted HTTPS URL and suitable network configuration for access from outside your LAN. All SQLite database files are persistently mounted in Docker volume `attendly-data`. Never commit the `.env` file.

---

### Option D: Developer / Manual CLI

If you prefer running via standard Node.js package scripts, clone or extract the repository first and open a terminal in the project folder. Install Node.js 24 LTS. Use the commands for your terminal to copy the environment template:

```bash
# 1. Install dependencies
npm ci

# 2. Configure environment and replace the sample NEXTAUTH_SECRET
cp .env.example .env
# Generate a secret, then paste it into .env:
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

On Windows PowerShell, copy the template with `Copy-Item .env.example .env`, then generate a secret with the same `node -e` command above and replace the sample `NEXTAUTH_SECRET` value in `.env`.

Continue in either terminal:
```bash
# 3. Initialize SQLite database schema
npx prisma generate
npx prisma db push

# 4. Run development server
npm run dev

# Or run optimized production server
npm run build
npm start
```

Open `http://localhost:3000`. On a new database, create your instructor account from the setup screen. `npm run db:seed` is for disposable demo/test data only: it creates a known demo password and deletes courses already belonging to that demo account.

---

## 🏛 Predefined Classroom URLs

Instead of generating hard-to-read cryptographic strings, Attendly binds student links directly to each lecture hall:

- `http://<host>:3000/attend/room-101`
- `http://<host>:3000/attend/auditorium-a1`
- `http://<host>:3000/attend/lab-204`

### How It Works:
1. When creating a session, select or type the classroom name.
2. The system automatically routes students visiting that room URL to the **currently active session** in that room.
3. Instructors can print laminated QR code posters and attach them permanently to classroom lecterns or doors.

---

## 🛡 Attendance Integrity Checks

Attendly applies server-side roster, group, session-status, and duplicate-device checks. Browser fingerprints and device identifiers can be changed, shared, or unavailable; they are not reliable proof that a person is who they claim to be or is physically in the classroom. Treat location and device signals as supplementary indicators, not a substitute for an institution's identity or attendance policy.

```
                      Student Submits Scan
                               │
            ┌──────────────────┴──────────────────┐
            ▼                                     ▼
 1. Browser / device signals             2. Optional location signals
   - Identifiers can be reset              - GPS or IP estimate
   - Used to detect duplicates             - May be unavailable/inaccurate
            │                                     │
            └──────────────────┬──────────────────┘
                               ▼
                    Verification Decision
              [ PASS ]  -> Recorded in Live Roster
              [ FAIL ]  -> Logged in Rejected Submissions
```

- **Duplicate-device check**: Reuse of a device identifier within a session can be rejected as `DEVICE_ALREADY_USED`; this does not prevent all proxy attendance.
- **Roster & Group Enforcement**: Students outside the enrolled course roster or not belonging to the scheduled lab subgroup cannot confirm attendance.
- **Session status**: Check-ins are rejected while a session is closed; reopening the session allows check-ins again.

---

## 📊 Excel Import & Export Standards

### Importing Rosters (.xlsx)
Attendly features a tolerant parser that reads your existing university spreadsheets:
- **Columns Supported**:
  - `Name` / `Student Name` / `Full Name`
  - `Email` / `University Email` / `Student Email`
  - `Group` / `Subgroup` / `Section` (e.g., `AIA 3.1A`, `Group 2`, `Lab B`)
- Also supports headerless spreadsheets and transposed (horizontal) layouts.
- Built-in **Download Excel Template** button available in the course dashboard.

### Exporting Reports (.xlsx)
- **Single Session Report**: Color-coded spreadsheet of students with check-in timestamps and any available approximate location data.
- **Course Matrix Report**: Complete semester attendance table with students as rows, sessions as columns, and automatic attendance percentage calculations.

---

## 🏗 System Architecture

```
┌────────────────────────────────────────────────────────┐
│               Host Computer (Instructor)               │
│                                                        │
│  ┌──────────────────────┐    ┌──────────────────────┐  │
│  │ Next.js 14 Web / API │<-->│ SQLite Database      │  │
│  │ (Port 3000)          │    │ (prisma/dev.db)      │  │
│  └──────────┬───────────┘    └──────────────────────┘  │
└─────────────┼──────────────────────────────────────────┘
              │
   ┌──────────┴──────────┐
   │ Cloudflare Quick    │  (Temporary public HTTPS tunnel)
   │ Worldwide Tunnel    │
   └──────────┬──────────┘
              │ Public Internet (https://*.trycloudflare.com)
     ┌────────┴────────┐
     ▼                 ▼
┌───────────┐     ┌───────────┐
│  Mobile   │     │  Mobile   │
│ (4G / 5G) │     │  (Wi-Fi)  │
└───────────┘     └───────────┘
```

---

## 🧪 Verification & Automated Tests

Attendly is thoroughly covered by automated unit and integration tests:

```bash
# Run unit test suites (Jest)
npm test

# Run ESLint validation
npm run lint

# Run classroom URL integration tests
npx tsx scripts/test-classroom-urls.ts

# Run complete end-to-end verification
npx tsx scripts/verify-all.ts
```

---

## 🤝 Contributing

Contributions are warmly welcomed! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on code style, branch workflows, and submitting pull requests.

---

## 📄 License

Attendly is licensed under the [MIT License](LICENSE). You are completely free to use, modify, and distribute it for personal, academic, or commercial purposes.

---

## 📚 Documentation

- **Install and first-run tutorial:** [TUTORIAL.md](TUTORIAL.md)
- **Day-to-day instructor guide:** [USER_GUIDE.md](USER_GUIDE.md)
- **Technical reference and API overview:** [DOCS.md](DOCS.md)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md)

The optional documentation site in `docs/` can be deployed with the workflow in `.github/workflows/pages.yml`. In the repository settings, enable GitHub Pages with **GitHub Actions** as its source. GitHub Pages hosts static documentation only; it does not run the Attendly app or database.

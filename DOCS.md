# QR Attendance System — Full Documentation

A full-stack QR-based attendance app for universities: professors manage courses
and rosters, project a live QR code in class, students scan with their phone,
submit their university email, and a one-time link finalizes their attendance.

Built with Next.js 14 (App Router), TypeScript, Prisma + SQLite, NextAuth v5,
ExcelJS, `qrcode`, Nodemailer, and Tailwind CSS.

---

## Table of contents

1. [Quick start](#1-quick-start)
2. [Tech stack](#2-tech-stack)
3. [Architecture & data flow](#3-architecture--data-flow)
4. [Environment configuration](#4-environment-configuration)
5. [Database schema](#5-database-schema)
6. [Pages reference](#6-pages-reference)
7. [API reference](#7-api-reference)
8. [Authentication](#8-authentication)
9. [Attendance flow](#9-attendance-flow)
10. [Excel import &amp; export](#10-excel-import--export)
11. [Real-time updates (SSE)](#11-real-time-updates-sse)
12. [Group management](#12-group-management)
13. [QR + mobile scanning](#13-qr--mobile-scanning)
14. [Customization](#14-customization)
15. [Testing](#15-testing)
16. [Project structure](#16-project-structure)
17. [NPM scripts](#17-npm-scripts)
18. [Deployment notes](#18-deployment-notes)
19. [Security notes](#19-security-notes)
20. [Troubleshooting](#20-troubleshooting)

---

## 1. Quick start

```powershell
# 1. Install
cd C:\Users\Alex\Desktop\Qrscaner
npm install

# 2. Generate Prisma client & create dev.db with the schema
npx prisma generate
npx prisma migrate dev --name init

# 3. Seed a demo professor + course + 8 students
npm run db:seed

# 4. (optional) Generate demo Excel files for import testing
npm run db:excel      # 11-row sample with realistic groups (AIA 3.3A, AIA 3.1 B, ELA 2.2 A)
npm run db:demo       # 60-row clean roster across AIA 3.3A, AIA 3.1 B, ELA 2.2 A...
npm run docs:pdf      # Generates official PDF documentation (QR_Attendance_System_Documentation.pdf)

# 5. Build + launch (one-click via Desktop shortcut or start.bat)
.\start.bat           # Self-elevates UAC, unblocks Windows Firewall, opens Port 3000,
                      # sets Wi-Fi to Private, launches Next.js and Cloudflare Quick Tunnel!
```

Open `http://localhost:3000` (opened automatically by the launcher) and sign in with the seeded credentials:

- **Email:** `prof@university.edu`
- **Password:** `professor123`

To scan the QR code from any phone (on ANY network or mobile data):
- The system automatically launches a Cloudflare Quick Tunnel (`https://*.trycloudflare.com`).
- The QR code on your dashboard automatically encodes this worldwide HTTPS URL.
- Students on 4G/5G mobile data or different Wi-Fi networks can scan directly without configuration!

---

## 2. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14.2 (App Router) | Server components, route handlers, middleware, API all in one project |
| Language | TypeScript 5, strict mode | Catches API/UI mismatches at build time |
| Database | SQLite via Prisma ORM 5 | Zero-setup dev DB; swap to Postgres for prod by changing the `datasource` provider |
| Auth | NextAuth.js v5 beta, credentials provider, JWT sessions | No external IdP needed; works offline |
| Password hashing | `bcryptjs`, cost 12 | Pure JS so it works in any Node runtime |
| Excel | `exceljs` | Native .xlsx read/write, styles, formula support |
| QR | `qrcode` | PNG data URLs, configurable ECC |
| Email | `nodemailer` (Nodemailer, not NextAuth's `email` provider) | Plain SMTP, works against Ethereal/Gmail/Outlook/Mailgun/etc. |
| Live updates | Server-Sent Events | No socket library, one-way push fits this use case |
| Styling | Tailwind CSS, plain utility classes | Keeps the React components focused on behavior |
| Tests | Jest + `ts-jest`, jsdom env, `@testing-library/react` | DB/Excel/QR/email units + component smoke tests |

---

## 3. Architecture &amp; data flow

```
                +-----------------+
                |   Browser tab   |   (professor)
                |   /dashboard    |
                +--------+--------+
                         | PATCH /api/sessions/[id]   (create session)
                         | GET   /api/sessions/[id]/qr (get QR + URL)
                         v
                +-----------------+        +-------------------+
                |   Next.js API   |  <--> |    SQLite (.)     |
                |   (Route +      |        |    dev.db via     |
                |    Middleware)  |        |    Prisma 5       |
                +--------+--------+        +-------------------+
                         ^
                         | POST /api/attend/[token]
                         |        (email submission → SMTP)
                         |
                +--------+--------+
                |   Mobile phone  |    (student)
                |   /attend/[tok] |
                +--------+--------+
                         |
                         | GET /verify?token=<uuid>
                         v
                +-----------------+
                |  Email inbox    |
                +-----------------+
```

Key invariants:

- **JWT sessions** — NextAuth stores `token.id = professor.id`; the middleware reads it on every protected request.
- **`Session.token` is the public handle** — a CUID that the QR encodes and students hit. It is the only thing that ever crosses the trust boundary to the public internet. The dashboard URL (`id`) is private.
- **Two-phase commit for attendance** — first the student record becomes `pending`, then a verified click on the email link flips it to `verified` and stamps `verifiedAt`. This stops casual impersonation.
- **Unrecognized submissions are never silently dropped** — stored in `UnrecognizedSubmission` so professors see them as warnings.

---

## 4. Environment configuration

All env values live in `.env` and `.env.local`. The two files have the same schema; `.env.local` overrides `.env` in Next.js.

```ini
# ---- Database ----
DATABASE_URL="file:./dev.db"

# ---- NextAuth v5 ----
NEXTAUTH_SECRET="supersecret-change-in-production-32chars-min"   # any 32+ char string
NEXTAUTH_URL="http://localhost:3000"                              # only used by NextAuth's internal redirects
AUTH_TRUST_HOST="true"                                             # REQUIRED for `npm start`. Dev mode trusts localhost automatically.

# ---- SMTP (outbound verification emails) ----
SMTP_HOST="smtp.ethereal.email"   # default is Ethereal for testing
SMTP_PORT="587"
SMTP_USER=""                       # fill in for real sending
SMTP_PASS=""
SMTP_FROM="noreply@university.edu"

# ---- Public URL base ----
APP_URL="http://localhost:3000"
SETUP_KEY="setup-key-2024"          # gate to /api/auth/register; rotate before exposing publicly
```

For LAN/mobile use:

- `AUTH_TRUST_HOST=true` lets NextAuth accept requests coming from any host header (otherwise it 500s in production).
- The QR routes derive their origin from the request's `Host` header. If you want the QR to always point at `192.168.x.y:3000`, either set `APP_URL` and access via that IP, or just access the dashboard on your phone at the LAN IP and the QR will encode it.

Generate a new secret any time:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 5. Database schema

7 models in `prisma/schema.prisma`:

```
Professor       ──┐
   id, email (U),  │
   passwordHash,    │
   name,            │
   createdAt        │
                    ▼
                  Course
                  id, name, professorId, createdAt,
                  extraGroups: String @default("")   ← for placeholder groups
                    │
                    ├── Student
                    │     id, name, email, group, courseId,
                    │     createdAt, @@unique([email, courseId])
                    │     └─ group is a free-form string ("AIA3.1", "Group B", etc.)
                    │
                    └── Session
                          id, courseId, name, date,
                          groups: String ("AIA3.1,AIA3.2" — comma-separated),
                          token: String @unique @default(cuid()),
                          status: String ("open" | "closed"),
                          createdAt
                          │
                          ├── AttendanceRecord
                          │     id, sessionId, studentId,
                          │     status: String ("pending" | "verified"),
                          │     verifiedAt?, createdAt,
                          │     @@unique([sessionId, studentId])
                          │
                          ├── VerificationToken
                          │     id, email, sessionId,
                          │     token: String @unique @default(cuid()),
                          │     expiresAt, used: Boolean,
                          │     createdAt   ← 15-min lifetime
                          │
                          └── UnrecognizedSubmission
                                id, sessionId, email, submittedAt
```

Design notes:

- Group names live on `Student.group`. The schema has no `Group` table; this keeps renames a one-row update in `Student`. New groups are added by importing rows or via the dashboard Groups tab (which stores them on `Course.extraGroups` until students get assigned).
- `@@unique([email, courseId])` on Student lets the same email re-enroll in different courses.
- `@@unique([sessionId, studentId])` on AttendanceRecord prevents double-recording on retries.
- Default IDs are CUIDs — opaque, URL-safe, monotonic enough.

Run migrations:

```powershell
npx prisma migrate dev --name <desc>   # create + apply
npx prisma generate                    # refresh Prisma Client types
```

---

## 6. Pages reference

| URL | Auth | Purpose |
|---|---|---|
| `/` | any | Redirects to `/dashboard` if signed in, otherwise `/login`. |
| `/login` | public | Email + password form. Demo creds visible for convenience. |
| `/dashboard` | professor | Overview: stat cards (courses, live sessions, students, attendances verified), live-sessions list, recent-sessions list, quick actions. |
| `/dashboard/courses` | professor | CRUD courses + per-course counts + jump to roster or new session. |
| `/dashboard/courses/[id]` | professor | Roster, sessions, Groups, import. Tabs: Students / Sessions / **Groups** (new) / Import Excel. Drag-and-drop upload with validation preview. |
| `/dashboard/courses/[id]/sessions/new` | professor | Form to create a session: name, datetime, multi-select groups, initial status (open/closed). |
| `/dashboard/sessions` | professor | List of every session across all courses; live-vs-closed badge; export per session. |
| `/dashboard/sessions/[id]` | professor | Live monitoring: stat tiles (Enrolled / Present / Absent / Rate %), attendance roster table, unrecognized submissions tab, real-time SSE updates, QR sidebar preview + fullscreen/projection modal. |
| `/attend/[token]` | public | Student mobile-optimized page: shows course name, session name, date. Form asks for university email. Submit triggers an email verification. If the session is closed, shows a "Registration closed" state instead of the form. |
| `/verify` | public | Landing page after the student clicks the email link. Calls `/api/verify?token=…` to mark attendance `verified` and shows a success / expired / already-used screen. |

### Components

| Component | Where used | Responsibility |
|---|---|---|
| `DashboardNav` | every `/dashboard/*` page | Sticky top nav with mobile menu, sign-out button. |
| `QRDisplay` | `dashboard/sessions/[id]` | Fullscreen-capable modal for projector display. Press `F` for fullscreen, `Esc` to close, copy URL button. |
| `SessionProvider` | root `layout.tsx` | Wraps the app in `next-auth/react`'s client-side `SessionProvider`. |
| `GroupsTab` | `dashboard/courses/[id]` | The dashboard UI for renaming/adding/merging/removing groups without re-importing Excel. |

---

## 7. API reference

All endpoints are app-route handlers under `src/app/api/`. Every route runs
`auth()` first unless it's intentionally public (`/attend/[token]`, `/verify`,
`/api/auth/*`).

### Auth

| Method | Path | Notes |
|---|---|---|
| `GET POST` | `/api/auth/[...nextauth]` | NextAuth v5 catch-all. Exposes `signIn`, `signOut`, `session`, `csrf`, `providers`. |
| `POST` | `/api/auth/register` | One-shot professor signup gated by `SETUP_KEY`. Body: `{email, password, name, setupKey}`. Returns `409` if email exists, `403` on bad key. |

### Courses

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/courses` | List the signed-in professor's courses with counts. |
| `POST` | `/api/courses` | Create a course. Body: `{name}`. |
| `GET` | `/api/courses/[id]` | Single course with students + sessions. |
| `DELETE` | `/api/courses/[id]` | Delete a course. (Cascades will fail without `onDelete: Cascade` — see "Known issues".) |
| `GET` | `/api/courses/[id]/export` | Multi-session Excel report (`.xlsx`). |
| `POST` | `/api/courses/[id]/students` | Multipart upload of an `.xlsx` file. Fields: `file`, `preview=true|false`, `replace=true|false`. Returns `{validation}` on preview, `{imported, skipped, errors, duplicates, total}` on commit. |
| `GET POST PATCH` | `/api/courses/[id]/groups` | **New.** `GET` lists (from `Student.group` + `Course.extraGroups`). `PATCH` runs one of `{action: "rename"\|"add"\|"remove"\|"merge", …}`. See [Group management](#12-group-management). |

### Sessions

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/sessions` | List sessions, optional `?courseId=` filter. |
| `POST` | `/api/sessions` | Create. Body: `{courseId, name, date, groups[], status}`. |
| `GET` | `/api/sessions/[id]` | Full session detail with attendance + unrecognized logs + enrolled students. |
| `PATCH` | `/api/sessions/[id]` | Update `status` (`open` / `closed`). |
| `DELETE` | `/api/sessions/[id]` | Delete a session. |
| `GET` | `/api/sessions/[id]/qr` | Returns `{qr, url, token}`. The `url` adapts to the request's `Host` header — see [QR + mobile scanning](#13-qr--mobile-scanning). |
| `GET` | `/api/sessions/[id]/stream` | `text/event-stream`. Pushes `{status, enrolled, verified, recent[]}` every 5 s. |
| `GET` | `/api/sessions/[id]/export` | Single-session Excel. Rows are colored green (Present) / red (Absent). |

### Public

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/attend/[token]` | Returns `{courseName, sessionName, date, status}`. Public — used by `/attend/[token]` to render the header. |
| `POST` | `/api/attend/[token]` | Body: `{email}`. Validates roster membership + group membership, creates a `pending` `AttendanceRecord`, generates a `VerificationToken` (15-min TTL), sends email. Returns `404` + writes `UnrecognizedSubmission` if the email isn't enrolled, `403` if the student's group isn't in the session's group list. |
| `GET` | `/api/verify?token=…` | Atomically marks the verification token `used` and the attendance record `verified` + stamps `verifiedAt`. Returns `410` on reuse, on expiry, or on missing token. |

---

## 8. Authentication

### Login

`/login` posts email + password to NextAuth's credentials provider. The `authorize()` callback in `src/lib/auth.ts` looks up `Professor` by email and `bcrypt.compare`s the password against `passwordHash`. On success a JWT is issued with `id = professor.id`, which the dashboard reads as `session.user.id`.

### Middleware

`src/middleware.ts` re-exports `auth` from `@/lib/auth` and configures Next.js middleware to match:

```
/dashboard/:path*        — dashboard pages
/api/courses/:path*      — every course API
/api/sessions/:path*     — every session API
/api/export/:path*       — (defensive; not currently used; legacy)
/api/attend/:path*       — (only the QR route under sessions is public; the actual attend route is open)
/api/verify              — verification page redirect via middleware if you add it
```

Unauthenticated requests get a 307 redirect to `/login` for browser pages, or a `401 JSON` for API routes.

### Demo + setup keys

The professor signup endpoint is gated by `SETUP_KEY` (defaults to `"setup-key-2024"`). To create your first professor outside of `npm run db:seed`:

```powershell
curl -X POST http://localhost:3000/api/auth/register `
  -H "Content-Type: application/json" `
  -d '{"email":"you@uni.edu","password":"strong-password","name":"Dr You","setupKey":"setup-key-2024"}'
```

> Rotate `SETUP_KEY` before exposing the app publicly.

---

## 9. Attendance flow

End-to-end sequence, with the professor on a laptop and the student on a phone:

```
 prof                         server                       phone              email
  |                              |                            |                 |
  |--- create session --------->|                            |                 |
  |<-- 201 {id, token} ---------|                            |                 |
  |--- show QR (modal) -------->|                            |                 |
  |   GET /api/.../qr           |                            |                 |
  |<-- {qr, url=...}  ----------|                            |                 |
  |                                                            |                 |
  |                                                    scans QR (or types URL)   |
  |                                                            |                 |
  |                                              GET /attend/<token>             |
  |                                              <-{courseName,date,status}      |
  |                                              POST /api/attend/<token>        |
  |                                              <-{message:"check your email"}  |
  |                                                  |                           |
  |                                                  \-- sendMail -->  inbox    |
  |                                                                       |       |
  |                                                  GET /verify?token=<uuid> <--/
  |                                                  <- {success: true}          |
  |                                                                    marks verified
  |<-- SSE pushed update -----------------------------|                 |
  |   dashboard refetches attendance                |                 |
```

Key invariants:

- Student must be in `Student` for this `courseId`.
- Student's `group` must appear in `Session.groups` (CSV).
- One attendance record per `(sessionId, studentId)`. Re-submits get a fresh verification link, never a second record.
- Unrecognized submissions are stored, never dropped.

---

## 10. Excel import &amp; export

### Import (`src/lib/excel.ts → parseStudentExcel`)

Accepts an `.xlsx` file formatted with:
- **1st Column (or Row 1):** Student Name (`Student Name`, `Name`, `THE Name`, `Nume`)
- **2nd Column (or Row 2):** University Email (`University Email`, `Email`, `imai`, `Mail`)
- **3rd Column (or Row 3):** Group (`Group`, `Groups`, `Grupa`, `Subgroup`)

Subgroup names can be anything, such as `AIA 3.3A`, `AIA 3.1 B`, `ELA 2.2 A`, `Group 1`, etc.

Features of the parser:
1. **Intelligent Header Detection**: Matches common variations and typos (`THE Name`, `imai`, `Groups`, Romanian headers).
2. **Automatic Column Fallback**: If headers are missing, checks row data and automatically maps Col 1 → Name, Col 2 → Email, Col 3 → Group.
3. **Transposed (Horizontal) Table Support**: Detects tables where Row 1 is Names, Row 2 is Emails, and Row 3 is Groups.
4. **Template Download Endpoint**: Pre-filled template can be downloaded from `/api/courses/template` or directly in the UI.
5. **Pre-Import Preview**: Trims and lowercases emails, validates email format with regex, detects duplicates, and previews errors before committing to the database.

The HTTP endpoint `/api/courses/[id]/students` supports two modes:

- `preview=true` — returns `{validation}` only, no DB write.
- `preview=false` (default) — `replace=true` wipes existing students first, then upserts each valid row by `(email, courseId)`. Returns counters: `{imported, skipped, total, errors, duplicates}`.

### Export

Two flavors, both with colored status cells:

- **Single session** — `GET /api/sessions/[id]/export`. One sheet named after the session. Columns: Student, Email, Group, Course, Date, Status (green/red), Registration timestamp.
- **Multi-session course** — `GET /api/courses/[id]/export`. One sheet with all sessions stacked. Same columns plus a `Session` column.

Both return `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with a filename derived from the course/session name.

---

## 11. Real-time updates (SSE)

`GET /api/sessions/[id]/stream` returns `text/event-stream`. The server:

1. Authenticates via cookie.
2. Queries the session with `attendance where status='verified'` and counts enrolled students in the assigned groups.
3. Pushes a `data: {…}\n\n` line every 5 s.
4. Stops on `req.signal.abort`.

The client (`dashboard/sessions/[id]/page.tsx`) opens an `EventSource`, calls `load()` (which fetches `/api/sessions/[id]`) on every `onmessage`. This avoids the 5-second delay for the *first* event.

If you want a heartier real-time push (e.g., trigger an event when verification happens), extend the route to push immediately on `attendanceRecord.update({status:"verified"})`. For the demo, 5 s polling is plenty.

---

## 12. Group management

Groups are plain strings stored on `Student.group` (with optional `Course.extraGroups` for placeholders). The dashboard exposes a full tab at **Course → Groups** with these actions:

| Action | Body to `PATCH /api/courses/:id/groups` | What it does |
|---|---|---|
| **Rename** | `{"action":"rename","from":"AIA3.1","to":"ELA3.1"}` | `Student.updateMany({courseId, group: from}, {group: to})`; rewrites matching entries inside `Session.groups` CSV. |
| **Add** | `{"action":"add","group":"ISM3.1"}` | Stores into `Course.extraGroups`; visible as a yellow "Empty" badge. |
| **Remove** | `{"action":"remove","group":"ISM3.1"}` | Only allowed if no students are assigned (returns `409` otherwise). Drops from `Course.extraGroups`. |
| **Merge** | `{"action":"merge","from":"OLD","to":"NEW"}` | Bulk moves students, rewrites sessions, dedups extras. |

Validation:

- Empty names, names containing commas, or names > 100 chars are rejected.
- Renaming into an existing name returns `409`.
- Names with `,` would break CSV serialization — explicitly blocked.

### Direct DB edits also work

If you'd rather script a bulk rename:

```js
// scripts/rename.js
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.student.updateMany({
    where: { courseId: '<courseId>', group: 'OLD' },
    data: { group: 'NEW' },
  });
  await p.$disconnect();
})();
```

---

## 13. QR + mobile scanning

QR codes are generated by `src/lib/qrcode.ts`:

```ts
generateQRCodeDataURL(url, {
  errorCorrectionLevel: 'H',
  margin: 2,
  width: 400,
  color: { dark: '#1e3a5f', light: '#ffffff' }
});
```

High ECC (`H`) makes the QR robust against projector glare and phone cameras at distance.

### Origin-awareness (important for mobile)

The QR encodes `http://<hostHeader>/attend/<token>`. The `Host` header is read from the live request, *not* the env. That means:

- Access the dashboard at `http://localhost:3000` → QR codes point to `http://localhost:3000/...` (only scannable from the same machine).
- Access the dashboard at `http://192.168.10.206:3000` (your LAN IP) → QR codes point there, so phones on the same Wi-Fi can scan and reach the server.
- Set `APP_URL` only as a *fallback* when there's no host header (rare).

On the dashboard, the QR modal also shows the URL prominently with a copy button, so the professor can type it into a phone's browser manually if scanning isn't working.

### Verification link

After the student submits their email, `POST /api/attend/<token]` does the same trick:

```ts
const verificationUrl = `${origin}/verify?token=${verToken}`;
```

so the link inside the email points at the same host the student used.

### Common scan failures

| Symptom | Likely cause | Fix |
|---|---|---|
| Phone camera shows nothing on scan | Camera permission denied, or low light | Allow camera; ensure QR is well-lit and >10 cm on screen |
| "Site can't be reached" after scan | Phone on different Wi-Fi than the server, or `host` was `localhost` | Access the dashboard from a phone on the same network, or set `APP_URL` to your LAN IP |
| Wrong device opens the QR | Multiple servers/tabs | Close old windows; restart with `.\start.bat` |
| Phone says "open in browser" but nothing happens | Default browser is configured to deny redirects | Tap "Open in Chrome/Safari" manually |

---

## 14. Customization

### Group naming (file OR dashboard)

Edit `seed/create-demo-excel.ts` (top of file) to change the auto-generated roster:

```ts
const GROUPS: string[] = ['AIA3.1', 'AIA3.2', 'AIA3.3', 'AIA3.4'];
```

Or use the dashboard Groups tab to add/rename groups without touching files.

### Demo data templates

```powershell
npm run db:demo    # 60 students, AIA3.1…AIA3.4, balanced 15 each
npm run db:excel   # 11-row sample with intentional validation errors
npm run db:seed    # DB: 1 professor + 1 course + 8 students
```

### Branding

- Title & metadata: `src/app/layout.tsx` (`metadata.title`, `metadata.description`).
- Colors / fonts: `tailwind.config.ts` and `src/app/globals.css`.
- Logo: anywhere a SVG-avatar appears (login page, dashboard nav). Swap the inline SVGs.

### Switching the database

For Postgres, MySQL, etc., change `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"   // or "mysql", "sqlserver"
  url      = env("DATABASE_URL")
}
```

and update `DATABASE_URL` in `.env`. Run `npx prisma migrate dev` afterwards.

---

## 15. Testing

```powershell
npm test            # Jest unit tests (4 suites, 17 cases)
npm run lint        # ESLint via next lint
npm run build       # production build + typecheck
```

Coverage:

| File | What it covers |
|---|---|
| `tests/excel.test.ts` | Excel parsing, header detection, error/duplicate categorization, attendance Excel round-trip |
| `tests/qrcode.test.ts` | Data-URL format + `getAttendanceUrl` URL composition |
| `tests/email.test.ts` | Nodemailer transporter can be instantiated without SMTP creds |
| `tests/normalizeEmail.test.ts` | Trim + lowercase used everywhere |

For component tests, extend `jest.config.js` (currently `testEnvironment: 'node'` — switch to `'jsdom'` and add `@testing-library/react` for client tests).

---

## 16. Project structure

```
Qrscaner/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   │   ├── 20261014184305_init/
│   │   └── 20261015130200_add_extra_groups/
│   └── dev.db                          ← SQLite, created on `prisma migrate`
├── seed/
│   ├── students-sample.ts              ← npm run db:seed
│   ├── create-sample-excel.ts          ← npm run db:excel
│   └── create-demo-excel.ts            ← npm run db:demo
├── src/
│   ├── app/
│   │   ├── layout.tsx                  ← root layout + SessionProvider
│   │   ├── page.tsx                    ← redirects on /
│   │   ├── login/page.tsx
│   │   ├── verify/page.tsx
│   │   ├── attend/[token]/page.tsx
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   ├── courses/                ← courses list + [id] detail (3 tabs) + new session
│   │   │   └── sessions/               ← sessions list + [id] live monitor
│   │   └── api/                        ← 14 route handlers (see API reference)
│   ├── components/
│   │   ├── DashboardNav.tsx
│   │   ├── QRDisplay.tsx
│   │   ├── SessionProvider.tsx
│   │   └── dashboard/courses/[id]/GroupsTab.tsx
│   ├── lib/
│   │   ├── auth.ts                     ← NextAuth v5 config
│   │   ├── prisma.ts                   ← Prisma client singleton
│   │   ├── email.ts                    ← Nodemailer + verification email HTML
│   │   ├── excel.ts                    ← parseStudentExcel + build*Excel
│   │   └── qrcode.ts                   ← generateQRCodeDataURL + getAttendanceUrl
│   ├── types/
│   │   └── next-auth.d.ts              ← Session.user.id augmentation
│   └── middleware.ts
├── tests/                              ← jest unit tests
├── start.bat                           ← one-click launcher
├── stop.bat                            ← kills port 3000
├── launcher.cs                         ← optional standalone C# launcher
├── DOCS.md                             ← this file
├── README.md                           ← short overview
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
├── next.config.mjs
├── jest.config.js
└── jest.setup.js
```

---

## 17. NPM scripts

| Script | Command | Use |
|---|---|---|
| `npm run dev` | `next dev` | Hot-reloading dev server (slower cold start, no optimization). |
| `npm run build` | `next build` | Production build. |
| `npm start` | `next start` | Run the built app (~350 ms cold start). |
| `npm run lint` | `next lint` | ESLint over `src/**`. |
| `npm test` | `jest --passWithNoTests` | All Jest suites. |
| `npm run db:migrate` | `prisma migrate dev` | Apply migrations and create new ones from schema edits. |
| `npm run db:generate` | `prisma generate` | Refresh the Prisma Client types. |
| `npm run db:seed` | `tsx seed/students-sample.ts` | Seed professor + course + 8 students. |
| `npm run db:excel` | `tsx seed/create-sample-excel.ts` | Generate `seed/sample-students.xlsx` (validation-error demo). |
| `npm run db:demo` | `tsx seed/create-demo-excel.ts` | Generate `seed/demo-students.xlsx` (60-row clean roster). |

The two `.bat` files use `start` if `.next/BUILD_ID` exists, else fall back to `dev`.

---

## 18. Deployment notes

This app will run anywhere Node 18+/20+ runs. A few things to check before promoting to production:

- **Database** — switch SQLite for Postgres (`provider = "postgresql"` in `prisma/schema.prisma`) and set `DATABASE_URL` to the connection string.
- **Auth** — `NEXTAUTH_SECRET` must be a fresh, unguessable 32-char string. `AUTH_TRUST_HOST=true` is required when hosting behind a proxy.
- **Email** — point `SMTP_*` at a real SMTP relay. Add a queue (BullMQ, Cloud Tasks) if email volume could spike; the current code sends synchronously and a slow SMTP server can hold a request open.
- **Mobile** — students scan a URL that the server returns, so the server must be reachable from student phones on the campus Wi-Fi. If port 3000 isn't reachable, terminate TLS on a reverse proxy (nginx/Caddy) on port 443 and put the Next.js server behind it.
- **Static assets &lt;img&gt; warnings** — QR images use `<img>` with `data:` URLs. Those can't go through `next/image` optimization. If you switch to serving QR PNGs as files, you can move to `<Image>` and get free optimization.
- **Edge middleware warnings** — `src/middleware.ts` re-exports `auth` which uses `bcryptjs`. bcryptjs is Node-only and you'll see warnings about `setImmediate` and `CompressionStream` in the build. The recommended fix (split `auth.config.ts` from `auth.ts` so middleware uses the edge-safe subset) is *not* applied here because the routes protected by middleware all run on Node anyway.

---

## 19. Security notes

- **Passwords** are hashed with bcryptjs cost 12. Don't lower this.
- **`SETUP_KEY`** gates professor signup. Treat it like an admin token — keep it out of frontend code, rotate before exposing publicly. Default is `"setup-key-2024"`.
- **`NEXTAUTH_SECRET`** must be set and unique per environment.
- **Verification tokens** are single-use, expire in 15 minutes, and are server-side `(email, sessionId)`-scoped — even if a student forwards the link, only the original recipient's email can verify on that session. Reuse is rejected with `410 Gone`.
- **QR codes leak the session token**. A leaked QR lets anyone with a valid `courseId` student email register attendance. Treat the projector screen as public.
- **CSRF** is handled by NextAuth for auth flows; the rest of the API uses JSON requests with bearer-less auth (cookie session), so requests must come from a browser, not arbitrary CORS callers.
- **File uploads** — only `.xlsx` files are accepted (`/api/courses/[id]/students` rejects everything else). ExcelJS is the only consumer; the file is parsed in memory, not stored.

---

## 20. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `npm start` returns `500` on `/api/auth/*` | NextAuth v5 UntrustedHost in production | Set `AUTH_TRUST_HOST=true` in `.env` (already done by default); restart server |
| `npm start` returns `500` everywhere else | Stale `.next` build after an edit | `npm run build` |
| Email never arrives | SMTP creds empty, server is ethereal, firewall blocks 587 | Fill in `SMTP_USER` / `SMTP_PASS` for a real SMTP relay; check `node_modules/nodemailer` logs |
| Student says "your email isn't on the list" | Wrong course, typo, or different email-format capitalization | `PII` is normalized on import; check `Course → Students` filter |
| `DELETE /api/sessions/:id` returns 500 | FK constraint (session has attendance / verTokens / unrecognized rows) | Cascade-delete children first, or accept that deletion is blocked for sessions with data |
| `build/lint` complains about `<img>` | `QRDisplay` and dashboard sidebar show data URLs | Leaving as-is; data URLs can't be optimized by `next/image` |
| Build complains `bcryptjs` in Edge Runtime | NextAuth v5 uses Node APIs in middleware | Acceptable warning; runtime works. For full edge support, split `auth.ts` into `auth.config.ts` (edge-safe) + `auth.ts` (Node extension) |
| Groups tab doesn't show placeholder groups | Empty `Course.extraGroups` is expected | Add a group via the dashboard or import students |
| Excel export opens as blank | Old Excel that doesn't support styles | Open in Excel 2016+ or LibreOffice |
| Dashboard navigation flickers on tab switch | SSE re-subscribes when navigating; expected; harmless | — |
| "Cannot find module" when running a seed script | `tsx` mismatch | `npx tsx seed/<file>.ts` once to refresh the cache, then `npm run db:*` |

---

_Last reviewed against `package.json` version `0.1.0`, schema migration `20261015130200_add_extra_groups`._

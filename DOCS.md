# 🎓 Attendly — Complete Technical System Documentation

This document is the exhaustive engineering and architectural reference for **Attendly**, an open-source academic attendance tracking system designed for higher education institutions.

---

## 📑 Table of Contents

1. [System Architecture & Data Flow](#1-system-architecture--data-flow)
2. [Technology Stack](#2-technology-stack)
3. [Database Schema & Entity Models](#3-database-schema--entity-models)
4. [Environment Configuration Reference](#4-environment-configuration-reference)
5. [Predefined Classroom URLs & Routing Engine](#5-predefined-classroom-urls--routing-engine)
6. [Anti-Proxy Security & Device Fingerprinting](#6-anti-proxy-security--device-fingerprinting)
7. [Proximity Distance Telemetry Engine](#7-proximity-distance-telemetry-engine)
8. [Complete REST API Reference](#8-complete-rest-api-reference)
9. [Real-Time Telemetry & Server-Sent Events (SSE)](#9-real-time-telemetry--server-sent-events-sse)
10. [Excel Roster Parser & Report Generator](#10-excel-roster-parser--report-generator)
11. [Electron Desktop Runtime](#11-electron-desktop-runtime)
12. [Worldwide Mobile Scanning & Cloudflare Tunneling](#12-worldwide-mobile-scanning--cloudflare-tunneling)
13. [Multi-Platform Deployment & Containers](#13-multi-platform-deployment--containers)
14. [Automated Testing & Verification Suite](#14-automated-testing--verification-suite)
15. [User & Beginner Tutorials](#15-user--beginner-tutorials)

---

## 1. System Architecture & Data Flow

Attendly executes as an integrated full-stack application running on the instructor's computer or local server:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   Instructor Laptop / Classroom Server                 │
│                                                                        │
│   ┌──────────────────────────────────────────────────────────────┐     │
│   │ Next.js 14 Web Engine (Port 3000)                             │     │
│   │  ├── App Router Pages (Dashboard, Live Monitor, Settings)    │     │
│   │  ├── REST API Routes (/api/attend, /api/sessions, etc.)      │     │
│   │  └── SSE Streamer (/api/sessions/[id]/stream)                │     │
│   └───────────────▲──────────────────────────────▲───────────────┘     │
│                   │                              │                     │
│                   ▼                              ▼                     │
│   ┌──────────────────────────────┐   ┌───────────────────────────┐     │
│   │ SQLite Database              │   │ Electron Native Host      │     │
│   │ (prisma/dev.db via Prisma 5) │   │ (Tray, Windows, Splash)   │     │
│   └──────────────────────────────┘   └───────────────────────────┘     │
└───────────────────▲────────────────────────────────────────────────────┘
                    │
       ┌────────────┴────────────┐
       │ Cloudflare Quick Tunnel │  (Temporary public HTTPS tunnel)
       └────────────▲────────────┘
                    │ Public Internet (*.trycloudflare.com)
         ┌──────────┴──────────┐
         ▼                     ▼
┌──────────────────┐  ┌──────────────────┐
│ Student Mobile   │  │ Student Mobile   │
│ (4G/5G Cellular) │  │ (Campus Wi-Fi)   │
└──────────────────┘  └──────────────────┘
```

### Key Invariants:
1. **Self-hosted data storage**: With a local install, the SQLite database is stored on the host. However, optional Cloudflare tunneling exposes the app through a third party, and IP-based location lookup may send client IP information to an external geolocation provider.
2. **Predefined Room Persistence**: Students can scan permanent classroom QR posters that resolve to whichever lecture is active in that room.
3. **Duplicate-device signals**: Browser/device identifiers can be used to detect some repeated check-ins, but can be reset or spoofed and do not prove identity or physical presence.
4. **Resilient Network Discovery**: The QR generator dynamically prioritizes:
   - Active Cloudflare public tunnel (for phone access across cellular 4G/5G and outside Wi-Fi).
   - Local LAN IPv4 address (for intranet Wi-Fi access).
   - Localhost fallback.

---

## 2. Technology Stack

| Component | Technology | Rationale & Implementation Details |
|---|---|---|
| **Framework** | Next.js 14.2 (App Router) | Server Components, Route Handlers, and API middleware in a unified codebase. |
| **Language** | TypeScript 5.0 (Strict) | End-to-end type safety across API schemas, database models, and React props. |
| **Database** | SQLite via Prisma 5.22 | Zero-configuration single-file storage (`prisma/dev.db`). Fully ACID-compliant. |
| **Authentication** | NextAuth.js v5 (Beta) | Password authentication via `bcryptjs` (cost 12) with stateless JWT sessions. |
| **Desktop Runtime** | Electron 44.9 | Native desktop window, system tray menu, and automatic child process management. |
| **QR Code Engine** | `qrcode` | High-DPI black-on-white PNG data URLs with 4-module quiet margins and SVG renderer. |
| **Excel Parser & Generator** | `exceljs` | Multi-column flexible layout parsing, formula calculations, and styled `.xlsx` reports. |
| **Real-time Live Sync** | Server-Sent Events (SSE) | Lightweight, single-connection unidirectional push (no heavy WebSocket daemon required). |
| **Styling** | Tailwind CSS 3.4 | Academic editorial tokens (`Fraunces`, `Inter`, `JetBrains Mono`), dark/light themes, WCAG 2.2 AA. |
| **Containerization** | Docker + Docker Compose | 4-stage multi-platform Alpine Linux container with persistent database volume. |

---

## 3. Database Schema & Entity Models

Defined in `prisma/schema.prisma` with cascading deletions:

```prisma
model Professor {
  id           String    @id @default(cuid())
  email        String    @unique
  passwordHash String
  name         String?
  createdAt    DateTime  @default(now())
  courses      Course[]
}

model Course {
  id          String    @id @default(cuid())
  name        String
  description String?
  professorId String
  professor   Professor @relation(fields: [professorId], references: [id], onDelete: Cascade)
  createdAt   DateTime  @default(now())
  extraGroups String    @default("")
  students    Student[]
  sessions    Session[]

  @@unique([name, professorId])
}

model Student {
  id         String             @id @default(cuid())
  name       String
  email      String
  group      String
  courseId   String
  course     Course             @relation(fields: [courseId], references: [id], onDelete: Cascade)
  createdAt  DateTime           @default(now())
  attendance AttendanceRecord[]

  @@unique([email, courseId])
}

model Session {
  id           String                   @id @default(cuid())
  courseId     String
  course       Course                   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  name         String
  date         DateTime
  groups       String                   // Comma-separated target groups, e.g. "Group A,Group B"
  classroom    String?                  @default("room-101")
  token        String                   @unique @default(cuid())
  status       String                   @default("open") // "open" | "closed"
  hostLat      Float?
  hostLng      Float?
  hostCity     String?
  createdAt    DateTime                 @default(now())
  attendance   AttendanceRecord[]
  verTokens    VerificationToken[]
  unrecognized UnrecognizedSubmission[]
}

model AttendanceRecord {
  id                String    @id @default(cuid())
  sessionId         String
  session           Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  studentId         String
  student           Student   @relation(fields: [studentId], references: [id], onDelete: Cascade)
  status            String    @default("pending") // "pending" | "verified"
  verifiedAt        DateTime?
  studentLat        Float?
  studentLng        Float?
  distanceMeters    Float?
  studentCity       String?
  deviceId          String?
  deviceFingerprint String?
  createdAt         DateTime  @default(now())

  @@unique([sessionId, studentId])
}

model VerificationToken {
  id        String   @id @default(cuid())
  email     String
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  token     String   @unique @default(cuid())
  expiresAt DateTime
  used      Boolean  @default(false)
  createdAt DateTime @default(now())
}

model UnrecognizedSubmission {
  id                String   @id @default(cuid())
  sessionId         String
  session           Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  email             String
  deviceId          String?
  deviceFingerprint String?
  reason            String?
  submittedAt       DateTime @default(now())
}
```

---

## 4. Environment Configuration Reference

The application reads configuration from `.env` and `.env.local`:

```ini
# Database Connection (SQLite)
DATABASE_URL="file:./dev.db"

# NextAuth v5 Security Key
# Generate a unique value via: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
NEXTAUTH_SECRET="your-32-byte-secret-token"
NEXTAUTH_URL="http://localhost:3000"
AUTH_TRUST_HOST="true"

# Fallback Application Base URL
APP_URL="http://localhost:3000"

# Optional Outbound Email (SMTP)
# Leave blank for zero-config local verification mode
SMTP_HOST=""
SMTP_PORT="587"
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="noreply@university.edu"
DEV_MODE_EMAIL="1"
```

---

## 5. Predefined Classroom URLs & Routing Engine

Located in `src/lib/classroom.ts`:

### Standard Presets:
- `Room 101`, `Room 102`, `Room 201`
- `Auditorium A1`, `Auditorium A2`
- `Lab 204`, `Lab 302`
- `Hall 1`, `Hall 2`

### Slugification Engine (`slugifyClassroom`):
Converts room names into permanent, clean URL handles:
- `"Room 101"` $\rightarrow$ `room-101`
- `"Auditorium A1"` $\rightarrow$ `auditorium-a1`
- `"Lab 204"` $\rightarrow$ `lab-204`

### Active Session Resolution Algorithm:
When a student scans or navigates to `/attend/room-101`:
1. Queries database for `status: 'open'` sessions matching `{ token: 'room-101' }` or `{ classroom: 'Room 101' }`.
2. Sorts by `date: desc` to connect to the most recent active session.
3. If no open session exists, falls back to the most recent closed session to display a clear `"Session Closed for Room 101"` state.
4. Older sessions in that classroom are archived with a timestamp slug, ensuring the newest live session retains the clean room URL.

---

## 6. Anti-Proxy Security & Device Fingerprinting

Implemented in `src/lib/device.ts` and `src/app/api/attend/[token]/route.ts`:

### Client-Side Browser Fingerprint:
Computes an identifier from browser/device attributes, which may include:
- User agent, screen resolution, color depth
- Hardware concurrency (CPU core count)
- Device memory (RAM bucket)
- Timezone offset & platform architecture
- Canvas 2D image rendering signature
- WebGL vendor and unmasked renderer string
- Web Audio API dynamics compressor latency

### Device Identification & Cookie Binding:
- Client computes `deviceFingerprint` hash.
- Server validates and sets an encrypted HTTP-only cookie `attendly_device_id` (1-year TTL).
- **Duplicate-device check**: If a second student submits an attendance scan using a matching `deviceId` or `deviceFingerprint` within the same session, the request may be rejected with `HTTP 403 (DEVICE_ALREADY_USED)` and logged to `UnrecognizedSubmission`. These identifiers are not tamper-proof and must not be treated as proof of identity.

---

## 7. Proximity Distance Telemetry Engine

Implemented in `src/lib/distance.ts` and `src/lib/networkGeo.ts`:

### Mathematical Formula:
Uses the **Haversine Great-Circle Distance** formula:
\[
d = 2r \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta \varphi}{2}\right) + \cos(\varphi_1) \cos(\varphi_2) \sin^2\left(\frac{\Delta \lambda}{2}\right)} \right)
\]
Where:
- \(\varphi_1, \varphi_2\) are the latitudes in radians.
- \(\Delta \varphi, \Delta \lambda\) are the differences in latitude and longitude.
- \(r = 6,371,000 \text{ meters}\) (mean radius of Earth).

### Hybrid Coordinate Fallback:
1. **Browser Geolocation**: Browser-provided location may be collected on student submission if available and permitted.
2. **Campus Reverse DNS**: The server may check reverse DNS hostnames when it can resolve the client address.
3. **IP geolocation fallback**: The current implementation may query `freeipapi.com` to estimate coordinates from an IP address. IP-based results can be inaccurate and involve an external service.
4. **Display**: Distance values are estimates and may be absent or inaccurate, especially when derived from an IP address. They are not proof of physical attendance.

---

## 8. Complete REST API Reference

All protected endpoints require NextAuth session cookies (`auth()`).

### Course Endpoints

#### `GET /api/courses`
Lists all courses owned by the authenticated professor.

#### `POST /api/courses`
Creates a new course.
- **Request Body**: `{ name: string, description?: string }`
- **Response**: `201 Created` with Course object.

#### `GET /api/courses/[id]`
Retrieves course details including enrolled students, sessions, and attendance counts.

#### `PATCH /api/courses/[id]`
Updates course name or description.

#### `DELETE /api/courses/[id]`
Deletes a course and cascades deletion to all students, sessions, and records.

#### `POST /api/courses/[id]/students`
Multipart file upload of student roster (`.xlsx`).
- **Form Fields**: `file` (binary), `preview` (`"true"` | `"false"`), `replace` (`"true"` | `"false"`).
- **Preview Response**: `{ validation: { valid: [], errors: [], duplicates: [] } }`
- **Commit Response**: `{ imported: number, skipped: number, duplicates: number }`

#### `POST /api/courses/[id]/students/manual`
Adds a single student manually without uploading an Excel file.
- **Request Body**: `{ name: string, email: string, group: string }`

#### `DELETE /api/courses/[id]/students/[studentId]`
Removes a student from the course roster.

#### `GET /api/courses/[id]/export`
Downloads complete semester attendance matrix as `.xlsx`.

---

### Session Endpoints

#### `GET /api/sessions`
Lists all sessions for the professor, optional `?courseId=` filter.

#### `POST /api/sessions`
Creates and launches an attendance session.
- **Request Body**:
  ```json
  {
    "courseId": "string",
    "name": "Lecture 1",
    "classroom": "Room 101",
    "date": "2026-10-22T10:00:00Z",
    "groups": ["Group A", "Group B"],
    "status": "open"
  }
  ```
- **Response**: `201 Created` with Session object and predefined `token` (e.g. `room-101`).

#### `GET /api/sessions/[id]`
Retrieves live session monitor state, enrolled roster, verified attendance, and rejected attempts.

#### `PATCH /api/sessions/[id]`
Updates session properties (e.g., toggling `status: "open"` or `"closed"`).

#### `DELETE /api/sessions/[id]`
Deletes the session and associated attendance records.

#### `POST /api/sessions/[id]/duplicate`
Clones an existing session structure with a fresh date and token.

#### `GET /api/sessions/[id]/qr`
Generates high-DPI QR code pointing to the live URL.
- **Response**:
  ```json
  {
    "qr": "data:image/png;base64,...",
    "url": "https://xyz.trycloudflare.com/attend/room-101",
    "token": "room-101"
  }
  ```

#### `GET /api/sessions/[id]/export`
Exports single-session attendance report as `.xlsx`.

#### `GET /api/sessions/[id]/stream`
Server-Sent Events endpoint streaming real-time attendance updates.

---

### Public Student Endpoints

#### `GET /api/attend/[token]`
Resolves session metadata for the student check-in header.
- **Response**: `{ courseName, sessionName, classroom, classroomSlug, date, status }`

#### `POST /api/attend/[token]`
Submits student attendance confirmation.
- **Request Body**:
  ```json
  {
    "email": "student@university.edu",
    "deviceId": "uuid",
    "deviceFingerprint": "sha256-hash",
    "lat": 44.3168,
    "lng": 23.8225
  }
  ```
- **Success Response (`200 OK`)**:
  ```json
  {
    "code": "SUCCESS",
    "message": "Attendance successfully recorded!",
    "student": { "name": "Alice Smith", "email": "alice@uni.edu", "group": "Group A" },
    "classroom": "Room 101",
    "distance": 14
  }
  ```
- **Error Codes**:
  - `400 EMAIL_REQUIRED` / `INVALID_EMAIL_FORMAT`
  - `403 SESSION_CLOSED`: Session is locked by instructor.
  - `403 GROUP_NOT_ALLOWED`: Student's group is not scheduled today.
  - `403 DEVICE_ALREADY_USED`: Phone was already used to check in someone else.
  - `404 NOT_IN_ROSTER`: Student is not enrolled in the course.
  - `429 RATE_LIMITED`: Exceeded attempt threshold (30 req / min).

---

## 9. Real-Time Telemetry & Server-Sent Events (SSE)

Located in `src/app/api/sessions/[id]/stream/route.ts`:
- Uses the native web `ReadableStream` API.
- Pushes JSON state every **2 seconds**:
  ```json
  data: {
    "status": "open",
    "enrolled": 50,
    "present": 42,
    "absent": 8,
    "rate": 84,
    "records": [
      {
        "id": "rec_123",
        "studentId": "stu_456",
        "name": "Alice Smith",
        "email": "alice@uni.edu",
        "group": "Group A",
        "checkInTime": "2026-10-22T10:14:02Z",
        "distance": 14,
        "city": "Campus"
      }
    ]
  }
  ```
- Handles client disconnection and cleanup via `req.signal.addEventListener('abort')`.

---

## 10. Excel Roster Parser & Report Generator

Located in `src/lib/excel.ts`:

### Intelligent Roster Parsing:
- Automatically detects column headers regardless of language or naming variation:
  - **Name**: `Name`, `Student Name`, `Full Name`, `Nume`
  - **Email**: `Email`, `University Email`, `Institutional Email`, `Mail`
  - **Group**: `Group`, `Subgroup`, `Section`, `Grupa`
- Automatically detects **transposed horizontal spreadsheets** (Row 1 = Names, Row 2 = Emails, Row 3 = Groups).
- Ignores empty rows, whitespace noise, and trailing symbols.

### Excel Export Features:
- **Styling**: Distinct navy academic header row (`#2563EB`) with white text and autofilters.
- **Conditional Formatting**: Present students highlighted in soft green (`#D1FAE5`), absent in soft red (`#FEE2E2`).
- **Telemetry Column**: Exact distance and registration timestamp formatted in local university time.

---

## 11. Electron Desktop Runtime

Located in `electron/main.js`:
- Single-instance mutex lock (`app.requestSingleInstanceLock()`).
- Hardware acceleration crash mitigation (`--disable-gpu`, `--disable-software-rasterizer`).
- Embedded server management: automatically spawns `next start` on Port 3000 and waits for health check before displaying the dashboard.
- System Tray menu with:
  - Running status indicator
  - 1-Click copy public Cloudflare tunnel URL
  - Direct browser launcher
  - Clean shutdown hooks

---

## 12. Worldwide Mobile Scanning & Cloudflare Tunneling

Located in `scripts/start-internet.js`:
- Spawns `npx --yes cloudflared tunnel --url http://localhost:3000`.
- Intercepts stdout to extract ephemeral URL (e.g. `https://random-id.trycloudflare.com`).
- Writes URL to `.tunnel_url`.
- QR generator reads `.tunnel_url` and embeds it directly into QR codes.
- Enables students on any cellular network (4G/5G) or outside Wi-Fi to scan seamlessly without NAT, routers, or port-forwarding.

---

## 13. Multi-Platform Deployment & Containers

### Windows
- **`Attendly.bat`**: Native Electron desktop app launcher.
- **`start.bat`**: Firewall-configured web launcher with Cloudflare tunnel.
- **`launch.bat`**: Universal terminal runner.
- **`stop.bat`**: Process cleanup utility.

### macOS & Linux
- **`start.sh`**: Self-bootstrapping shell script.
- **`stop.sh`**: Unix process killer.

### Docker
- **`Dockerfile`**: 4-stage minimal Alpine build.
- **`docker-compose.yml`**: Persistent volume container service on port 3000.

For any network-accessible deployment, replace the sample `NEXTAUTH_SECRET`, protect the host and database, and review how Cloudflare tunneling and IP geolocation affect student privacy. The quick tunnel URL is publicly reachable while active; it is not a private network boundary.

---

## 14. Automated Testing & Verification Suite

Execute tests via standard npm scripts:

```bash
# Run unit test suites (37 tests across 9 suites)
npm test

# Run code linter
npm run lint

# Run predefined classroom URL integration tests
npx tsx scripts/test-classroom-urls.ts

# Run end-to-end automated verification (33 tests)
npx tsx scripts/verify-all.ts
```

---

## 15. User & Beginner Tutorials

- For a step-by-step beginner tutorial on setting up Attendly on a fresh laptop, read:
  👉 **[TUTORIAL.md](TUTORIAL.md)**
- For day-to-day professor operational guidelines, read:
  👉 **[USER_GUIDE.md](USER_GUIDE.md)**

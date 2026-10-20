const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>QR Attendance System - Technical & Administrator Documentation</title>
  <style>
    @page {
      size: A4;
      margin: 18mm 16mm 20mm 16mm;
      @bottom-right {
        content: counter(page);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 9pt;
        color: #64748b;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.55;
      color: #1e293b;
      background-color: #ffffff;
      margin: 0;
      padding: 0;
    }

    /* Cover Page */
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      page-break-after: always;
      padding: 40px 20px 20px 20px;
    }

    .cover-top {
      border-top: 6px solid #2563eb;
      padding-top: 30px;
    }

    .cover-tag {
      display: inline-block;
      background-color: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
      font-size: 9pt;
      padding: 4px 12px;
      border-radius: 9999px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 20px;
      border: 1px solid #bfdbfe;
    }

    .cover-title {
      font-size: 34pt;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.15;
      margin: 0 0 16px 0;
      letter-spacing: -0.02em;
    }

    .cover-subtitle {
      font-size: 14pt;
      color: #475569;
      font-weight: 400;
      line-height: 1.5;
      max-width: 600px;
      margin: 0 0 30px 0;
    }

    .cover-meta {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      max-width: 550px;
    }

    .cover-meta-item strong {
      display: block;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
      margin-bottom: 4px;
    }

    .cover-meta-item span {
      font-size: 10.5pt;
      font-weight: 600;
      color: #1e293b;
    }

    .cover-footer {
      border-top: 1px solid #e2e8f0;
      padding-top: 20px;
      font-size: 9pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
    }

    /* Headings */
    h1, h2, h3, h4 {
      color: #0f172a;
      font-weight: 700;
      page-break-after: avoid;
    }

    h1 {
      font-size: 18pt;
      margin-top: 28px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 2px solid #e2e8f0;
      color: #1e3a8a;
    }

    .page-break {
      page-break-before: always;
    }

    h2 {
      font-size: 13pt;
      margin-top: 20px;
      margin-bottom: 8px;
      color: #1e293b;
    }

    h3 {
      font-size: 11pt;
      margin-top: 14px;
      margin-bottom: 6px;
    }

    p {
      margin: 0 0 10px 0;
    }

    /* Table styling */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 8.8pt;
      page-break-inside: avoid;
    }

    th {
      background-color: #f1f5f9;
      color: #0f172a;
      font-weight: 700;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #cbd5e1;
    }

    td {
      padding: 7px 10px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }

    tr:nth-child(even) td {
      background-color: #f8fafc;
    }

    /* Callout Boxes */
    .callout {
      border-radius: 8px;
      padding: 12px 16px;
      margin: 14px 0;
      font-size: 9pt;
      page-break-inside: avoid;
    }

    .callout-info {
      background-color: #eff6ff;
      border-left: 4px solid #3b82f6;
      color: #1e40af;
    }

    .callout-success {
      background-color: #f0fdf4;
      border-left: 4px solid #22c55e;
      color: #166534;
    }

    .callout-warning {
      background-color: #fffbeb;
      border-left: 4px solid #f59e0b;
      color: #92400e;
    }

    .callout-title {
      font-weight: 700;
      margin-bottom: 4px;
    }

    /* Code Blocks */
    pre {
      background-color: #0f172a;
      color: #e2e8f0;
      padding: 12px 14px;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8.2pt;
      line-height: 1.45;
      overflow-x: auto;
      margin: 12px 0;
      page-break-inside: avoid;
    }

    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 8.5pt;
      background-color: #f1f5f9;
      color: #0f172a;
      padding: 1px 4px;
      border-radius: 4px;
      border: 1px solid #e2e8f0;
    }

    pre code {
      background-color: transparent;
      color: inherit;
      padding: 0;
      border: none;
    }

    /* Diagrams & Badges */
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 8pt;
      font-weight: 600;
      margin-right: 4px;
    }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-green { background: #dcfce7; color: #15803d; }
    .badge-purple { background: #f3e8ff; color: #6b21a8; }

    ul, ol {
      margin: 0 0 12px 0;
      padding-left: 22px;
    }

    li {
      margin-bottom: 4px;
    }

    .diagram-box {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
      padding: 14px;
      margin: 12px 0;
      font-family: ui-monospace, monospace;
      font-size: 8pt;
      line-height: 1.4;
      white-space: pre;
    }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover-page">
    <div class="cover-top">
      <span class="cover-tag">Official Documentation</span>
      <h1 class="cover-title">QR Attendance System</h1>
      <p class="cover-subtitle">
        A full-stack, enterprise-grade attendance tracking solution designed for higher education institutions, featuring real-time monitoring, anti-proxy GPS geofencing, and zero-config worldwide mobile scanning.
      </p>

      <div class="cover-meta">
        <div class="cover-meta-item">
          <strong>Application Version</strong>
          <span>1.0.0 (Production Ready)</span>
        </div>
        <div class="cover-meta-item">
          <strong>Framework & Stack</strong>
          <span>Next.js 14, TypeScript, SQLite, Prisma</span>
        </div>
        <div class="cover-meta-item">
          <strong>Release Date</strong>
          <span>October 2026</span>
        </div>
        <div class="cover-meta-item">
          <strong>License & Cost</strong>
          <span>MIT License — 100% Free & Open Source</span>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <span>University QR Attendance Tracking System</span>
      <span>Confidential & Academic Use</span>
    </div>
  </div>

  <!-- SECTION 1: EXECUTIVE SUMMARY -->
  <div class="section">
    <h1>1. Executive Summary & System Overview</h1>
    <p>
      The <strong>QR Attendance System</strong> is a full-featured web application engineered to solve the operational bottlenecks of attendance tracking in modern university environments. In large auditorium lectures and laboratory sessions, traditional paper rosters suffer from severe flaws: lost teaching time, physical handling disruptions, illegible student handwriting, and rampant proxy signing by absent classmates.
    </p>
    <p>
      This platform completely modernizes university attendance with a frictionless, high-security digital workflow:
    </p>
    <ul>
      <li><strong>Professor Projects QR</strong>: The lecturer displays a dynamically generated cryptographic QR code on the lecture hall projection screen.</li>
      <li><strong>Student Scans via Phone</strong>: Students scan the code using the native camera app on any iOS or Android smartphone.</li>
      <li><strong>Smart Attendance Submission</strong>: The student enters their official university email and submits their location.</li>
      <li><strong>Anti-Proxy Geolocation</strong>: The server compares student GPS coordinates with the classroom's coordinates using the Haversine distance algorithm to ensure physical presence.</li>
      <li><strong>Real-Time Live Dashboard</strong>: Professor sees attendance count and student names appear live via Server-Sent Events (SSE).</li>
      <li><strong>Export to Excel</strong>: With one click, professors generate color-coded official university attendance sheets formatted as <code>.xlsx</code> spreadsheets.</li>
    </ul>

    <div class="callout callout-success">
      <div class="callout-title">100% Free & Self-Hosted</div>
      The entire platform is self-hosted on the professor's computer. It utilizes local embedded SQLite storage and Cloudflare's free public Quick Tunneling service. There are zero monthly subscription charges, zero cloud hosting fees, and zero vendor lock-in.
    </div>

    <h2>System Architecture Diagram</h2>
    <div class="diagram-box">
  +------------------------------------------------------------------------+
  |                   PROFESSOR WORKSTATION (WINDOWS)                      |
  |                                                                        |
  |   +-------------------+        +-----------------------------------+   |
  |   | Next.js App       | &lt;----&gt; | SQLite Database (dev.db via       |   |
  |   | Server (Port 3000)|        | Prisma ORM Client)                |   |
  |   +---------+---------+        +-----------------------------------+   |
  |             |                                                          |
  |   +---------v------------------------------------------------------+   |
  |   | Cloudflare Quick Tunnel Daemon (TryCloudflare HTTPS Bridge)     |   |
  |   +---------+------------------------------------------------------+   |
  +-------------|----------------------------------------------------------+
                |
                v  Secure Worldwide HTTPS Connection (https://*.trycloudflare.com)
  +------------------------------------------------------------------------+
  |                        STUDENT SMARTPHONES                             |
  |                                                                        |
  |   +-----------------------+              +-------------------------+   |
  |   | Student on Wi-Fi      |              | Student on Mobile Data  |   |
  |   | (Campus / External)   |              | (4G / 5G Cellular)      |   |
  |   +-----------------------+              +-------------------------+   |
  +------------------------------------------------------------------------+
    </div>
  </div>

  <!-- SECTION 2: AUTOMATION & LAUNCHER -->
  <div class="page-break"></div>
  <div class="section">
    <h1>2. Automated Windows Launcher & Network Setup</h1>
    <p>
      In educational environments, professors frequently lack administrative permissions to reconfigure campus network routers or execute complicated CLI commands. The system includes an automated, self-elevating launcher embedded in a single desktop shortcut:
    </p>

    <h2>The Single Desktop Shortcut (<code>QR Attendance System.lnk</code>)</h2>
    <p>
      Double-clicking the shortcut executes <code>start.bat</code> with administrative privileges. The launcher performs four automated tasks in sequence:
    </p>

    <table>
      <thead>
        <tr>
          <th>Step</th>
          <th>Component</th>
          <th>Technical Action</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1. Elevation</strong></td>
          <td>Windows UAC</td>
          <td>Detects whether process is elevated. If not, requests elevation via PowerShell (<code>Start-Process -Verb RunAs</code>).</td>
        </tr>
        <tr>
          <td><strong>2. Firewall</strong></td>
          <td>Windows Defender</td>
          <td>Unblocks <code>node.exe</code> across all network profiles (Domain, Private, Public) and opens inbound TCP Port 3000.</td>
        </tr>
        <tr>
          <td><strong>3. Wi-Fi Profile</strong></td>
          <td>Network Interface</td>
          <td>Switches active Wi-Fi profile from Public to Private to allow cross-device communication.</td>
        </tr>
        <tr>
          <td><strong>4. Co-Runner</strong></td>
          <td>Internet Runner</td>
          <td>Spawns Next.js in production mode and simultaneously initializes the Cloudflare Quick Tunnel.</td>
        </tr>
      </tbody>
    </table>

    <div class="callout callout-info">
      <div class="callout-title">Worldwide Mobile Scanning via Cloudflare Quick Tunnel</div>
      To allow students connected to cellular networks (4G/5G) or other university Wi-Fi subnets to reach the local server, <code>scripts/start-internet.js</code> spawns Cloudflare's tunneling daemon. It captures the assigned public HTTPS address (e.g. <code>https://alpha-beta.trycloudflare.com</code>) and writes it into <code>.tunnel_url</code>. All generated QR codes immediately encode this public HTTPS address.
    </div>

    <h2>Stopping the Server (<code>stop.bat</code>)</h2>
    <p>
      To terminate background Node and tunnel processes cleanly, double-click <code>stop.bat</code> or press <code>Ctrl+C</code> in the console window.
    </p>
  </div>

  <!-- SECTION 3: EXCEL ROSTER & GROUP MANAGEMENT -->
  <div class="page-break"></div>
  <div class="section">
    <h1>3. Student Rosters & Group Management</h1>
    <p>
      Courses are populated by importing standard Microsoft Excel spreadsheets (<code>.xlsx</code>). The parser is designed with fault-tolerant heuristics to accommodate real-world university formatting.
    </p>

    <h2>Excel Roster Structure</h2>
    <p>
      The spreadsheet requires three data columns (either vertical columns or horizontal rows):
    </p>

    <table>
      <thead>
        <tr>
          <th>Column</th>
          <th>Accepted Headers</th>
          <th>Description & Examples</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>1st Column</strong></td>
          <td><code>Student Name</code>, <code>Name</code>, <code>THE Name</code>, <code>Nume</code></td>
          <td>Full name of the student (e.g., <code>Alice Johnson</code>, <code>Popescu Andrei</code>).</td>
        </tr>
        <tr>
          <td><strong>2nd Column</strong></td>
          <td><code>University Email</code>, <code>Email</code>, <code>imai</code>, <code>Mail</code></td>
          <td>Unique institutional email address (e.g., <code>andrei.popescu@univ.ro</code>). Normalized automatically.</td>
        </tr>
        <tr>
          <td><strong>3rd Column</strong></td>
          <td><code>Group</code>, <code>Groups</code>, <code>Grupa</code>, <code>Subgroup</code></td>
          <td>University subgroup or lab section (e.g., <code>AIA 3.3A</code>, <code>AIA 3.1 B</code>, <code>ELA 2.2 A</code>).</td>
        </tr>
      </tbody>
    </table>

    <h2>Real-World Engineering Subgroups Support</h2>
    <p>
      Subgroups can be formatted in any manner with spaces, dots, and alphanumeric letters:
    </p>
    <div class="diagram-box">
  +---------------------+-----------------------------------+-------------+
  | Student Name        | University Email                  | Group       |
  +---------------------+-----------------------------------+-------------+
  | Popescu Andrei      | andrei.popescu@student.univ.ro    | AIA 3.3A    |
  | Ionescu Maria       | maria.ionescu@student.univ.ro     | AIA 3.1 B   |
  | Radu Cristian       | cristian.radu@student.univ.ro     | ELA 2.2 A   |
  | Dumitrescu Elena    | elena.dumitrescu@student.univ.ro  | AIA 3.2 A   |
  | Stan Alexandru      | alexandru.stan@student.univ.ro    | ELA 2.1 B   |
  +---------------------+-----------------------------------+-------------+
    </div>

    <h2>Smart Import Capabilities</h2>
    <ul>
      <li><strong>Pre-Import Validation Preview</strong>: Inspect valid records, syntax errors, and duplicate entries before writing to the database.</li>
      <li><strong>Automatic Column Fallback</strong>: If header names are non-standard or missing, the system automatically inspects row data and maps Column 1 &rarr; Name, Column 2 &rarr; Email, Column 3 &rarr; Group.</li>
      <li><strong>Transposed (Horizontal) Table Support</strong>: If a professor prepares a table where Row 1 is Names, Row 2 is Emails, and Row 3 is Groups, the parser detects this and imports seamlessly.</li>
      <li><strong>One-Click Template Download</strong>: A pre-formatted Excel template can be downloaded directly from the dashboard under <em>Course &rarr; Import Excel &rarr; Download Template (.xlsx)</em>.</li>
    </ul>
  </div>

  <!-- SECTION 4: ANTI-PROXY GPS & ATTENDANCE SESSIONS -->
  <div class="page-break"></div>
  <div class="section">
    <h1>4. Anti-Proxy Security & Attendance Sessions</h1>
    <p>
      Traditional QR systems fail when a student in class takes a photo of the projected QR code and sends it via WhatsApp or Telegram to absent friends. The QR Attendance System incorporates multi-layered security to block remote proxy check-ins.
    </p>

    <h2>1. GPS Geolocation Geofencing</h2>
    <p>
      When creating an attendance session, professors can enable the <strong>Classroom GPS Geofence</strong>:
    </p>
    <ul>
      <li><strong>One-Click Classroom Capture</strong>: The professor clicks <em>"Detect Classroom Location"</em> in the web browser. The system queries high-accuracy HTML5 Geolocation and stores latitude, longitude, and radius.</li>
      <li><strong>Student Location Verification</strong>: Upon loading <code>/attend/[token]</code>, the student's browser must provide location coordinates.</li>
      <li><strong>Haversine Formula Distance Verification</strong>: The server computes the spherical distance between the classroom and the student:</li>
    </ul>

    <pre><code>function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a = Math.sin(deltaPhi / 2) ** 2 +
            Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}</code></pre>

    <p>
      If the calculated distance exceeds the configured radius (e.g., 50 meters), the request is rejected with an out-of-classroom boundary alert.
    </p>

    <h2>2. Cryptographic Ephemeral Tokens</h2>
    <p>
      Each session is generated with a unique, cryptographically random CUID token. Only this token is embedded in the QR code. The internal database ID and professor administrative URLs are never exposed.
    </p>

    <h2>3. Targeted Subgroup Enforcement</h2>
    <p>
      Sessions can be targeted to specific groups (e.g. only <code>AIA 3.3A</code> and <code>ELA 2.2 A</code>). If a student enrolled in <code>AIA 3.1 B</code> attempts to register, the server prevents the submission and displays an informative notification.
    </p>
  </div>

  <!-- SECTION 5: LIVE MONITORING & EXPORT -->
  <div class="page-break"></div>
  <div class="section">
    <h1>5. Real-Time Live Monitoring & Reporting</h1>

    <h2>Real-Time Server-Sent Events (SSE)</h2>
    <p>
      During class, the professor opens the session dashboard at <code>/dashboard/sessions/[id]</code>. The frontend establishes a persistent Server-Sent Events stream with <code>/api/sessions/[id]/stream</code>:
    </p>
    <ul>
      <li><strong>Live Roster Updates</strong>: As students submit attendance, their name, group, and check-in timestamp populate the live table in real time.</li>
      <li><strong>Live Metrics</strong>: Real-time calculation of Enrolled Students, Present Count, Absent Count, and Attendance Percentage.</li>
      <li><strong>Instant Session Toggle</strong>: The professor can close or reopen registration with a single click, immediately locking out late arrivals.</li>
    </ul>

    <h2>Projection & Fullscreen Mode</h2>
    <p>
      The QR presentation modal features a dedicated <strong>Fullscreen Mode</strong> designed specifically for classroom video projectors:
    </p>
    <ul>
      <li>High-contrast vector rendering ensures sharp focus at distances up to 30 meters.</li>
      <li>Displays real-time present count beneath the QR code so the professor and students can track check-in progress.</li>
    </ul>

    <h2>Comprehensive Excel Export</h2>
    <p>
      Attendance records can be exported to Excel at any time:
    </p>
    <table>
      <thead>
        <tr>
          <th>Export Type</th>
          <th>Endpoint</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>Single Session</strong></td>
          <td><code>/api/sessions/[id]/export</code></td>
          <td>Outputs an <code>.xlsx</code> file containing all enrolled students for that session with status (Present in green, Absent in red) and exact check-in timestamps.</td>
        </tr>
        <tr>
          <td><strong>Full Course Roster</strong></td>
          <td><code>/api/courses/[id]/export</code></td>
          <td>Generates a comprehensive multi-session aggregate report across all lectures and labs in the semester.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SECTION 6: API REFERENCE & SCHEMA -->
  <div class="page-break"></div>
  <div class="section">
    <h1>6. REST API & Database Reference</h1>

    <h2>Core API Endpoints</h2>
    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th>Endpoint</th>
          <th>Access</th>
          <th>Functionality</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>POST</code></td>
          <td><code>/api/auth/[...nextauth]</code></td>
          <td>Public</td>
          <td>Handles professor credentials login, bcrypt password check, and JWT session issuance.</td>
        </tr>
        <tr>
          <td><code>GET</code></td>
          <td><code>/api/courses</code></td>
          <td>Professor</td>
          <td>Returns list of all courses owned by authenticated professor with student counts.</td>
        </tr>
        <tr>
          <td><code>POST</code></td>
          <td><code>/api/courses/[id]/students</code></td>
          <td>Professor</td>
          <td>Uploads and parses an Excel (<code>.xlsx</code>) student roster with validation preview.</td>
        </tr>
        <tr>
          <td><code>GET</code></td>
          <td><code>/api/courses/template</code></td>
          <td>Public</td>
          <td>Downloads standard pre-configured student roster Excel template.</td>
        </tr>
        <tr>
          <td><code>POST</code></td>
          <td><code>/api/sessions</code></td>
          <td>Professor</td>
          <td>Creates a new attendance session with targeted groups, date, and GPS coordinates.</td>
        </tr>
        <tr>
          <td><code>GET</code></td>
          <td><code>/api/sessions/[id]/qr</code></td>
          <td>Professor</td>
          <td>Returns base64 QR code image data URL and resolved public attendance link.</td>
        </tr>
        <tr>
          <td><code>GET</code></td>
          <td><code>/api/sessions/[id]/stream</code></td>
          <td>Professor</td>
          <td>Server-Sent Events (SSE) live push stream for real-time attendance monitor.</td>
        </tr>
        <tr>
          <td><code>POST</code></td>
          <td><code>/api/attend/[token]</code></td>
          <td>Public</td>
          <td>Validates student email, group assignment, session status, and GPS boundary.</td>
        </tr>
      </tbody>
    </table>

    <h2>Database Entity Model (Prisma / SQLite)</h2>
    <div class="diagram-box">
  Professor (1) ---------&lt; Course (N)
                             |
                             +---------&lt; Student (N)
                             |             |
                             +---------&lt; Session (N)
                                           |
                                           +---------&lt; AttendanceRecord (N)
                                           +---------&lt; VerificationToken (N)
                                           +---------&lt; UnrecognizedSubmission (N)
    </div>
    <p>
      The local SQLite database resides at <code>prisma/dev.db</code>. Backups can be taken simply by copying this single file.
    </p>

    <div class="callout callout-warning">
      <div class="callout-title">Security & Production Recommendations</div>
      Before deploying in a production university environment, generate a cryptographically strong <code>NEXTAUTH_SECRET</code> using:
      <code>node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"</code>
      and change the default <code>SETUP_KEY</code> in <code>.env</code>.
    </div>
  </div>

</body>
</html>`;

async function main() {
  const docsDir = path.join(process.cwd(), 'docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  const htmlPath = path.join(docsDir, 'documentation.html');
  const pdfPath = path.join(process.cwd(), 'QR_Attendance_System_Documentation.pdf');

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('Written documentation HTML to', htmlPath);

  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  if (!fs.existsSync(edgePath)) {
    throw new Error('Edge executable not found at: ' + edgePath);
  }

  console.log('Generating PDF via headless Microsoft Edge...');
  const args = [
    '--headless',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${pdfPath}`,
    `file:///${htmlPath.replace(/\\/g, '/')}`,
  ];

  const result = spawnSync(edgePath, args, { stdio: 'inherit' });
  if (result.error) throw result.error;

  if (fs.existsSync(pdfPath)) {
    const stats = fs.statSync(pdfPath);
    console.log(`\nSUCCESS: Generated documentation PDF!`);
    console.log(`Path: ${pdfPath}`);
    console.log(`Size: ${(stats.size / 1024).toFixed(1)} KB`);
  } else {
    throw new Error('PDF output file was not created.');
  }
}

main().catch((err) => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});

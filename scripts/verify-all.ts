import { PrismaClient } from '@prisma/client';
import http from 'http';
import { buildAttendanceExcel, buildMultiSessionExcel } from '../src/lib/excel';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

function get(url: string): Promise<{ status: number; data: string; contentType?: string }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () =>
        resolve({
          status: res.statusCode || 0,
          data,
          contentType: res.headers['content-type'],
        })
      );
    });
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
  });
}

function post(url: string, body: unknown): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const req = http.request(
      {
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, json: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode || 0, json: { raw: data } });
          }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error(`Timeout posting to ${url}`));
    });
    req.write(payload);
    req.end();
  });
}

async function runVerification() {
  console.log('========================================================');
  console.log('ATTENDLY — END-TO-END AUTOMATED VERIFICATION');
  console.log('========================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(cond: boolean, desc: string) {
    if (cond) {
      console.log(`  [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${desc}`);
      failed++;
    }
  }

  // 1. Health check
  console.log('--- 1. Server Health Check ---');
  try {
    const health = await get('http://127.0.0.1:3000/api/health');
    assert(health.status === 200, 'GET /api/health returns 200 OK');
    const hData = JSON.parse(health.data);
    assert(hData.ok === true, 'Health reports ok: true');
    assert(hData.db === 'ok', 'Database connection reports ok');
  } catch (err: any) {
    assert(false, `Health check request failed: ${err.message}`);
  }

  // 2. Auth & Protected Routes
  console.log('\n--- 2. Route Protection ---');
  try {
    const unauthCourses = await get('http://127.0.0.1:3000/api/courses');
    assert(unauthCourses.status === 401, 'GET /api/courses blocks unauthenticated users (401)');

    const unauthSessions = await get('http://127.0.0.1:3000/api/sessions');
    assert(unauthSessions.status === 401, 'GET /api/sessions blocks unauthenticated users (401)');
  } catch (err: any) {
    assert(false, `Route protection check failed: ${err.message}`);
  }

  // 3. Database Professor & Account Integrity
  console.log('\n--- 3. Database Professor & Account Integrity ---');
  try {
    const prof = await prisma.professor.findUnique({
      where: { email: 'prof@university.edu' },
      include: { courses: { include: { students: true, sessions: true } } },
    });
    assert(prof !== null, 'Demo professor found in database');
    assert(typeof prof?.passwordHash === 'string' && prof.passwordHash.length > 0, 'Professor has valid encrypted password');
    assert(prof?.email === 'prof@university.edu', 'Professor email is prof@university.edu');
  } catch (err: any) {
    assert(false, `Database query failed: ${err.message}`);
  }

  // 4. Excel Generation Verification
  console.log('\n--- 4. Excel Export Verification ---');
  try {
    const testStudents = [
      { name: 'Andrei Popescu', email: 'andrei@student.upt.ro', group: 'AIA 3.3A' },
      { name: 'Maria Ionescu', email: 'maria@student.upt.ro', group: 'AIA 3.1 B' },
      { name: 'Cristian Radu', email: 'cristian@student.upt.ro', group: 'AIA 3.3A' },
    ];
    const testAttendance = new Map([
      [
        'andrei@student.upt.ro',
        {
          verifiedAt: new Date(),
          status: 'verified',
          distanceMeters: 200000,
          studentCity: 'Timisoara',
        },
      ],
      [
        'maria@student.upt.ro',
        {
          verifiedAt: new Date(),
          status: 'verified',
          distanceMeters: 14,
          studentCity: 'Craiova',
        },
      ],
    ]);

    const excelBuf = await buildAttendanceExcel({
      students: testStudents,
      attendance: testAttendance,
      courseName: 'Embedded Systems',
      sessionDate: new Date(),
      sessionName: 'Lab 1',
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(excelBuf as any);
    const sheet = wb.worksheets[0];

    const headers: string[] = [];
    sheet.getRow(1).eachCell((c) => headers.push(String(c.value)));
    assert(headers.includes('Student Full Name'), 'Excel contains "Student Full Name" header');
    assert(headers.includes('Attendance Status'), 'Excel contains "Attendance Status" header');
    assert(headers.includes('Scan Distance'), 'Excel contains "Scan Distance" header');

    const row2Status = sheet.getRow(2).getCell(6).value;
    assert(String(row2Status) === 'Present', 'Row 2 status is Present');
    const row2Distance = sheet.getRow(2).getCell(8).value;
    assert(String(row2Distance) === '200 km', 'Row 2 distance is 200 km');

    const row3Distance = sheet.getRow(3).getCell(8).value;
    assert(String(row3Distance) === '14 m', 'Row 3 distance is 14 m');

    const row4Distance = sheet.getRow(4).getCell(8).value;
    assert(String(row4Distance) === '—', 'Row 4 absent student distance is —');
  } catch (err: any) {
    assert(false, `Excel generation check failed: ${err.message}`);
  }

  // 5. Attendance Check-in API Verification
  console.log('\n--- 5. Attendance Check-in API & Security Tests ---');
  try {
    const prof = await prisma.professor.findUnique({
      where: { email: 'prof@university.edu' },
      include: { courses: true },
    });
    let course = prof!.courses[0];
    let createdCourse = false;
    if (!course) {
      course = await prisma.course.create({
        data: {
          name: 'Verification Test Course',
          professorId: prof!.id,
        },
      });
      createdCourse = true;
    }

    // Create a temporary test student
    const testStudentEmail = `student.test.${Date.now()}@student.upt.ro`;
    const student = await prisma.student.create({
      data: {
        name: 'Student Test QR',
        email: testStudentEmail,
        group: 'AIA 3.3A',
        courseId: course.id,
      },
    });

    // Create a Session with host coordinates in Craiova
    const testSession = await prisma.session.create({
      data: {
        name: 'QR Attendance Verification Test',
        courseId: course.id,
        date: new Date(),
        groups: 'AIA 3.3A',
        hostLat: 44.3168,
        hostLng: 23.8225,
        hostCity: 'Craiova',
      },
    });

    // Test GET /api/attend/[token]
    const metaRes = await get(`http://127.0.0.1:3000/api/attend/${testSession.token}`);
    assert(metaRes.status === 200, 'GET /api/attend/[token] responds 200 OK');
    const meta = JSON.parse(metaRes.data);
    assert(meta.courseName === course.name, 'Returns correct courseName');

    // Test POST check-in with coords (room distance ~14m) -> success
    const checkinRes = await post(`http://127.0.0.1:3000/api/attend/${testSession.token}`, {
      email: testStudentEmail,
      deviceId: 'device-test-1',
      deviceFingerprint: 'fp-1',
      coords: { latitude: 44.3169, longitude: 23.8226 },
    });
    assert(checkinRes.status === 200, 'Student check-in succeeds with 200 OK');
    assert(checkinRes.json.code === 'SUCCESS', 'Check-in code is SUCCESS');
    assert(typeof checkinRes.json.distance === 'number', 'Check-in returns distance telemetry');
    assert(checkinRes.json.distance < 60, `Distance is accurately computed in room (~${checkinRes.json.distance}m)`);

    // Verify remote scan (e.g. Timisoara) is NOT blocked and distance is reported
    const remoteStudentEmail = `remote.${Date.now()}@student.upt.ro`;
    const remoteStudent = await prisma.student.create({
      data: {
        name: 'Remote Student',
        email: remoteStudentEmail,
        group: 'AIA 3.3A',
        courseId: course.id,
      },
    });
    const remoteRes = await post(`http://127.0.0.1:3000/api/attend/${testSession.token}`, {
      email: remoteStudentEmail,
      deviceId: 'device-remote-1',
      deviceFingerprint: 'fp-remote',
      coords: { latitude: 45.7537, longitude: 21.2257 }, // Timisoara coords
    });
    assert(remoteRes.status === 200, 'Remote student check-in is NOT blocked (200 OK)');
    assert(remoteRes.json.code === 'SUCCESS', 'Remote check-in code is SUCCESS');
    assert(remoteRes.json.distance > 150000, `Distance telemetry reports remote distance (~${Math.round(remoteRes.json.distance / 1000)} km)`);

    // Test Duplicate check-in with same email
    const dupRes = await post(`http://127.0.0.1:3000/api/attend/${testSession.token}`, {
      email: testStudentEmail,
      deviceId: 'device-test-1',
      deviceFingerprint: 'fp-1',
    });
    assert(dupRes.status === 200 && dupRes.json.code === 'ALREADY_CHECKED_IN', 'Duplicate scan returns ALREADY_CHECKED_IN without error');

    // Test Single-Device Anti-Proxy protection (second student on same device)
    const secondStudentEmail = `student.second.${Date.now()}@student.upt.ro`;
    await prisma.student.create({
      data: {
        name: 'Second Student',
        email: secondStudentEmail,
        group: 'AIA 3.3A',
        courseId: course.id,
      },
    });

    const proxyRes = await post(`http://127.0.0.1:3000/api/attend/${testSession.token}`, {
      email: secondStudentEmail,
      deviceId: 'device-test-1', // Same device ID!
      deviceFingerprint: 'fp-1',
    });
    assert(proxyRes.status === 403, 'Anti-proxy protection blocks second student on same device (403 Forbidden)');
    assert(proxyRes.json.code === 'DEVICE_ALREADY_USED', 'Rejection reason is DEVICE_ALREADY_USED');

    // Test Unknown Student (NOT_IN_ROSTER)
    const unknownRes = await post(`http://127.0.0.1:3000/api/attend/${testSession.token}`, {
      email: 'intruder@unknown.com',
      deviceId: 'device-intruder',
      deviceFingerprint: 'fp-intruder',
    });
    assert(unknownRes.status === 404, 'Unknown student is rejected with 404 Not Found');
    assert(unknownRes.json.code === 'NOT_IN_ROSTER', 'Rejection code is NOT_IN_ROSTER');

    // Test Wrong Group (GROUP_NOT_ALLOWED)
    const wrongGroupStudentEmail = `wrong.group.${Date.now()}@student.upt.ro`;
    const wrongGroupStudent = await prisma.student.create({
      data: {
        name: 'Wrong Group Student',
        email: wrongGroupStudentEmail,
        group: 'OTHER 9.9X', // Session is scheduled only for AIA 3.3A
        courseId: course.id,
      },
    });
    const wrongGroupRes = await post(`http://127.0.0.1:3000/api/attend/${testSession.token}`, {
      email: wrongGroupStudentEmail,
      deviceId: 'device-wrong-group',
      deviceFingerprint: 'fp-wrong-group',
    });
    assert(wrongGroupRes.status === 403, 'Student with wrong group is rejected with 403 Forbidden');
    assert(wrongGroupRes.json.code === 'GROUP_NOT_ALLOWED', 'Rejection code is GROUP_NOT_ALLOWED');

    // Test Session Closed (SESSION_CLOSED)
    await prisma.session.update({
      where: { id: testSession.id },
      data: { status: 'closed' },
    });
    const closedRes = await post(`http://127.0.0.1:3000/api/attend/${testSession.token}`, {
      email: testStudentEmail,
      deviceId: 'device-test-1',
      deviceFingerprint: 'fp-1',
    });
    assert(closedRes.status === 403, 'Closed session rejects check-in with 403 Forbidden');
    assert(closedRes.json.code === 'SESSION_CLOSED', 'Rejection code is SESSION_CLOSED');

    // Clean up test fixtures
    await prisma.session.delete({ where: { id: testSession.id } });
    await prisma.student.deleteMany({ where: { id: { in: [student.id, remoteStudent.id, wrongGroupStudent.id] } } });
    if (createdCourse) {
      await prisma.course.delete({ where: { id: course.id } });
    }
    console.log('  Cleaned up temporary test fixtures.');
  } catch (err: any) {
    assert(false, `Attendance API flow failed: ${err.message}`);
  }

  console.log('\n========================================================');
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================\n');

  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

runVerification().catch((e) => {
  console.error('Fatal verification error:', e);
  process.exit(1);
});

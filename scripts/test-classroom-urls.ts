import { PrismaClient } from '@prisma/client';
import http from 'http';

const prisma = new PrismaClient();

function get(url: string): Promise<{ status: number; json: any }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode || 0, json: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode || 0, json: { raw: data } });
        }
      });
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

async function main() {
  console.log('Testing predefined classroom attendance URLs...\n');

  // Find or create test professor and course
  const course = await prisma.course.findFirst({
    include: { students: true },
  });

  if (!course || course.students.length === 0) {
    console.error('No course or students found in DB. Run seed or setup first.');
    process.exit(1);
  }

  const testStudent = course.students[0];

  // 1. Create a session bound to "Auditorium A1"
  const roomName = 'Auditorium A1';
  const roomSlug = 'auditorium-a1';

  // Clean any previous test sessions with this token
  await prisma.session.deleteMany({
    where: { token: roomSlug },
  });

  const session = await prisma.session.create({
    data: {
      courseId: course.id,
      name: 'Classroom Test Lecture',
      date: new Date(),
      groups: testStudent.group,
      classroom: roomName,
      token: roomSlug,
      status: 'open',
    },
  });

  console.log(`Created test session in classroom "${roomName}" with predefined token "${roomSlug}".`);

  // 2. Test GET via slug
  const getRes1 = await get(`http://127.0.0.1:3000/api/attend/${roomSlug}`);
  console.log(`GET /api/attend/${roomSlug}: Status ${getRes1.status}`);
  if (getRes1.status !== 200 || getRes1.json.classroom !== roomName) {
    throw new Error(`Failed to resolve session via ${roomSlug}: ${JSON.stringify(getRes1.json)}`);
  }
  console.log('  -> Correctly resolved classroom:', getRes1.json.classroom);

  // 3. Test GET via raw room name (URL encoded)
  const encodedRoom = encodeURIComponent(roomName);
  const getRes2 = await get(`http://127.0.0.1:3000/api/attend/${encodedRoom}`);
  console.log(`GET /api/attend/${encodedRoom}: Status ${getRes2.status}`);
  if (getRes2.status !== 200) {
    throw new Error(`Failed to resolve session via raw room name: ${JSON.stringify(getRes2.json)}`);
  }
  console.log('  -> Correctly resolved classroom via raw name:', getRes2.json.classroom);

  // 4. Test Student POST check-in via predefined classroom URL
  const postRes = await post(`http://127.0.0.1:3000/api/attend/${roomSlug}`, {
    email: testStudent.email,
    deviceId: 'test-device-room-1',
  });
  console.log(`POST /api/attend/${roomSlug}: Status ${postRes.status}, code: ${postRes.json.code}`);
  if (postRes.status !== 200 || (postRes.json.code !== 'SUCCESS' && postRes.json.code !== 'ALREADY_CHECKED_IN')) {
    throw new Error(`Student check-in failed: ${JSON.stringify(postRes.json)}`);
  }
  console.log('  -> Check-in successful! Classroom:', postRes.json.classroom);

  // 5. Test closed session response
  await prisma.session.update({
    where: { id: session.id },
    data: { status: 'closed' },
  });

  const closedPostRes = await post(`http://127.0.0.1:3000/api/attend/${roomSlug}`, {
    email: testStudent.email,
    deviceId: 'test-device-room-2',
  });
  console.log(`POST closed session: Status ${closedPostRes.status}, code: ${closedPostRes.json.code}`);
  if (closedPostRes.status !== 403 || closedPostRes.json.code !== 'SESSION_CLOSED') {
    throw new Error(`Expected 403 SESSION_CLOSED, got: ${JSON.stringify(closedPostRes.json)}`);
  }
  console.log('  -> Correctly received SESSION_CLOSED error:', closedPostRes.json.error);

  // Clean up
  await prisma.session.delete({ where: { id: session.id } });
  console.log('\nAll predefined classroom URL integration tests PASSED successfully!');
}

main()
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

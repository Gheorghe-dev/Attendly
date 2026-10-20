// Geolocation end-to-end smoke test
const { PrismaClient } = require('@prisma/client');

(async () => {
  const base = 'http://localhost:3000';
  const prisma = new PrismaClient();

  // sign in
  const csrfRes = await fetch(`${base}/api/auth/csrf`);
  let cookieJar = (csrfRes.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
  const { csrfToken } = await csrfRes.json();
  const cb = await fetch(`${base}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookieJar },
    body: `email=prof%40university.edu&password=professor123&csrfToken=${csrfToken}`,
    redirect: 'manual',
  });
  cookieJar = [cookieJar, ...(cb.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0])].filter(Boolean).join('; ');

  // Use the existing Mathematics 101 course
  const course = (await (await fetch(`${base}/api/courses`, { headers: { cookie: cookieJar } })).json())
    .find(c => c.name === 'Mathematics 101');
  if (!course) { console.log('no Mathematics 101 course'); process.exit(1); }
  console.log(`course: ${course.name}`);

  // Pick a student from the roster that has a valid email
  const students = await prisma.student.findMany({ where: { courseId: course.id }, take: 2 });
  if (students.length < 2) { console.log('not enough students'); process.exit(1); }
  const inside = students[0];   // we'll pretend they're inside the classroom
  const outside = students[1];  // and this one is far away
  console.log(`inside student:  ${inside.email}`);
  console.log(`outside student: ${outside.email}`);

  // Classroom: somewhere in Iasi (UAIC area), 50m radius
  const classroomLat = 47.1572;
  const classroomLng = 27.6038;
  const classroomRadius = 50;

  // Create the session with classroom location
  const session = await (await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({
      courseId: course.id,
      name: 'Geo Test',
      date: new Date().toISOString(),
      groups: [inside.group, outside.group],
      status: 'open',
      classroomLat, classroomLng, classroomRadius,
    }),
  })).json();
  console.log(`session: ${session.id}, classroom at ${session.classroomLat},${session.classroomLng} r=${session.classroomRadius}`);

  // Inside student submits from a few meters away
  const insideGeo = { lat: classroomLat + 0.0001, lng: classroomLng + 0.0001, accuracy: 10 };
  const r1 = await fetch(`${base}/api/attend/${session.token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: inside.email, geolocation: insideGeo }),
  });
  const j1 = await r1.json();
  console.log(`inside  POST -> ${r1.status} ${j1.message || j1.error}`);

  // Outside student submits from ~5 km away (Bucharest area for the test)
  const outsideGeo = { lat: 44.4268, lng: 26.1025, accuracy: 50 };
  const r2 = await fetch(`${base}/api/attend/${session.token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: outside.email, geolocation: outsideGeo }),
  });
  const j2 = await r2.json();
  console.log(`outside POST -> ${r2.status} ${j2.message || j2.error}`);

  // Wait for SMTP to (fail) then manually verify the tokens via the DB
  await new Promise(r => setTimeout(r, 500));
  const tokens = await prisma.verificationToken.findMany({ where: { sessionId: session.id } });
  console.log(`verification tokens created: ${tokens.length}`);

  for (const t of tokens) {
    const r = await fetch(`${base}/api/verify?token=${t.token}`);
    const j = await r.json();
    console.log(`verify (${t.email}) -> ${r.status}  ${j.message || j.error}  distance=${j.distanceMeters}m`);
  }

  // Read the session detail and dump distances
  const detail = await (await fetch(`${base}/api/sessions/${session.id}`, { headers: { cookie: cookieJar } })).json();
  console.log('\n--- Session detail (per-attendance distances) ---');
  for (const a of detail.attendance) {
    console.log(`  ${a.student.email}: status=${a.status} lat=${a.studentLat} lng=${a.studentLng} distance=${a.distanceMeters}m`);
  }
  console.log(`classroom set: ${detail.classroomLat},${detail.classroomLng} r=${detail.classroomRadius}m`);

  // Cleanup
  await prisma.session.delete({ where: { id: session.id } });
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

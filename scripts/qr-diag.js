// Round-2 QR diagnostic: verify QR uses request URL origin
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { PrismaClient } = require('@prisma/client');

(async () => {
  const localhost = 'http://localhost:3000';
  const lanIp = 'http://192.168.10.206:3000';
  const prisma = new PrismaClient();

  // sign in
  const csrfRes = await fetch(`${localhost}/api/auth/csrf`);
  let cookieJar = (csrfRes.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
  const { csrfToken } = await csrfRes.json();
  const callbackRes = await fetch(`${localhost}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookieJar },
    body: `email=prof%40university.edu&password=professor123&csrfToken=${csrfToken}`,
    redirect: 'manual',
  });
  cookieJar = [cookieJar, ...(callbackRes.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0])].filter(Boolean).join('; ');

  const courses = await (await fetch(`${localhost}/api/courses`, { headers: { cookie: cookieJar } })).json();
  const course = courses[0];
  console.log(`course: ${course.name} = ${course.id}`);

  const session = await (await fetch(`${localhost}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({
      courseId: course.id,
      name: 'QR Origin Test',
      date: new Date().toISOString(),
      groups: ['AIA3.1'],
      status: 'open',
    }),
  })).json();
  console.log(`session: ${session.id}`);

  // QR via localhost
  const qr1 = await (await fetch(`${localhost}/api/sessions/${session.id}/qr`, { headers: { cookie: cookieJar } })).json();
  console.log(`QR via localhost: ${qr1.url}`);

  // QR via LAN IP (simulate phone access)
  const qr2Res = await fetch(`${lanIp}/api/sessions/${session.id}/qr`, { headers: { cookie: cookieJar, host: '192.168.10.206:3000' } });
  const qr2 = await qr2Res.json();
  console.log(`QR via LAN IP:    ${qr2.url}`);
  console.log(`  → QR code now points to ${qr2.url}`);

  // Decode the LAN QR
  const b64 = qr2.qr.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  const { PNG } = require('pngjs');
  const png = PNG.sync.read(buf);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  console.log(`Decoded QR:      ${decoded?.data ?? '(none)'}`);
  console.log(`Matches LAN URL: ${decoded?.data === qr2.url ? 'YES ✓' : 'no ✗'}`);

  // Cleanup
  await prisma.session.delete({ where: { id: session.id } });
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

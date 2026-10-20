// Final acceptance test: QR adapts to origin, full round-trip works
const QRCode = require('qrcode');
const jsQR = require('jsqr');
const { PrismaClient } = require('@prisma/client');

(async () => {
  const localhost = 'http://localhost:3000';
  const lanIp = 'http://192.168.10.206:3000';
  const prisma = new PrismaClient();

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

  const course = (await (await fetch(`${localhost}/api/courses`, { headers: { cookie: cookieJar } })).json())[0];

  const session = await (await fetch(`${localhost}/api/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', cookie: cookieJar },
    body: JSON.stringify({
      courseId: course.id,
      name: 'QR Final Test',
      date: new Date().toISOString(),
      groups: ['AIA3.1'],
      status: 'open',
    }),
  })).json();

  console.log('===== FINAL QR ACCEPTANCE TEST =====');

  // localhost case
  const qr1 = await (await fetch(`${localhost}/api/sessions/${session.id}/qr`, { headers: { cookie: cookieJar } })).json();
  console.log(`[localhost] URL in QR: ${qr1.url}`);
  console.log(`  -> contains 'localhost:3000': ${qr1.url.includes('localhost:3000')}  (expected true)`);

  // LAN case (Host header automatically set by node fetch)
  const qr2 = await (await fetch(`${lanIp}/api/sessions/${session.id}/qr`, { headers: { cookie: cookieJar } })).json();
  console.log(`[LAN IP]   URL in QR: ${qr2.url}`);
  console.log(`  -> contains '192.168.10.206:3000': ${qr2.url.includes('192.168.10.206:3000')}  (expected true)`);

  // Decode the LAN QR
  const b64 = qr2.qr.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  const { PNG } = require('pngjs');
  const png = PNG.sync.read(buf);
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  console.log(`[decode]   payload: ${decoded?.data}`);
  console.log(`[decode]   matches LAN URL: ${decoded?.data === qr2.url ? 'YES ✓' : '✗'}`);

  // Cleanup
  await prisma.session.delete({ where: { id: session.id } });
  await prisma.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });

// Diagnose what req.nextUrl.origin actually returns
const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();

  // sign in
  const csrfRes = await fetch('http://localhost:3000/api/auth/csrf');
  let cookieJar = (csrfRes.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0]).join('; ');
  const { csrfToken } = await csrfRes.json();
  const callbackRes = await fetch('http://localhost:3000/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', cookie: cookieJar },
    body: `email=prof%40university.edu&password=professor123&csrfToken=${csrfToken}`,
    redirect: 'manual',
  });
  cookieJar = [cookieJar, ...(callbackRes.headers.getSetCookie?.() ?? []).map(c => c.split(';')[0])].filter(Boolean).join('; ');

  const session = await prisma.session.findFirst();
  if (!session) { console.log('no session in DB'); process.exit(1); }

  console.log('calling localhost:3000/api/sessions/' + session.id + '/qr ...');
  const r1 = await fetch('http://localhost:3000/api/sessions/' + session.id + '/qr', { headers: { cookie: cookieJar } });
  const j1 = await r1.json();
  console.log('url returned:', j1.url);

  console.log('calling 192.168.10.206:3000/api/sessions/' + session.id + '/qr ...');
  const r2 = await fetch('http://192.168.10.206:3000/api/sessions/' + session.id + '/qr', { headers: { cookie: cookieJar } });
  console.log('  status:', r2.status);
  const j2 = await r2.json();
  console.log('  url returned:', j2?.url);

  await prisma.$disconnect();
})();

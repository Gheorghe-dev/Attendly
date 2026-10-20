const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  // Find and cascade-delete the geo test session
  const s = await p.session.findFirst({ where: { name: 'Geo Test' } });
  if (s) {
    await p.attendanceRecord.deleteMany({ where: { sessionId: s.id } });
    await p.verificationToken.deleteMany({ where: { sessionId: s.id } });
    await p.unrecognizedSubmission.deleteMany({ where: { sessionId: s.id } });
    await p.session.delete({ where: { id: s.id } });
    console.log('Cleaned up Geo Test session');
  } else {
    console.log('No Geo Test session found');
  }
  await p.$disconnect();
})();

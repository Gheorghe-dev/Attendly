const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  const t = await p.verificationToken.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log(JSON.stringify(t));
  await p.$disconnect();
})();

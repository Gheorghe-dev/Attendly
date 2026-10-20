const { PrismaClient } = require('@prisma/client');
(async () => {
  const p = new PrismaClient();
  const ss = await p.student.findMany({ distinct: ['group'], select: { group: true } });
  console.log('groups in DB:', ss.map(s => s.group));
  await p.$disconnect();
})();

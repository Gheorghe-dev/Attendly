import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo account as a fresh new account state...');

  const passwordHash = await bcrypt.hash('professor123', 10);
  const professor = await prisma.professor.upsert({
    where: { email: 'prof@university.edu' },
    update: { name: 'Dr. Alan Turing', passwordHash },
    create: {
      name: 'Dr. Alan Turing',
      email: 'prof@university.edu',
      passwordHash,
    },
  });

  // Clean out any existing courses so the demo account acts like a brand new account
  const deleted = await prisma.course.deleteMany({
    where: { professorId: professor.id },
  });

  console.log('✅ Demo account ready as a fresh, clean account:');
  console.log('  - Email: prof@university.edu');
  console.log('  - Password: professor123');
  console.log('  - Courses: 0 (acts like a brand new account)');
  console.log(`  - Cleaned up ${deleted.count} old courses/sessions`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

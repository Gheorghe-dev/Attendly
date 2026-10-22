import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding demo account as a fresh new account state…');
  const passwordHash = await bcrypt.hash('professor123', 12);
  const professor = await prisma.professor.upsert({
    where: { email: 'prof@university.edu' },
    update: { passwordHash, name: 'Dr. Alan Turing' },
    create: { email: 'prof@university.edu', passwordHash, name: 'Dr. Alan Turing' },
  });

  await prisma.course.deleteMany({
    where: { professorId: professor.id },
  });

  console.log('✅ Demo account reset to brand new account state!');
  console.log('Login: prof@university.edu / professor123');
}

main().catch(console.error).finally(() => prisma.$disconnect());

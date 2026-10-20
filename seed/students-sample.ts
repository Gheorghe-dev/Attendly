import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database…');
  const passwordHash = await bcrypt.hash('professor123', 12);
  const professor = await prisma.professor.upsert({
    where: { email: 'prof@university.edu' },
    update: {},
    create: { email: 'prof@university.edu', passwordHash, name: 'Dr. Smith' },
  });
  console.log('Created professor:', professor.email);

  const course = await prisma.course.upsert({
    where: { name_professorId: { name: 'Mathematics 101', professorId: professor.id } },
    update: {},
    create: { name: 'Mathematics 101', professorId: professor.id },
  });
  console.log('Created course:', course.name);

  const students = [
    { name: 'Alice Johnson', email: 'alice.johnson@university.edu', group: 'Group A' },
    { name: 'Bob Smith', email: 'bob.smith@university.edu', group: 'Group A' },
    { name: 'Carol Williams', email: 'carol.williams@university.edu', group: 'Group A' },
    { name: 'David Brown', email: 'david.brown@university.edu', group: 'Group B' },
    { name: 'Eve Davis', email: 'eve.davis@university.edu', group: 'Group B' },
    { name: 'Frank Miller', email: 'frank.miller@university.edu', group: 'Group B' },
    { name: 'Grace Wilson', email: 'grace.wilson@university.edu', group: 'Group C' },
    { name: 'Henry Moore', email: 'henry.moore@university.edu', group: 'Group C' },
  ];

  for (const s of students) {
    await prisma.student.upsert({
      where: { email_courseId: { email: s.email, courseId: course.id } },
      update: {},
      create: { ...s, courseId: course.id },
    });
  }
  console.log(`Created ${students.length} students`);
  console.log('\n✅ Seed complete!');
  console.log('Login: prof@university.edu / professor123');
}

main().catch(console.error).finally(() => prisma.$disconnect());

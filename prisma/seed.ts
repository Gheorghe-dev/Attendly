import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const STUDENTS_DATA = [
  { name: 'Popescu Andrei', email: 'andrei.popescu@student.univ.ro', group: 'AIA 3.3A' },
  { name: 'Ionescu Maria', email: 'maria.ionescu@student.univ.ro', group: 'AIA 3.1 B' },
  { name: 'Radu Cristian', email: 'cristian.radu@student.univ.ro', group: 'ELA 2.2 A' },
  { name: 'Dumitrescu Elena', email: 'elena.dumitrescu@student.univ.ro', group: 'AIA 3.3A' },
  { name: 'Stan Alexandru', email: 'alexandru.stan@student.univ.ro', group: 'ELA 2.1 B' },
  { name: 'Gheorghiu Stefan', email: 'stefan.gheorghiu@student.univ.ro', group: 'AIA 3.3A' },
  { name: 'Constantin Ana', email: 'ana.constantin@student.univ.ro', group: 'AIA 3.1 B' },
  { name: 'Vasilescu Mihai', email: 'mihai.vasilescu@student.univ.ro', group: 'ELA 2.2 A' },
  { name: 'Marin Andreea', email: 'andreea.marin@student.univ.ro', group: 'AIA 3.3A' },
  { name: 'Dobre Vlad', email: 'vlad.dobre@student.univ.ro', group: 'ELA 2.1 B' },
  { name: 'Nistor Diana', email: 'diana.nistor@student.univ.ro', group: 'AIA 3.1 B' },
  { name: 'Toma Gabriel', email: 'gabriel.toma@student.univ.ro', group: 'ELA 2.2 A' },
  { name: 'Iacob Ioana', email: 'ioana.iacob@student.univ.ro', group: 'AIA 3.3A' },
  { name: 'Munteanu George', email: 'george.munteanu@student.univ.ro', group: 'ELA 2.1 B' },
  { name: 'Stanescu Laura', email: 'laura.stanescu@student.univ.ro', group: 'AIA 3.1 B' },
  { name: 'Florea Bogdan', email: 'bogdan.florea@student.univ.ro', group: 'ELA 2.2 A' },
  { name: 'Barbu Cristina', email: 'cristina.barbu@student.univ.ro', group: 'AIA 3.3A' },
  { name: 'Diaconu Daniel', email: 'daniel.diaconu@student.univ.ro', group: 'ELA 2.1 B' },
  { name: 'Neagu Simona', email: 'simona.neagu@student.univ.ro', group: 'AIA 3.1 B' },
  { name: 'Petrescu Adrian', email: 'adrian.petrescu@student.univ.ro', group: 'ELA 2.2 A' },
  { name: 'Oprea Rares', email: 'rares.oprea@student.univ.ro', group: 'AIA 3.3A' },
  { name: 'Voinea Bianca', email: 'bianca.voinea@student.univ.ro', group: 'ELA 2.1 B' },
  { name: 'Enache Victor', email: 'victor.enache@student.univ.ro', group: 'AIA 3.1 B' },
  { name: 'Ilie Roxana', email: 'roxana.ilie@student.univ.ro', group: 'ELA 2.2 A' },
  { name: 'Sandu Claudiu', email: 'claudiu.sandu@student.univ.ro', group: 'AIA 3.3A' },
  { name: 'Matei Teodora', email: 'teodora.matei@student.univ.ro', group: 'ELA 2.1 B' },
  { name: 'Avram Dragos', email: 'dragos.avram@student.univ.ro', group: 'AIA 3.1 B' },
  { name: 'Cretu Anca', email: 'anca.cretu@student.univ.ro', group: 'ELA 2.2 A' },
  { name: 'Costache Paul', email: 'paul.costache@student.univ.ro', group: 'AIA 3.3A' },
  { name: 'Serban Denisa', email: 'denisa.serban@student.univ.ro', group: 'ELA 2.1 B' },
  { name: 'Lupu Florin', email: 'florin.lupu@student.univ.ro', group: 'AIA 3.1 B' },
  { name: 'Grigore Carmen', email: 'carmen.grigore@student.univ.ro', group: 'ELA 2.2 A' },
];

async function main() {
  console.log('Seeding database with realistic academic data...');

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

  const course = await prisma.course.upsert({
    where: {
      name_professorId: {
        name: 'CS 301 — Distributed Systems',
        professorId: professor.id,
      },
    },
    update: {
      description: 'Distributed systems architectures, consensus protocols, and real-time state synchronization.',
      extraGroups: 'AIA 3.3A,AIA 3.1 B,ELA 2.2 A,ELA 2.1 B',
    },
    create: {
      name: 'CS 301 — Distributed Systems',
      description: 'Distributed systems architectures, consensus protocols, and real-time state synchronization.',
      professorId: professor.id,
      extraGroups: 'AIA 3.3A,AIA 3.1 B,ELA 2.2 A,ELA 2.1 B',
    },
  });

  // Seed students
  for (const s of STUDENTS_DATA) {
    await prisma.student.upsert({
      where: {
        email_courseId: {
          email: s.email.trim().toLowerCase(),
          courseId: course.id,
        },
      },
      update: {
        name: s.name,
        group: s.group,
      },
      create: {
        name: s.name,
        email: s.email.trim().toLowerCase(),
        group: s.group,
        courseId: course.id,
      },
    });
  }

  const allStudents = await prisma.student.findMany({ where: { courseId: course.id } });

  // Create a past session with real records
  const pastSession = await prisma.session.upsert({
    where: { token: 'demo-past-session-cuid-001' },
    update: {},
    create: {
      name: 'Curs 01 — Overview & Vector Clocks',
      courseId: course.id,
      token: 'demo-past-session-cuid-001',
      date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      groups: 'AIA 3.3A,AIA 3.1 B,ELA 2.2 A,ELA 2.1 B',
      status: 'closed',
      classroomLat: 44.435,
      classroomLng: 26.102,
      classroomRadius: 50,
    },
  });

  // Mark 24 of 32 students as present
  for (let i = 0; i < 24; i++) {
    const student = allStudents[i];
    await prisma.attendanceRecord.upsert({
      where: {
        sessionId_studentId: {
          sessionId: pastSession.id,
          studentId: student.id,
        },
      },
      update: {},
      create: {
        sessionId: pastSession.id,
        studentId: student.id,
        status: 'verified',
        distanceMeters: Math.round(12 + Math.random() * 25),
        verifiedAt: new Date(pastSession.date.getTime() + (i * 2 + 5) * 60 * 1000),
      },
    });
  }

  // Create an open live session
  await prisma.session.upsert({
    where: { token: 'demo-live-session-cuid-002' },
    update: { status: 'open' },
    create: {
      name: 'Curs 02 — Consensus & Raft Protocol',
      courseId: course.id,
      token: 'demo-live-session-cuid-002',
      date: new Date(),
      groups: 'AIA 3.3A,ELA 2.2 A',
      status: 'open',
      classroomLat: 44.435,
      classroomLng: 26.102,
      classroomRadius: 50,
    },
  });

  console.log(`✅ Seed completed:
  - Professor: prof@university.edu (password: professor123)
  - Course: CS 301 — Distributed Systems
  - Enrolled Students: ${allStudents.length}
  - Groups: AIA 3.3A, AIA 3.1 B, ELA 2.2 A, ELA 2.1 B
  - 1 Completed Session with 24 verified records
  - 1 Live Active Session ready for demo
  `);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

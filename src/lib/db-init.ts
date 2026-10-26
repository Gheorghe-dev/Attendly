import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "Professor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Professor_email_key" ON "Professor"("email")`,

  `CREATE TABLE IF NOT EXISTS "Course" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "professorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "extraGroups" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "Course_professorId_fkey" FOREIGN KEY ("professorId") REFERENCES "Professor" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Course_name_professorId_key" ON "Course"("name", "professorId")`,
  `CREATE INDEX IF NOT EXISTS "Course_professorId_idx" ON "Course"("professorId")`,

  `CREATE TABLE IF NOT EXISTS "Student" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Student_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Student_email_courseId_key" ON "Student"("email", "courseId")`,
  `CREATE INDEX IF NOT EXISTS "Student_courseId_idx" ON "Student"("courseId")`,
  `CREATE INDEX IF NOT EXISTS "Student_group_idx" ON "Student"("group")`,

  `CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "groups" TEXT NOT NULL,
    "classroom" TEXT DEFAULT 'room-101',
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "hostLat" REAL,
    "hostLng" REAL,
    "hostCity" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token")`,
  `CREATE INDEX IF NOT EXISTS "Session_courseId_idx" ON "Session"("courseId")`,
  `CREATE INDEX IF NOT EXISTS "Session_classroom_idx" ON "Session"("classroom")`,
  `CREATE INDEX IF NOT EXISTS "Session_status_idx" ON "Session"("status")`,

  `CREATE TABLE IF NOT EXISTS "AttendanceRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "verifiedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "studentLat" REAL,
    "studentLng" REAL,
    "distanceMeters" REAL,
    "studentCity" TEXT,
    "deviceId" TEXT,
    "deviceFingerprint" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendanceRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AttendanceRecord_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceRecord_sessionId_studentId_key" ON "AttendanceRecord"("sessionId", "studentId")`,
  `CREATE INDEX IF NOT EXISTS "AttendanceRecord_sessionId_idx" ON "AttendanceRecord"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "AttendanceRecord_studentId_idx" ON "AttendanceRecord"("studentId")`,
  `CREATE INDEX IF NOT EXISTS "AttendanceRecord_status_idx" ON "AttendanceRecord"("status")`,
  `CREATE INDEX IF NOT EXISTS "AttendanceRecord_verifiedAt_idx" ON "AttendanceRecord"("verifiedAt")`,
  `CREATE INDEX IF NOT EXISTS "AttendanceRecord_deviceId_idx" ON "AttendanceRecord"("deviceId")`,

  `CREATE TABLE IF NOT EXISTS "VerificationToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VerificationToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "VerificationToken_token_key" ON "VerificationToken"("token")`,
  `CREATE INDEX IF NOT EXISTS "VerificationToken_sessionId_idx" ON "VerificationToken"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "VerificationToken_email_idx" ON "VerificationToken"("email")`,
  `CREATE INDEX IF NOT EXISTS "VerificationToken_expiresAt_idx" ON "VerificationToken"("expiresAt")`,

  `CREATE TABLE IF NOT EXISTS "UnrecognizedSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "distanceMeters" REAL,
    "deviceId" TEXT,
    "deviceFingerprint" TEXT,
    "reason" TEXT NOT NULL DEFAULT 'NOT_IN_ROSTER',
    "submittedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UnrecognizedSubmission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "UnrecognizedSubmission_sessionId_idx" ON "UnrecognizedSubmission"("sessionId")`,
  `CREATE INDEX IF NOT EXISTS "UnrecognizedSubmission_submittedAt_idx" ON "UnrecognizedSubmission"("submittedAt")`
];

let initPromise: Promise<void> | null = null;

export async function ensureDatabaseSchema(prisma: PrismaClient): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // Check if the Professor table exists in SQLite
      const result = await prisma.$queryRawUnsafe<{ count: number }[]>(
        "SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='Professor'"
      );

      const tableExists = Array.isArray(result) && result[0] && Number(result[0].count) > 0;

      if (!tableExists) {
        console.log('[Database] Initializing SQLite tables on fresh database...');
        for (const sql of DDL_STATEMENTS) {
          await prisma.$executeRawUnsafe(sql);
        }
        console.log('[Database] Schema successfully created.');
      }

      // Check if demo professor exists
      const profCount = await prisma.professor.count();
      if (profCount === 0) {
        console.log('[Database] Seeding default demo professor account...');
        const passwordHash = await bcrypt.hash('professor123', 10);
        await prisma.professor.create({
          data: {
            email: 'prof@university.edu',
            name: 'Dr. Alan Turing',
            passwordHash,
          },
        });
        console.log('[Database] Demo account created (prof@university.edu / professor123).');
      }
    } catch (err) {
      console.warn('[Database] ensureDatabaseSchema notice:', (err as Error).message);
    }
  })();

  return initPromise;
}

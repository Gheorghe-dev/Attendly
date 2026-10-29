const { PrismaClient } = require('@prisma/client');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function getAllFromDb(url) {
  const p = new PrismaClient({ datasources: { db: { url } } });
  try {
    const profs = await p.professor.findMany();
    const courses = await p.course.findMany();
    const students = await p.student.findMany();
    const sessions = await p.session.findMany();
    const attendance = await p.attendanceRecord.findMany();
    const unrecognized = await p.unrecognizedSubmission.findMany();
    return { profs, courses, students, sessions, attendance, unrecognized };
  } catch (e) {
    console.warn('Could not read from', url, e.message);
    return null;
  } finally {
    await p.$disconnect();
  }
}

async function mergeInto(targetUrl, sourceData) {
  if (!sourceData) return;
  const p = new PrismaClient({ datasources: { db: { url: targetUrl } } });
  try {
    // 1. Professors
    for (const pr of sourceData.profs) {
      await p.professor.upsert({
        where: { id: pr.id },
        update: {},
        create: {
          id: pr.id,
          email: pr.email,
          name: pr.name,
          passwordHash: pr.passwordHash,
          createdAt: pr.createdAt,
        },
      }).catch(async () => {
        await p.professor.upsert({
          where: { email: pr.email },
          update: {},
          create: {
            id: pr.id,
            email: pr.email,
            name: pr.name,
            passwordHash: pr.passwordHash,
            createdAt: pr.createdAt,
          },
        }).catch(() => {});
      });
    }

    // 2. Courses
    for (const c of sourceData.courses) {
      await p.course.upsert({
        where: { id: c.id },
        update: {},
        create: {
          id: c.id,
          name: c.name,
          code: c.code,
          professorId: c.professorId,
          createdAt: c.createdAt,
        },
      }).catch(() => {});
    }

    // 3. Students
    for (const st of sourceData.students) {
      await p.student.upsert({
        where: { id: st.id },
        update: {},
        create: {
          id: st.id,
          name: st.name,
          email: st.email,
          group: st.group,
          courseId: st.courseId,
          createdAt: st.createdAt,
        },
      }).catch(() => {});
    }

    // 4. Sessions
    for (const s of sourceData.sessions) {
      await p.session.upsert({
        where: { id: s.id },
        update: {},
        create: {
          id: s.id,
          name: s.name,
          courseId: s.courseId,
          date: s.date,
          groups: s.groups,
          classroom: s.classroom,
          token: s.token,
          status: s.status,
          hostLat: s.hostLat,
          hostLng: s.hostLng,
          hostCity: s.hostCity,
          createdAt: s.createdAt,
        },
      }).catch(() => {});
    }

    // 5. Attendance
    for (const a of sourceData.attendance) {
      await p.attendanceRecord.upsert({
        where: {
          sessionId_studentId: {
            sessionId: a.sessionId,
            studentId: a.studentId,
          },
        },
        update: {
          status: a.status,
          verifiedAt: a.verifiedAt,
          distanceMeters: a.distanceMeters,
          studentCity: a.studentCity,
          deviceId: a.deviceId,
          deviceFingerprint: a.deviceFingerprint,
        },
        create: {
          id: a.id,
          sessionId: a.sessionId,
          studentId: a.studentId,
          status: a.status,
          verifiedAt: a.verifiedAt,
          distanceMeters: a.distanceMeters,
          studentCity: a.studentCity,
          deviceId: a.deviceId,
          deviceFingerprint: a.deviceFingerprint,
          createdAt: a.createdAt,
        },
      }).catch(() => {});
    }

    // 6. Unrecognized
    for (const u of sourceData.unrecognized) {
      await p.unrecognizedSubmission.upsert({
        where: { id: u.id },
        update: {},
        create: {
          id: u.id,
          sessionId: u.sessionId,
          email: u.email,
          reason: u.reason,
          deviceId: u.deviceId,
          deviceFingerprint: u.deviceFingerprint,
          submittedAt: u.submittedAt,
        },
      }).catch(() => {});
    }
  } finally {
    await p.$disconnect();
  }
}

async function main() {
  const localDb = path.join(__dirname, '..', 'prisma', 'dev.db');
  const appDataDb = path.join(process.env.APPDATA || '', 'Attendly', 'attendly.db');

  console.log('1. Reading AppData DB...');
  const appData = await getAllFromDb(`file:${appDataDb.replace(/\\/g, '/')}`);

  console.log('2. Reading Local Repo DB...');
  const localData = await getAllFromDb(`file:${localDb.replace(/\\/g, '/')}`);

  console.log('3. Reading Docker Container DB...');
  let dockerData = null;
  try {
    const tmpDump = path.join(__dirname, '..', 'prisma', 'docker_dump.db');
    execSync(`docker cp attendly-app:/app/prisma/dev.db "${tmpDump}"`, { stdio: 'ignore' });
    if (fs.existsSync(tmpDump)) {
      dockerData = await getAllFromDb(`file:${tmpDump.replace(/\\/g, '/')}`);
      try { fs.unlinkSync(tmpDump); } catch {}
    }
  } catch (err) {
    console.log('Docker dump not available:', err.message);
  }

  console.log('Merging everything into Local Repo DB...');
  await mergeInto(`file:${localDb.replace(/\\/g, '/')}`, appData);
  await mergeInto(`file:${localDb.replace(/\\/g, '/')}`, dockerData);

  console.log('Merging everything into AppData DB...');
  await mergeInto(`file:${appDataDb.replace(/\\/g, '/')}`, localData);
  await mergeInto(`file:${appDataDb.replace(/\\/g, '/')}`, dockerData);

  console.log('Syncing template.db...');
  const templateDb = path.join(__dirname, '..', 'prisma', 'template.db');
  fs.copyFileSync(localDb, templateDb);

  console.log('Database merge complete!');
}

main().catch(console.error);

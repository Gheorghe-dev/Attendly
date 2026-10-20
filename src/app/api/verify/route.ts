import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { haversineMeters } from '@/lib/geo';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');
  if (!token) return NextResponse.json({ error: 'Missing token' }, { status: 400 });

  const verToken = await prisma.verificationToken.findUnique({
    where: { token },
    include: { session: true },
  });

  if (!verToken) return NextResponse.json({ error: 'Invalid or expired verification link.' }, { status: 404 });
  if (verToken.used) return NextResponse.json({ error: 'This verification link has already been used.' }, { status: 410 });
  if (new Date() > verToken.expiresAt) {
    return NextResponse.json({ error: 'This verification link has expired. Please re-submit your attendance.' }, { status: 410 });
  }

  const student = await prisma.student.findFirst({
    where: { email: verToken.email, courseId: verToken.session.courseId },
  });
  if (!student) return NextResponse.json({ error: 'Student not found.' }, { status: 404 });

  // Look up the pending attendance record once. Distance only matters when both
  // the classroom and the student's phone provided GPS coordinates — otherwise
  // we store null rather than NaN (which would corrupt sort/aggregate later).
  const attendance = await prisma.attendanceRecord.findUnique({
    where: { sessionId_studentId: { sessionId: verToken.sessionId, studentId: student.id } },
  });

  const classroom = verToken.session;
  const hasClassroomGeo =
    typeof classroom.classroomLat === 'number' &&
    typeof classroom.classroomLng === 'number' &&
    !Number.isNaN(classroom.classroomLat) &&
    !Number.isNaN(classroom.classroomLng);
  const hasStudentGeo =
    attendance &&
    typeof attendance.studentLat === 'number' &&
    typeof attendance.studentLng === 'number' &&
    !Number.isNaN(attendance.studentLat) &&
    !Number.isNaN(attendance.studentLng);

  const distance = hasClassroomGeo && hasStudentGeo
    ? haversineMeters(
        { lat: classroom.classroomLat as number, lng: classroom.classroomLng as number },
        { lat: attendance.studentLat as number, lng: attendance.studentLng as number }
      ) ?? null
    : null;

  // Mark token used and update attendance record
  await prisma.$transaction([
    prisma.verificationToken.update({ where: { token }, data: { used: true } }),
    prisma.attendanceRecord.update({
      where: { sessionId_studentId: { sessionId: verToken.sessionId, studentId: student.id } },
      data: { status: 'verified', verifiedAt: new Date(), distanceMeters: distance },
    }),
  ]);

  return NextResponse.json({
    success: true,
    message: 'Your attendance has been recorded successfully.',
    distanceMeters: distance,
  });
}

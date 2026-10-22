import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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

  const now = new Date();

  // Mark token used and update attendance record
  await prisma.$transaction([
    prisma.verificationToken.update({ where: { token }, data: { used: true } }),
    prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: verToken.sessionId, studentId: student.id } },
      update: { status: 'verified', verifiedAt: now },
      create: {
        sessionId: verToken.sessionId,
        studentId: student.id,
        status: 'verified',
        verifiedAt: now,
      },
    }),
  ]);

  return NextResponse.json({
    success: true,
    message: 'Your attendance has been recorded successfully.',
  });
}

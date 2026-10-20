import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendVerificationEmail, isSmtpConfigured } from '@/lib/email';
import { parseGroups } from '@/lib/groups';
import crypto from 'crypto';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const body = await req.json();
    const rawEmail: string = body?.email ?? '';
    const geo = body?.geolocation as
      | { lat: number; lng: number; accuracy?: number }
      | undefined;
    if (!rawEmail) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

    const email = normalizeEmail(rawEmail);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format.' }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { token: params.token },
      include: { course: true },
    });
    if (!session) return NextResponse.json({ error: 'Invalid or expired session QR code.' }, { status: 404 });
    if (session.status === 'closed') {
      return NextResponse.json({ error: 'This session is closed. Registration is no longer accepted.' }, { status: 403 });
    }

    const sessionGroups = parseGroups(session.groups);
    const student = await prisma.student.findFirst({
      where: { email, courseId: session.courseId },
    });

    if (!student) {
      // Store as unrecognized
      await prisma.unrecognizedSubmission.create({
        data: { sessionId: session.id, email },
      });
      return NextResponse.json({
        error: 'This email address is not on the official student list. Please check your email or contact your professor.',
      }, { status: 404 });
    }

    const studentGroupNorm = student.group.replace(/\s+/g, ' ').trim().toLowerCase();
    const isAssigned = sessionGroups.some(
      (g) => g.replace(/\s+/g, ' ').trim().toLowerCase() === studentGroupNorm
    );
    if (!isAssigned) {
      return NextResponse.json({
        error: `Your group (${student.group}) is not assigned to this session. This session is for: ${sessionGroups.join(', ')}.`,
      }, { status: 403 });
    }

    const existing = await prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
    });
    if (existing) {
      if (existing.status === 'verified') {
        return NextResponse.json({ error: 'Your attendance has already been recorded for this session.' }, { status: 409 });
      }
      // Resend verification
      await prisma.verificationToken.deleteMany({
        where: { email, sessionId: session.id, used: false },
      });
    }

    // Create attendance record in pending state
    if (!existing) {
      await prisma.attendanceRecord.create({
        data: {
          sessionId: session.id,
          studentId: student.id,
          status: 'pending',
          studentLat: typeof geo?.lat === 'number' && !Number.isNaN(geo.lat) ? geo.lat : null,
          studentLng: typeof geo?.lng === 'number' && !Number.isNaN(geo.lng) ? geo.lng : null,
          studentAccuracy: typeof geo?.accuracy === 'number' && !Number.isNaN(geo.accuracy) ? geo.accuracy : null,
        },
      });
    } else if (
      geo &&
      typeof geo.lat === 'number' &&
      typeof geo.lng === 'number' &&
      !Number.isNaN(geo.lat) &&
      !Number.isNaN(geo.lng) &&
      existing.studentLat == null
    ) {
      // Backfill location on a previously-submitted pending record
      await prisma.attendanceRecord.update({
        where: { id: existing.id },
        data: {
          studentLat: geo.lat,
          studentLng: geo.lng,
          studentAccuracy: typeof geo.accuracy === 'number' && !Number.isNaN(geo.accuracy) ? geo.accuracy : null,
        },
      });
    }

    // Generate verification token
    const verToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await prisma.verificationToken.create({
      data: { email, sessionId: session.id, token: verToken, expiresAt },
    });

    const proto = req.headers.get('x-forwarded-proto') ?? 'http';
    const hostHeader = req.headers.get('host');
    const origin = hostHeader ? `${proto}://${hostHeader}` : (process.env.APP_URL || 'http://localhost:3000');
    const verificationUrl = `${origin}/verify?token=${verToken}`;

    const mail = await sendVerificationEmail({
      to: email,
      verificationUrl,
      courseName: session.course.name,
      sessionDate: session.date.toLocaleDateString('en-GB'),
      studentName: student.name,
    });

    // We never want to silently fail. If the email actually errored and we're not
    // in dev mode, surface that to the client so the professor can be told.
    if (!mail.ok) {
      return NextResponse.json({
        message:
          'Verification email failed to send. Please contact your professor — the session is still recorded as pending.',
        error: mail.error ?? 'Email delivery failed',
        verificationUrl: isSmtpConfigured() ? undefined : verificationUrl,
      }, { status: 502 });
    }

    const response: {
      message: string;
      devMode?: boolean;
      verificationUrl?: string;
    } = {
      message: mail.devMode
        ? 'Verification link generated. (No SMTP configured — see the in-app button below to continue.)'
        : 'Verification email sent. Please check your university email inbox and click the verification link.',
    };
    if (mail.devMode) {
      response.devMode = true;
      response.verificationUrl = verificationUrl;
    }
    return NextResponse.json(response);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: 'Server error. Please try again.' }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.session.findUnique({
    where: { token: params.token },
    include: { course: { select: { name: true } } },
  });
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({
    courseName: session.course.name,
    sessionName: session.name,
    date: session.date.toISOString(),
    status: session.status,
    classroomLat: session.classroomLat,
    classroomLng: session.classroomLng,
    classroomRadius: session.classroomRadius,
  });
}

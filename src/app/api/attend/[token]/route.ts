import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseGroups } from '@/lib/groups';
import { calculateDistance } from '@/lib/geo';
import { checkRateLimit } from '@/lib/rate-limit';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    // 1. Rate limiting by IP
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';
    const rate = checkRateLimit(ip, 30, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          code: 'RATE_LIMITED',
          error: 'Prea multe încercări. Te rugăm să aștepți un minut înainte de a reîncerca.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const rawEmail: string = body?.email ?? '';
    const geo = body?.geolocation as
      | { lat: number; lng: number; accuracy?: number }
      | undefined;

    if (!rawEmail) {
      return NextResponse.json(
        { code: 'EMAIL_REQUIRED', error: 'Emailul universitar este obligatoriu.' },
        { status: 400 }
      );
    }

    const email = normalizeEmail(rawEmail);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { code: 'INVALID_EMAIL_FORMAT', error: 'Formatul adresei de email este invalid.' },
        { status: 400 }
      );
    }

    // 2. Session lookup
    const session = await prisma.session.findUnique({
      where: { token: params.token },
      include: { course: true },
    });

    if (!session) {
      return NextResponse.json(
        { code: 'INVALID_TOKEN', error: 'Cod QR invalid sau expirat.' },
        { status: 404 }
      );
    }

    // 3. Check if session is closed
    if (session.status === 'closed') {
      return NextResponse.json(
        {
          code: 'SESSION_CLOSED',
          error: 'Înregistrarea a fost închisă de profesor.',
        },
        { status: 403 }
      );
    }

    // 4. Check if student is in roster
    const student = await prisma.student.findFirst({
      where: { email, courseId: session.courseId },
    });

    if (!student) {
      await prisma.unrecognizedSubmission.create({
        data: {
          sessionId: session.id,
          email,
          reason: 'NOT_IN_ROSTER',
        },
      });
      return NextResponse.json(
        {
          code: 'NOT_IN_ROSTER',
          error: 'Adresa de email nu a fost găsită în lista oficială a studenților pentru acest curs.',
        },
        { status: 404 }
      );
    }

    // 5. Target group enforcement
    const sessionGroups = parseGroups(session.groups);
    if (sessionGroups.length > 0) {
      const studentGroupNorm = student.group.replace(/\s+/g, ' ').trim().toLowerCase();
      const isAssigned = sessionGroups.some(
        (g) => g.replace(/\s+/g, ' ').trim().toLowerCase() === studentGroupNorm
      );

      if (!isAssigned) {
        await prisma.unrecognizedSubmission.create({
          data: {
            sessionId: session.id,
            email,
            reason: 'GROUP_NOT_ALLOWED',
          },
        });
        return NextResponse.json(
          {
            code: 'GROUP_NOT_ALLOWED',
            error: `Grupa ta (${student.group}) nu este programată pentru această sesiune. Sesiunea este deschisă pentru: ${sessionGroups.join(', ')}.`,
          },
          { status: 403 }
        );
      }
    }

    // 6. Geofence verification
    let computedDistance: number | null = null;
    const hasGeofence =
      session.classroomLat != null &&
      session.classroomLng != null &&
      session.classroomRadius != null &&
      session.classroomRadius > 0;

    if (hasGeofence) {
      if (
        !geo ||
        typeof geo.lat !== 'number' ||
        typeof geo.lng !== 'number' ||
        Number.isNaN(geo.lat) ||
        Number.isNaN(geo.lng)
      ) {
        return NextResponse.json(
          {
            code: 'LOCATION_REQUIRED',
            error: 'Verificarea coordonatelor GPS este obligatorie pentru această sesiune.',
          },
          { status: 400 }
        );
      }

      computedDistance = calculateDistance(
        session.classroomLat!,
        session.classroomLng!,
        geo.lat,
        geo.lng
      );

      if (computedDistance > session.classroomRadius) {
        await prisma.unrecognizedSubmission.create({
          data: {
            sessionId: session.id,
            email,
            distance: Math.round(computedDistance),
            reason: 'OUTSIDE_GEOFENCE',
          },
        });
        return NextResponse.json(
          {
            code: 'OUTSIDE_GEOFENCE',
            distance: Math.round(computedDistance),
            allowedRadius: session.classroomRadius,
            error: `Te afli în afara perimetrului sălii (${Math.round(computedDistance)}m, perimetru maxim admis: ${session.classroomRadius}m).`,
          },
          { status: 403 }
        );
      }
    }

    // 7. Check existing attendance record
    const existing = await prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
    });

    if (existing && existing.status === 'verified') {
      return NextResponse.json({
        code: 'ALREADY_CHECKED_IN',
        message: 'Prezența ta este deja confirmată pentru această sesiune.',
        originalCheckInTime: existing.verifiedAt || existing.createdAt,
        student: {
          name: student.name,
          email: student.email,
          group: student.group,
        },
        courseName: session.course.name,
        sessionName: session.name,
      });
    }

    // 8. Record attendance as verified
    const now = new Date();
    const record = await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      update: {
        status: 'verified',
        verifiedAt: now,
        studentLat: geo?.lat ?? null,
        studentLng: geo?.lng ?? null,
        studentAccuracy: geo?.accuracy ?? null,
        distanceMeters: computedDistance != null ? Math.round(computedDistance) : null,
      },
      create: {
        sessionId: session.id,
        studentId: student.id,
        status: 'verified',
        verifiedAt: now,
        studentLat: geo?.lat ?? null,
        studentLng: geo?.lng ?? null,
        studentAccuracy: geo?.accuracy ?? null,
        distanceMeters: computedDistance != null ? Math.round(computedDistance) : null,
      },
    });

    return NextResponse.json({
      code: 'SUCCESS',
      message: 'Prezență înregistrată cu succes!',
      student: {
        name: student.name,
        email: student.email,
        group: student.group,
      },
      courseName: session.course.name,
      sessionName: session.name,
      checkInTime: record.verifiedAt || now,
      distance: record.distanceMeters,
    });
  } catch (err) {
    console.error('[API attend] error:', err);
    return NextResponse.json(
      { code: 'SERVER_ERROR', error: 'Eroare de server. Te rugăm să reîncerci.' },
      { status: 500 }
    );
  }
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  const session = await prisma.session.findUnique({
    where: { token: params.token },
    include: { course: { select: { name: true } } },
  });
  if (!session) {
    return NextResponse.json({ code: 'NOT_FOUND', error: 'Sesiunea nu a fost găsită.' }, { status: 404 });
  }
  return NextResponse.json({
    courseName: session.course.name,
    sessionName: session.name,
    date: session.date.toISOString(),
    status: session.status,
    requiresLocation: session.classroomLat != null && session.classroomLng != null,
    classroomRadius: session.classroomRadius,
  });
}

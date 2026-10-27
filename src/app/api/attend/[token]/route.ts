import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseGroups } from '@/lib/groups';
import { checkRateLimit } from '@/lib/rate-limit';
import { calculateDistance } from '@/lib/distance';
import { detectIpCoordinates, resolveHostCoordinates } from '@/lib/networkGeo';
import { slugifyClassroom, formatClassroomName } from '@/lib/classroom';
import { getLocalHostBaseUrl } from '@/lib/qrcode';

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function POST(req: NextRequest, { params }: { params: { token: string } }) {
  try {
    // 1. Rate limiting by IP (supports Cloudflare connecting IP)
    const forwarded = req.headers.get('x-forwarded-for');
    const clientIp =
      req.headers.get('cf-connecting-ip') ||
      (forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1');
    const ip = clientIp;
    const rate = checkRateLimit(ip, 120, 60000);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          code: 'RATE_LIMITED',
          error: 'Too many attempts. Please wait a minute before trying again.',
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const rawEmail: string = body?.email ?? '';

    // Device identification (body or cookie fallback)
    const clientDeviceId =
      typeof body?.deviceId === 'string' ? body.deviceId.trim() : '';
    const clientFingerprint =
      typeof body?.deviceFingerprint === 'string'
        ? body.deviceFingerprint.trim()
        : '';
    const cookieDeviceId =
      req.cookies.get('attendly_device_id')?.value?.trim() || '';
    const deviceId = clientDeviceId || cookieDeviceId || null;
    const deviceFingerprint = clientFingerprint || null;

    if (!rawEmail) {
      return NextResponse.json(
        { code: 'EMAIL_REQUIRED', error: 'University email is required.' },
        { status: 400 }
      );
    }

    const email = normalizeEmail(rawEmail);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { code: 'INVALID_EMAIL_FORMAT', error: 'Invalid email address format.' },
        { status: 400 }
      );
    }

    // 2. Predefined classroom & token lookup
    let rawToken = params.token.trim();
    try {
      rawToken = decodeURIComponent(rawToken).trim();
    } catch {}
    const tokenSlug = slugifyClassroom(rawToken);
    const classroomName = formatClassroomName(rawToken);

    const matchCriteria = [
      { id: rawToken },
      { token: rawToken },
      { token: tokenSlug },
      { classroom: rawToken },
      { classroom: tokenSlug },
      { classroom: classroomName },
    ];

    // Prefer open sessions first (most recent)
    let session = await prisma.session.findFirst({
      where: {
        OR: matchCriteria,
        status: 'open',
      },
      orderBy: { date: 'desc' },
      include: { course: true },
    });

    // If no open session, find the most recent session (e.g. closed)
    if (!session) {
      session = await prisma.session.findFirst({
        where: { OR: matchCriteria },
        orderBy: { date: 'desc' },
        include: { course: true },
      });
    }

    if (!session) {
      return NextResponse.json(
        { code: 'INVALID_TOKEN', error: 'Invalid or expired QR code.' },
        { status: 404 }
      );
    }

    // 3. Check if session is closed
    if (session.status === 'closed') {
      return NextResponse.json(
        {
          code: 'SESSION_CLOSED',
          error: `Attendance check-in has been closed by the instructor${session.classroom ? ` for ${session.classroom}` : ''}.`,
          classroom: session.classroom,
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
          deviceId,
          deviceFingerprint,
          reason: 'NOT_IN_ROSTER',
        },
      });
      return NextResponse.json(
        {
          code: 'NOT_IN_ROSTER',
          error: 'Email address was not found in the official course roster.',
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
            deviceId,
            deviceFingerprint,
            reason: 'GROUP_NOT_ALLOWED',
          },
        });
        return NextResponse.json(
          {
            code: 'GROUP_NOT_ALLOWED',
            error: `Your group (${student.group}) is not scheduled for this session. This session is open to: ${sessionGroups.join(', ')}.`,
          },
          { status: 403 }
        );
      }
    }

    // 6. Device Anti-Proxy Protection: One device per student per session
    if (deviceId) {
      const deviceCollision = await prisma.attendanceRecord.findFirst({
        where: {
          sessionId: session.id,
          status: 'verified',
          studentId: { not: student.id }, // Another student
          deviceId,
        },
        include: { student: true },
      });

      if (deviceCollision) {
        await prisma.unrecognizedSubmission.create({
          data: {
            sessionId: session.id,
            email,
            deviceId,
            deviceFingerprint,
            reason: 'DEVICE_ALREADY_USED',
          },
        });

        return NextResponse.json(
          {
            code: 'DEVICE_ALREADY_USED',
            error: `This device has already been used to record attendance for student ${deviceCollision.student.name} in this session. Proxy attendance from the same device is strictly prohibited.`,
            priorStudent: deviceCollision.student.name,
          },
          { status: 403 }
        );
      }
    }

    // 7. Distance calculation between the host device and the scanning device
    const rawLat = body?.coords?.lat ?? body?.coords?.latitude;
    const rawLng = body?.coords?.lng ?? body?.coords?.longitude ?? body?.coords?.lon;
    let studentLat: number | null =
      typeof rawLat === 'number' && !Number.isNaN(rawLat) ? rawLat : null;
    let studentLng: number | null =
      typeof rawLng === 'number' && !Number.isNaN(rawLng) ? rawLng : null;
    let studentCity: string | null =
      typeof body?.city === 'string' ? body.city.trim() : null;

    // Fallback A: Cloudflare Edge Geolocation Headers (if scanned through Cloudflare Tunnel)
    if (studentLat == null || studentLng == null) {
      const cfLat = parseFloat(req.headers.get('cf-iplatitude') || '');
      const cfLng = parseFloat(req.headers.get('cf-iplongitude') || '');
      if (!Number.isNaN(cfLat) && !Number.isNaN(cfLng)) {
        studentLat = cfLat;
        studentLng = cfLng;
        studentCity = studentCity || req.headers.get('cf-ipcity') || null;
      }
    }

    // Fallback B: IP Geolocation lookup of student's public IP
    if (studentLat == null || studentLng == null) {
      const netGeo = await detectIpCoordinates(clientIp);
      if (netGeo) {
        studentLat = netGeo.lat;
        studentLng = netGeo.lng;
        studentCity = studentCity || netGeo.city || null;
      }
    }

    // Ensure Host Device coordinates are established
    let hostLat = session.hostLat;
    let hostLng = session.hostLng;
    if (hostLat == null || hostLng == null) {
      const hostGeo = await resolveHostCoordinates();
      if (hostGeo) {
        hostLat = hostGeo.lat;
        hostLng = hostGeo.lng;
        // Persist to session so future scans have it cached immediately
        await prisma.session
          .update({
            where: { id: session.id },
            data: {
              hostLat: hostGeo.lat,
              hostLng: hostGeo.lng,
              hostCity: session.hostCity || hostGeo.city,
            },
          })
          .catch(() => {});
      }
    }

    const sameLocalNetwork =
      Boolean(body?.sameLocalNetwork) ||
      clientIp === '127.0.0.1' ||
      clientIp.startsWith('192.168.') ||
      clientIp.startsWith('10.') ||
      clientIp.startsWith('172.16.');

    // If scanning device is verified on the same local Wi-Fi in the same room:
    if (sameLocalNetwork && studentLat != null && studentLng != null) {
      // If the host had no GPS or only an approximate city center IP, calibrate to real in-room GPS!
      const isHostUncalibrated =
        session.hostLat == null ||
        (hostLat != null && hostLng != null && calculateDistance(hostLat, hostLng, studentLat, studentLng) > 100);

      if (isHostUncalibrated) {
        hostLat = studentLat;
        hostLng = studentLng;
        await prisma.session
          .update({
            where: { id: session.id },
            data: { hostLat: studentLat, hostLng: studentLng },
          })
          .catch(() => {});
      }
    }

    // Calculate geodetic distance between the host device and scanning device
    let distanceMeters: number | null = null;
    if (
      hostLat != null &&
      hostLng != null &&
      studentLat != null &&
      studentLng != null
    ) {
      distanceMeters = calculateDistance(hostLat, hostLng, studentLat, studentLng);
    }

    // Devices communicating on the same local Wi-Fi router are physically within room range (1-5m)
    if (sameLocalNetwork) {
      distanceMeters = distanceMeters == null || distanceMeters > 50 ? 2 : Math.max(1, distanceMeters);
    }

    // 8. Check existing attendance record for the same student
    const existing = await prisma.attendanceRecord.findUnique({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
    });

    if (existing && existing.status === 'verified') {
      const response = NextResponse.json({
        code: 'ALREADY_CHECKED_IN',
        message: 'Your attendance has already been confirmed for this session.',
        originalCheckInTime: existing.verifiedAt || existing.createdAt,
        student: {
          name: student.name,
          email: student.email,
          group: student.group,
        },
        courseName: session.course.name,
        sessionName: session.name,
        distance: existing.distanceMeters ?? distanceMeters,
        city: existing.studentCity ?? studentCity,
      });

      if (deviceId) {
        response.cookies.set('attendly_device_id', deviceId, {
          maxAge: 60 * 60 * 24 * 365,
          path: '/',
          sameSite: 'lax',
        });
      }
      return response;
    }

    // 9. Record attendance as verified
    const now = new Date();
    const record = await prisma.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: session.id, studentId: student.id } },
      update: {
        status: 'verified',
        verifiedAt: now,
        studentLat,
        studentLng,
        distanceMeters,
        studentCity,
        deviceId,
        deviceFingerprint,
      },
      create: {
        sessionId: session.id,
        studentId: student.id,
        status: 'verified',
        verifiedAt: now,
        studentLat,
        studentLng,
        distanceMeters,
        studentCity,
        deviceId,
        deviceFingerprint,
      },
    });

    const response = NextResponse.json({
      code: 'SUCCESS',
      message: 'Attendance successfully recorded!',
      student: {
        name: student.name,
        email: student.email,
        group: student.group,
      },
      courseName: session.course.name,
      sessionName: session.name,
      classroom: session.classroom,
      checkInTime: record.verifiedAt || now,
      distance: distanceMeters,
      city: studentCity,
    });

    if (deviceId) {
      response.cookies.set('attendly_device_id', deviceId, {
        maxAge: 60 * 60 * 24 * 365,
        path: '/',
        sameSite: 'lax',
      });
    }

    return response;
  } catch (err) {
    console.error('[API attend] error:', err);
    return NextResponse.json(
      { code: 'SERVER_ERROR', error: 'Internal server error. Please try again.' },
      { status: 500 }
    );
  }
}

export async function GET(_req: NextRequest, { params }: { params: { token: string } }) {
  let rawToken = params.token.trim();
  try {
    rawToken = decodeURIComponent(rawToken).trim();
  } catch {}
  const tokenSlug = slugifyClassroom(rawToken);
  const classroomName = formatClassroomName(rawToken);

  const matchCriteria = [
    { id: rawToken },
    { token: rawToken },
    { token: tokenSlug },
    { classroom: rawToken },
    { classroom: tokenSlug },
    { classroom: classroomName },
  ];

  // Prefer open sessions first (most recent)
  let session = await prisma.session.findFirst({
    where: {
      OR: matchCriteria,
      status: 'open',
    },
    orderBy: { date: 'desc' },
    include: { course: { select: { name: true } } },
  });

  if (!session) {
    session = await prisma.session.findFirst({
      where: { OR: matchCriteria },
      orderBy: { date: 'desc' },
      include: { course: { select: { name: true } } },
    });
  }

  if (!session) {
    return NextResponse.json({ code: 'NOT_FOUND', error: 'Session not found.' }, { status: 404 });
  }

  return NextResponse.json({
    courseName: session.course.name,
    sessionName: session.name,
    classroom: session.classroom || classroomName,
    classroomSlug: slugifyClassroom(session.classroom || rawToken),
    date: session.date.toISOString(),
    status: session.status,
    localHostUrl: getLocalHostBaseUrl(),
  });
}

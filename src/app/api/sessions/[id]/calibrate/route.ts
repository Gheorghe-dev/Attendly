import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { calculateDistance } from '@/lib/distance';
import { setHostCoordinates } from '@/lib/networkGeo';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const lat = typeof body?.lat === 'number' ? body.lat : parseFloat(body?.lat);
    const lng = typeof body?.lng === 'number' ? body.lng : parseFloat(body?.lng);
    const city = typeof body?.city === 'string' ? body.city.trim() : null;

    if (Number.isNaN(lat) || Number.isNaN(lng) || lat == null || lng == null) {
      return NextResponse.json({ error: 'Valid latitude and longitude are required' }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: params.id },
      include: { attendance: true },
    });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Cache in memory for host
    setHostCoordinates(lat, lng, city || undefined);

    // Update session host coordinates
    await prisma.session.update({
      where: { id: params.id },
      data: {
        hostLat: lat,
        hostLng: lng,
        hostCity: city || session.hostCity || 'Calibrated Classroom',
      },
    });

    // Recalculate distance for all existing student scans in this session
    let updatedCount = 0;
    for (const rec of session.attendance) {
      if (rec.studentLat != null && rec.studentLng != null) {
        const newDist = calculateDistance(lat, lng, rec.studentLat, rec.studentLng);
        await prisma.attendanceRecord.update({
          where: { id: rec.id },
          data: { distanceMeters: newDist },
        });
        updatedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Classroom host location successfully calibrated!',
      hostLat: lat,
      hostLng: lng,
      recordsUpdated: updatedCount,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'Failed to calibrate session location: ' + msg }, { status: 500 });
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await prisma.session.findUnique({
    where: { id: params.id },
    include: { course: { select: { name: true } } },
  });
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: session.id,
    courseName: session.course.name,
    sessionName: session.name,
    classroom: session.classroom,
    hostLat: session.hostLat,
    hostLng: session.hostLng,
    hostCity: session.hostCity,
    isCalibrated: session.hostLat != null && session.hostLng != null,
  });
}

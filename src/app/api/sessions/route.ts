import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveHostCoordinates } from '@/lib/networkGeo';
import { slugifyClassroom, formatClassroomName, DEFAULT_CLASSROOM } from '@/lib/classroom';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get('courseId');
  const where = courseId
    ? { courseId, course: { professorId: session.user.id } }
    : { course: { professorId: session.user.id } };
  const sessions = await prisma.session.findMany({
    where,
    include: {
      course: { select: { name: true } },
      _count: { select: { attendance: true } },
    },
    orderBy: { date: 'desc' },
  });
  return NextResponse.json(sessions);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { courseId, name, date, groups, status } = body;
  if (!courseId || !name || !date || !groups?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const course = await prisma.course.findFirst({ where: { id: courseId, professorId: session.user.id } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });

  let hostLat: number | null = typeof body.hostLat === 'number' ? body.hostLat : null;
  let hostLng: number | null = typeof body.hostLng === 'number' ? body.hostLng : null;
  let hostCity: string | null = typeof body.hostCity === 'string' ? body.hostCity.trim() : null;

  if (hostLat == null || hostLng == null) {
    const geo = await resolveHostCoordinates();
    if (geo) {
      hostLat = geo.lat;
      hostLng = geo.lng;
      hostCity = hostCity || geo.city || null;
    }
  }

  const rawClassroom =
    typeof body.classroom === 'string' && body.classroom.trim()
      ? body.classroom.trim()
      : DEFAULT_CLASSROOM;
  const classroomName = formatClassroomName(rawClassroom);
  const classroomSlug = slugifyClassroom(rawClassroom);

  // Archive any older session holding this classroom slug so the new live session gets the clean URL
  const existingWithToken = await prisma.session.findUnique({
    where: { token: classroomSlug },
  });
  if (existingWithToken) {
    await prisma.session.update({
      where: { id: existingWithToken.id },
      data: { token: `${classroomSlug}-${existingWithToken.id}` },
    });
  }

  const newSession = await prisma.session.create({
    data: {
      courseId,
      name: name.trim(),
      date: new Date(date),
      groups: Array.isArray(groups) ? groups.join(',') : groups,
      classroom: classroomName,
      token: classroomSlug,
      status: status || 'open',
      hostLat,
      hostLng,
      hostCity,
    },
  });
  return NextResponse.json(newSession, { status: 201 });
}

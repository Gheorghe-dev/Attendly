import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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
  const { courseId, name, date, groups, status, classroomLat, classroomLng, classroomRadius } = await req.json();
  if (!courseId || !name || !date || !groups?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const course = await prisma.course.findFirst({ where: { id: courseId, professorId: session.user.id } });
  if (!course) return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  const newSession = await prisma.session.create({
    data: {
      courseId,
      name: name.trim(),
      date: new Date(date),
      groups: Array.isArray(groups) ? groups.join(',') : groups,
      status: status || 'open',
      classroomLat: typeof classroomLat === 'number' ? classroomLat : null,
      classroomLng: typeof classroomLng === 'number' ? classroomLng : null,
      classroomRadius: typeof classroomRadius === 'number' ? Math.max(5, Math.min(1000, Math.round(classroomRadius))) : 50,
    },
  });
  return NextResponse.json(newSession, { status: 201 });
}

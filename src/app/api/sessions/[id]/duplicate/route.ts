import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Create a new session that mirrors another one (same name + groups + classroom).
 * Default date is "now". Caller can override via JSON body { date, name? }.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const source = await prisma.session.findFirst({
    where: { id: params.id, course: { professorId: session.user.id } },
  });
  if (!source) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { date?: string; name?: string };
  const date = body.date ? new Date(body.date) : new Date();
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
  }

  const created = await prisma.session.create({
    data: {
      courseId: source.courseId,
      name: (body.name ?? source.name).trim(),
      date,
      groups: source.groups,
      status: 'open',
      classroomLat: source.classroomLat,
      classroomLng: source.classroomLng,
      classroomRadius: source.classroomRadius,
    },
  });

  return NextResponse.json(created, { status: 201 });
}

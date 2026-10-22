import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const course = await prisma.course.findFirst({
    where: { id: params.id, professorId: session.user.id },
    include: {
      students: { orderBy: [{ group: 'asc' }, { name: 'asc' }] },
      sessions: {
        orderBy: { date: 'desc' },
        include: {
          attendance: { where: { status: 'verified' }, select: { id: true } },
        },
      },
    },
  });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const formattedCourse = {
    ...course,
    sessions: course.sessions.map((s) => ({
      ...s,
      presentCount: s.attendance.length,
    })),
  };
  return NextResponse.json(formattedCourse);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const course = await prisma.course.findFirst({
    where: { id: params.id, professorId: session.user.id },
  });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { name?: string; description?: string };
  const name = body.name !== undefined ? body.name.trim() : undefined;
  const description = body.description !== undefined ? body.description.trim() : undefined;

  if (name !== undefined && !name) {
    return NextResponse.json({ error: 'Course name is required.' }, { status: 400 });
  }
  if (name && name.length > 200) {
    return NextResponse.json({ error: 'Name is too long (max 200).' }, { status: 400 });
  }

  try {
    const updated = await prisma.course.update({
      where: { id: params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description: description || null } : {}),
      },
    });
    return NextResponse.json(updated);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      return NextResponse.json({ error: 'A course with that name already exists.' }, { status: 409 });
    }
    console.error(err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/**
 * Delete a course AND report a summary of what got torn down
 * (live sessions closed, attendance records + tokens wiped).
 * Thanks to ON DELETE CASCADE in the schema, this is one transaction.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const course = await prisma.course.findFirst({ where: { id: params.id, professorId: session.user.id } });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const [openSessions, sessions, students] = await Promise.all([
      prisma.session.count({ where: { courseId: course.id, status: 'open' } }),
      prisma.session.count({ where: { courseId: course.id } }),
      prisma.student.count({ where: { courseId: course.id } }),
    ]);

    await prisma.course.delete({ where: { id: params.id } });

    return NextResponse.json({
      success: true,
      summary: {
        studentsRemoved: students,
        sessionsRemoved: sessions,
        liveSessionsClosed: openSessions,
      },
    });
  } catch (err) {
    console.error('Course delete failed:', err);
    return NextResponse.json(
      { error: 'Could not delete the course. Try again or check the server logs.' },
      { status: 500 }
    );
  }
}

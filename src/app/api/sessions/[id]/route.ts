import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseGroups } from '@/lib/groups';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = await prisma.session.findFirst({
    where: { id: params.id, course: { professorId: session.user.id } },
    include: {
      course: true,
      attendance: {
        include: { student: true },
        orderBy: { verifiedAt: 'desc' },
      },
      unrecognized: { orderBy: { submittedAt: 'desc' } },
    },
  });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const sessionGroups = parseGroups(s.groups);
  const enrolledStudents = await prisma.student.findMany({
    where: {
      courseId: s.courseId,
      ...(sessionGroups.length > 0 ? { group: { in: sessionGroups } } : {}),
    },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json({ ...s, enrolledStudents });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = await prisma.session.findFirst({
    where: { id: params.id, course: { professorId: session.user.id } },
  });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  const dataToUpdate: Record<string, unknown> = {};
  if (typeof body.status === 'string') dataToUpdate.status = body.status;
  if (typeof body.name === 'string' && body.name.trim()) dataToUpdate.name = body.name.trim();
  if (typeof body.classroom === 'string') dataToUpdate.classroom = body.classroom.trim();
  if (typeof body.hostLat === 'number') dataToUpdate.hostLat = body.hostLat;
  if (typeof body.hostLng === 'number') dataToUpdate.hostLng = body.hostLng;
  if (typeof body.hostCity === 'string') dataToUpdate.hostCity = body.hostCity.trim();

  const updated = await prisma.session.update({
    where: { id: params.id },
    data: dataToUpdate,
  });
  return NextResponse.json(updated);
}

/**
 * Delete a session and every related attendance / token / unrecognized row.
 * One transaction thanks to ON DELETE CASCADE in the schema.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = await prisma.session.findFirst({
    where: { id: params.id, course: { professorId: session.user.id } },
  });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  try {
    const [attendance, tokens, unrecognized] = await Promise.all([
      prisma.attendanceRecord.count({ where: { sessionId: s.id } }),
      prisma.verificationToken.count({ where: { sessionId: s.id } }),
      prisma.unrecognizedSubmission.count({ where: { sessionId: s.id } }),
    ]);

    await prisma.session.delete({ where: { id: s.id } });

    return NextResponse.json({
      success: true,
      summary: {
        attendanceRemoved: attendance,
        tokensRemoved: tokens,
        unrecognizedRemoved: unrecognized,
        wasLive: s.status === 'open',
      },
    });
  } catch (err) {
    console.error('Session delete failed:', err);
    return NextResponse.json(
      { error: 'Could not delete the session. Try again or check the server logs.' },
      { status: 500 }
    );
  }
}

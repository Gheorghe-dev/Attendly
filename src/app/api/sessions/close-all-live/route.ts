import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Mass action for the professor dashboard "kill switch".
 * Closes every open session belonging to the calling professor in one shot.
 * Returns the IDs that were touched so the UI can refresh.
 */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const open = await prisma.session.findMany({
    where: { status: 'open', course: { professorId: session.user.id } },
    select: { id: true, name: true, courseId: true },
  });
  if (open.length === 0) {
    return NextResponse.json({ success: true, closed: 0, ids: [] });
  }

  const result = await prisma.session.updateMany({
    where: {
      id: { in: open.map((s) => s.id) },
      course: { professorId: session.user.id },
    },
    data: { status: 'closed' },
  });

  return NextResponse.json({
    success: true,
    closed: result.count,
    ids: open.map((s) => s.id),
    names: open.map((s) => s.name),
  });
}

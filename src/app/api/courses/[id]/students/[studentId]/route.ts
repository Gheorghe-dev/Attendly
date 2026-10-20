import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string; studentId: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const course = await prisma.course.findFirst({
    where: { id: params.id, professorId: session.user.id },
  });
  if (!course) {
    return NextResponse.json({ error: 'Course not found' }, { status: 404 });
  }

  try {
    await prisma.student.delete({
      where: { id: params.studentId, courseId: course.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[Delete student error]', err);
    return NextResponse.json({ error: 'Failed to delete student.' }, { status: 500 });
  }
}

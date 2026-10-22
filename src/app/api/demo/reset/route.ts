import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const prof = await prisma.professor.findUnique({
    where: { id: session.user.id },
  });

  if (!prof) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }

  // Only allow demo reset for the demo account
  if (prof.email !== 'prof@university.edu') {
    return NextResponse.json(
      { error: 'Reset is only available for the demo account.' },
      { status: 403 }
    );
  }

  // Delete all courses belonging to the demo account (cascades to students, sessions, attendances)
  const result = await prisma.course.deleteMany({
    where: { professorId: prof.id },
  });

  return NextResponse.json({
    success: true,
    message: 'Demo account reset to fresh new account state.',
    coursesRemoved: result.count,
  });
}

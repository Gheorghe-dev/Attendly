import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
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
    const body = await req.json();
    const name = body?.name?.trim();
    const rawEmail = body?.email?.trim();
    const group = body?.group?.trim();

    if (!name || !rawEmail || !group) {
      return NextResponse.json(
        { error: 'Name, email, and group are required.' },
        { status: 400 }
      );
    }

    const email = rawEmail.toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format.' },
        { status: 400 }
      );
    }

    const student = await prisma.student.upsert({
      where: { email_courseId: { email, courseId: course.id } },
      update: { name, group },
      create: { name, email, group, courseId: course.id },
    });

    return NextResponse.json({ ok: true, student });
  } catch (err) {
    console.error('[Add student manual error]', err);
    return NextResponse.json({ error: 'Failed to add student.' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const courses = await prisma.course.findMany({
    where: { professorId: session.user.id },
    include: { _count: { select: { students: true, sessions: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(courses);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Course name required' }, { status: 400 });
  try {
    const course = await prisma.course.create({
      data: { name: name.trim(), professorId: session.user.id },
    });
    return NextResponse.json(course, { status: 201 });
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code === 'P2002') return NextResponse.json({ error: 'Course name already exists' }, { status: 409 });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

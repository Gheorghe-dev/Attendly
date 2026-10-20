import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildMultiSessionExcel } from '@/lib/excel';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const course = await prisma.course.findFirst({
    where: { id: params.id, professorId: session.user.id },
    include: {
      sessions: {
        include: { attendance: { include: { student: true } } },
        orderBy: { date: 'asc' },
      },
    },
  });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sessionsData = await Promise.all(
    course.sessions.map(async (s) => {
      const sessionGroups = s.groups.split(',').map((g: string) => g.trim());
      const students = await prisma.student.findMany({
        where: { courseId: course.id, group: { in: sessionGroups } },
        orderBy: [{ group: 'asc' }, { name: 'asc' }],
      });
      const attendance = new Map<string, { verifiedAt: Date | null; status: string }>();
      for (const rec of s.attendance) {
        attendance.set(rec.student.email, { verifiedAt: rec.verifiedAt, status: rec.status });
      }
      return { sessionName: s.name, courseName: course.name, sessionDate: s.date, students, attendance };
    })
  );

  const buffer = await buildMultiSessionExcel(sessionsData);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${course.name.replace(/[^a-z0-9]/gi, '-')}-all-sessions.xlsx"`,
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { buildAttendanceExcel } from '@/lib/excel';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const s = await prisma.session.findFirst({
    where: { id: params.id, course: { professorId: session.user.id } },
    include: {
      course: true,
      attendance: { include: { student: true } },
    },
  });
  if (!s) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const sessionGroups = s.groups.split(',').map((g: string) => g.trim());
  const students = await prisma.student.findMany({
    where: { courseId: s.courseId, group: { in: sessionGroups } },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  });

  const attendanceMap = new Map<string, { verifiedAt: Date | null; status: string }>();
  for (const rec of s.attendance) {
    attendanceMap.set(rec.student.email, { verifiedAt: rec.verifiedAt, status: rec.status });
  }

  const buffer = await buildAttendanceExcel({
    students,
    attendance: attendanceMap,
    courseName: s.course.name,
    sessionDate: s.date,
    sessionName: s.name,
  });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="attendance-${s.name.replace(/[^a-z0-9]/gi, '-')}-${s.date.toISOString().split('T')[0]}.xlsx"`,
    },
  });
}

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/ui/PageHeader';
import { CreateCourseDialog } from '@/components/dashboard/CreateCourseDialog';
import { CoursesClientView } from './CoursesClientView';
import { CourseCardProps } from '@/components/dashboard/CourseCard';

export const dynamic = 'force-dynamic';

export default async function CoursesPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const courses = await prisma.course.findMany({
    where: { professorId: session.user.id },
    include: {
      _count: {
        select: {
          students: true,
          sessions: true,
        },
      },
      sessions: {
        orderBy: { date: 'desc' },
        include: {
          _count: {
            select: {
              attendance: { where: { status: 'verified' } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formattedCourses: CourseCardProps[] = courses.map((c) => {
    const totalAttended = c.sessions.reduce((acc, s) => acc + s._count.attendance, 0);
    const totalPossible = c._count.sessions * c._count.students;
    const rate = totalPossible > 0 ? Math.min(100, Math.round((totalAttended / totalPossible) * 100)) : 0;

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      studentCount: c._count.students,
      sessionCount: c._count.sessions,
      lastSessionDate: c.sessions[0]?.date ? new Date(c.sessions[0].date) : null,
      attendanceRate: rate,
    };
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Courses & Modules"
        description="Manage student rosters, academic groups, and attendance sessions for each course."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Courses' },
        ]}
        action={<CreateCourseDialog />}
      />

      <CoursesClientView initialCourses={formattedCourses} />
    </div>
  );
}

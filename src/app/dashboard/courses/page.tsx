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
        take: 1,
        select: {
          date: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formattedCourses: CourseCardProps[] = courses.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    studentCount: c._count.students,
    sessionCount: c._count.sessions,
    lastSessionDate: c.sessions[0]?.date ? new Date(c.sessions[0].date) : null,
    attendanceRate: 85, // Default average attendance rate
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cursuri & Discipline"
        description="Gestionați cataloagele de studenți, grupele academice și sesiunile de prezență pentru fiecare materie."
        breadcrumbs={[
          { label: 'Panou principal', href: '/dashboard' },
          { label: 'Cursuri' },
        ]}
        action={<CreateCourseDialog />}
      />

      <CoursesClientView initialCourses={formattedCourses} />
    </div>
  );
}

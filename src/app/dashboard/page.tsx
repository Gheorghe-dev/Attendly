import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { CourseCard } from '@/components/dashboard/CourseCard';
import { CreateCourseDialog } from '@/components/dashboard/CreateCourseDialog';
import { StatCard } from '@/components/ui/StatCard';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  BookOpen,
  Users,
  Calendar,
  Radio,
  ArrowRight,
} from 'lucide-react';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Time-aware greeting
  const hour = new Date().getHours();
  const greeting =
    hour < 12
      ? 'Good morning'
      : hour < 18
      ? 'Good afternoon'
      : 'Good evening';

  const todayStr = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  // Fetch courses with student and session counts
  const [courses, sessions] = await Promise.all([
    prisma.course.findMany({
      where: { professorId: session.user.id },
      include: {
        _count: { select: { students: true, sessions: true } },
        sessions: {
          orderBy: { date: 'desc' },
          include: {
            _count: { select: { attendance: { where: { status: 'verified' } } } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.session.findMany({
      where: { course: { professorId: session.user.id } },
      include: {
        course: { select: { id: true, name: true } },
        attendance: { where: { status: 'verified' } },
      },
      orderBy: { date: 'desc' },
      take: 20,
    }),
  ]);

  // Aggregate statistics
  const totalStudents = courses.reduce((sum, c) => sum + c._count.students, 0);
  const activeSessions = sessions.filter((s) => s.status === 'open');

  // Sessions this week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const sessionsThisWeek = sessions.filter((s) => new Date(s.date) >= oneWeekAgo).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── Top Academic Greeting ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <p className="text-xs font-mono text-muted-foreground capitalize">
            {todayStr}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {greeting}, {session.user.name || 'Professor'}
          </h1>
          <p className="text-xs text-muted-foreground">
            Centralized academic dashboard for managing course and laboratory attendance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CreateCourseDialog />
        </div>
      </div>

      {/* ── Demo Account Fresh Start Notice ─────────────────────────── */}
      {session.user.email === 'prof@university.edu' && courses.length === 0 && (
        <Card className="p-4 rounded-card border border-accent/30 bg-accent-soft/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground flex items-center gap-1.5 font-sans">
              🎓 Demo Account (Clean Slate)
            </span>
            <p className="text-muted-foreground text-[11px]">
              This demo account acts like a brand-new instructor profile. Click <strong>+ New Course</strong> above to create your first course and test the Excel roster import!
            </p>
          </div>
        </Card>
      )}

      {/* ── Prominent Active Session Card (if any session is open) ───── */}
      {activeSessions.length > 0 && (
        <Card className="p-6 border-accent/40 bg-accent-soft/20 shadow-md relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <LiveBadge isOpen={true} />
                <span className="text-xs font-mono font-semibold text-accent uppercase tracking-wider">
                  Active Session in Progress
                </span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-foreground">
                {activeSessions[0].name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Course:{' '}
                <span className="font-medium text-foreground">
                  {activeSessions[0].course.name}
                </span>{' '}
                · {activeSessions[0].classroom ? `Classroom ${activeSessions[0].classroom}` : 'QR code projected'} · {activeSessions[0].attendance.length} students present
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/dashboard/sessions/${activeSessions[0].id}`}>
                <Button variant="accent" size="md" className="shadow-md">
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>Open Live Monitor</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* ── StatCards Grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Active Courses"
          value={courses.length}
          context="Enrolled this semester"
          icon={<BookOpen className="w-4 h-4" />}
        />
        <StatCard
          label="Total Students"
          value={totalStudents}
          context="Registered in rosters"
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Sessions This Week"
          value={sessionsThisWeek}
          context="Lectures and labs"
          icon={<Calendar className="w-4 h-4" />}
        />
      </div>

      {/* ── Course Grid Section ─────────────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
              My Courses
            </h2>
            <p className="text-xs text-muted-foreground">
              Select a course to manage its roster, import Excel files, or launch attendance sessions.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {courses.length} {courses.length === 1 ? 'course' : 'courses'}
          </span>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-6 h-6 text-accent" />}
            title="No courses yet"
            description="Create your first course to start importing student rosters and generating attendance QR codes."
            action={<CreateCourseDialog />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course) => {
              const lastDate = course.sessions[0]?.date || null;
              const totalAttended = course.sessions.reduce((acc, s) => acc + s._count.attendance, 0);
              const totalPossible = course._count.sessions * course._count.students;
              const rate = totalPossible > 0 ? Math.min(100, Math.round((totalAttended / totalPossible) * 100)) : 0;

              return (
                <CourseCard
                  key={course.id}
                  id={course.id}
                  name={course.name}
                  description={course.description}
                  studentCount={course._count.students}
                  sessionCount={course._count.sessions}
                  lastSessionDate={lastDate}
                  attendanceRate={rate}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

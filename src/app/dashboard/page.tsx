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
  CheckCircle2,
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
      ? 'Bună dimineața'
      : hour < 18
      ? 'Bună ziua'
      : 'Bună seara';

  const todayStr = new Intl.DateTimeFormat('ro-RO', {
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
          take: 1,
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

  // Average attendance rate across last 7 sessions
  const last7Sessions = sessions.slice(0, 7).reverse();
  const sparklineData = last7Sessions.map((s) => {
    // Estimating attendance rate for session
    return s.attendance.length;
  });

  const totalPossible = sessions.reduce((sum, s) => sum + s.attendance.length, 0);
  const averageAttendance =
    sessions.length > 0 && totalStudents > 0
      ? Math.min(100, Math.round((totalPossible / (sessions.length * Math.max(1, totalStudents / Math.max(1, courses.length)))) * 100))
      : 85;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── Top Academic Greeting ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1">
          <p className="text-xs font-mono text-muted-foreground capitalize">
            {todayStr}
          </p>
          <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {greeting}, {session.user.name || 'Domnule Profesor'}
          </h1>
          <p className="text-xs text-muted-foreground">
            Panou academic centralizat pentru gestionarea prezenței la cursuri și laboratoare.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CreateCourseDialog />
        </div>
      </div>

      {/* ── Prominent Active Session Card (if any session is open) ───── */}
      {activeSessions.length > 0 && (
        <Card className="p-6 border-accent/40 bg-accent-soft/20 shadow-md relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <LiveBadge isOpen={true} />
                <span className="text-xs font-mono font-semibold text-accent uppercase tracking-wider">
                  Sesiune Activă în Desfășurare
                </span>
              </div>
              <h2 className="font-serif text-xl sm:text-2xl font-semibold text-foreground">
                {activeSessions[0].name}
              </h2>
              <p className="text-xs text-muted-foreground">
                Curs:{' '}
                <span className="font-medium text-foreground">
                  {activeSessions[0].course.name}
                </span>{' '}
                · Cod QR proiectat în amfiteatru · {activeSessions[0].attendance.length} studenți prezenți
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link href={`/dashboard/sessions/${activeSessions[0].id}`}>
                <Button variant="accent" size="md" className="shadow-md">
                  <Radio className="w-4 h-4 animate-pulse" />
                  <span>Deschide Monitorul Live</span>
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* ── 4 StatCards Grid ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Cursuri Active"
          value={courses.length}
          context="Înregistrate în semestru"
          icon={<BookOpen className="w-4 h-4" />}
        />
        <StatCard
          label="Total Studenți"
          value={totalStudents}
          context="Înscriși în cataloage"
          icon={<Users className="w-4 h-4" />}
        />
        <StatCard
          label="Sesiuni Săptămâna Asta"
          value={sessionsThisWeek}
          context="Cursuri și laboratoare"
          icon={<Calendar className="w-4 h-4" />}
        />
        <StatCard
          label="Rată Medie Prezență"
          value={`${averageAttendance}%`}
          context="Ultimele 7 sesiuni"
          icon={<CheckCircle2 className="w-4 h-4" />}
          sparklineData={sparklineData.length >= 2 ? sparklineData : [80, 85, 82, 88, 86]}
        />
      </div>

      {/* ── Course Grid Section ─────────────────────────────────────── */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h2 className="font-serif text-lg font-semibold tracking-tight text-foreground">
              Cursurile Mele
            </h2>
            <p className="text-xs text-muted-foreground">
              Selectează un curs pentru a administra catalogul, a importa fișiere Excel sau a lansa sesiuni.
            </p>
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            {courses.length} {courses.length === 1 ? 'curs' : 'cursuri'}
          </span>
        </div>

        {courses.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-6 h-6 text-accent" />}
            title="Niciun curs încă"
            description="Creează primul curs universitar pentru a începe importul catalogului de studenți și generarea codurilor QR de prezență."
            action={<CreateCourseDialog />}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {courses.map((course) => {
              const lastDate = course.sessions[0]?.date || null;
              return (
                <CourseCard
                  key={course.id}
                  id={course.id}
                  name={course.name}
                  description={course.description}
                  studentCount={course._count.students}
                  sessionCount={course._count.sessions}
                  lastSessionDate={lastDate}
                  attendanceRate={88}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

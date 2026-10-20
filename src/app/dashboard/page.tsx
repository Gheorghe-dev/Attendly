import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { CourseCard } from '@/components/CourseActions';
import { LiveSessionsPanel } from '@/components/LiveSessionsPanel';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [courses, allSessions] = await Promise.all([
    prisma.course.findMany({
      where: { professorId: session.user.id },
      include: {
        _count: { select: { students: true, sessions: true } },
        sessions: {
          include: { _count: { select: { attendance: true } } },
          orderBy: { date: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.session.findMany({
      where: { course: { professorId: session.user.id } },
      include: {
        course: { select: { name: true, id: true } },
        _count: { select: { attendance: true } },
        attendance: { where: { status: 'verified' } },
      },
      orderBy: { date: 'desc' },
      take: 10,
    }),
  ]);

  const openSessions = allSessions.filter(s => s.status === 'open');
  const recentSessions = allSessions.slice(0, 5);
  const totalStudents = courses.reduce((sum, c) => sum + c._count.students, 0);
  const totalVerified = allSessions.reduce((sum, s) => sum + s.attendance.length, 0);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Welcome back, <span className="font-semibold text-blue-600">{session.user?.name}</span>
          </p>
        </div>
        <div className="hidden md:flex gap-3">
          <Link href="/dashboard/courses" className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            New Course
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Courses"
          value={courses.length}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>}
          color="blue"
          href="/dashboard/courses"
        />
        <StatCard
          label="Live Sessions"
          value={openSessions.length}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>}
          color="green"
          pulse={openSessions.length > 0}
          href="/dashboard/sessions"
        />
        <StatCard
          label="Total Students"
          value={totalStudents}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
          color="purple"
        />
        <StatCard
          label="Attendances Verified"
          value={totalVerified}
          icon={<svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          color="emerald"
        />
      </div>

      {/* Live Sessions Alert */}
      {openSessions.length > 0 && (
        <LiveSessionsPanel
          sessions={openSessions.map((s) => ({
            id: s.id,
            name: s.name,
            course: { id: s.course.id, name: s.course.name },
            attendance: s.attendance.map((a) => ({ id: a.id })),
          }))}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Courses */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Your Courses</h2>
            <Link href="/dashboard/courses" className="text-sm text-blue-600 hover:underline font-medium">Manage all →</Link>
          </div>

          {courses.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-gray-500 mb-4">No courses yet. Create your first course to get started.</p>
              <Link href="/dashboard/courses" className="btn-primary">Create First Course</Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {courses.map(c => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          )}
        </div>

        {/* Recent Sessions */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Recent Sessions</h2>
            <Link href="/dashboard/sessions" className="text-sm text-blue-600 hover:underline font-medium">All →</Link>
          </div>
          {recentSessions.length === 0 ? (
            <div className="card p-8 text-center">
              <svg className="w-8 h-8 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-sm text-gray-400">No sessions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.map(s => (
                <Link key={s.id} href={`/dashboard/sessions/${s.id}`}
                  className="card p-4 flex items-start gap-3 hover:border-blue-200 hover:shadow-sm transition-all group">
                  <div className={`mt-0.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.status === 'open' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate group-hover:text-blue-700">{s.name}</p>
                    <p className="text-xs text-gray-400 truncate">{s.course.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date(s.date).toLocaleDateString()} · {s.attendance.length} present</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="card p-4 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick Actions</p>
            <Link href="/dashboard/courses" className="flex items-center gap-3 p-2 hover:bg-blue-50 rounded-lg group transition-all">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <span className="text-sm font-medium text-gray-700 group-hover:text-blue-700">Create Course</span>
            </Link>
            {courses.length > 0 && (
              <Link href={`/dashboard/courses/${courses[0].id}/sessions/new`} className="flex items-center gap-3 p-2 hover:bg-green-50 rounded-lg group transition-all">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700 group-hover:text-green-700">Start New Session</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, color, pulse = false, href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  pulse?: boolean;
  href?: string;
}) {
  const colors: Record<string, { bg: string; icon: string; text: string }> = {
    blue:    { bg: 'bg-blue-50',    icon: 'bg-blue-100 text-blue-600',    text: 'text-blue-600'    },
    green:   { bg: 'bg-green-50',   icon: 'bg-green-100 text-green-600',  text: 'text-green-600'   },
    purple:  { bg: 'bg-purple-50',  icon: 'bg-purple-100 text-purple-600',text: 'text-purple-600'  },
    emerald: { bg: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-600', text: 'text-emerald-600' },
  };
  const c = colors[color];
  const inner = (
    <div className={`card p-5 ${c.bg} ${href ? 'hover:shadow-md transition-all cursor-pointer' : ''}`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 ${c.icon} rounded-xl flex items-center justify-center`}>
          {icon}
        </div>
        {pulse && (
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-2.5 w-2.5 rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
        )}
      </div>
      <div className="mt-4">
        <div className="text-3xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-500 mt-0.5">{label}</div>
      </div>
    </div>
  );
  if (href) return <Link href={href}>{inner}</Link>;
  return inner;
}

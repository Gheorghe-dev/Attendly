import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { SessionRowActions } from '@/components/SessionRowActions';

export default async function SessionsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const sessions = await prisma.session.findMany({
    where: { course: { professorId: session.user.id } },
    include: {
      course: { select: { name: true, id: true } },
      attendance: { where: { status: 'verified' } },
      _count: { select: { attendance: true } },
    },
    orderBy: { date: 'desc' },
  });

  const openCount = sessions.filter(s => s.status === 'open').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sessions</h1>
          <p className="text-gray-500 mt-1">
            {sessions.length} session{sessions.length !== 1 ? 's' : ''}
            {openCount > 0 && <> · <span className="text-emerald-600 font-semibold">{openCount} open now</span></>}
          </p>
        </div>
        <Link href="/dashboard/courses" className="btn-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          New Session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="card p-20 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No sessions yet</h3>
          <p className="text-gray-400 mb-6">Create a course and then start your first session.</p>
          <Link href="/dashboard/courses" className="btn-primary">Go to Courses</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(s => {
            const verified = s.attendance.length;
            const isOpen = s.status === 'open';
            const groups = s.groups.split(',').map(g => g.trim());
            return (
              <div key={s.id} className={`card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 hover:shadow-md transition-all ${isOpen ? 'border-l-4 border-l-emerald-400' : ''}`}>
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isOpen ? 'bg-emerald-500 shadow-sm shadow-emerald-300' : 'bg-gray-300'}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="font-bold text-gray-900">{s.name}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-500 text-sm">{s.course.name}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                      <span>{new Date(s.date).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      <span>·</span>
                      <span>{new Date(s.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span>·</span>
                      {groups.map(g => <span key={g} className="badge-group">{g}</span>)}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <div className="text-lg font-bold text-gray-900">{verified}</div>
                    <div className="text-xs text-gray-400">verified</div>
                  </div>
                  <span className={isOpen ? 'badge-open' : 'badge-closed'}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {isOpen ? 'Open' : 'Closed'}
                  </span>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/sessions/${s.id}`}
                      className="btn-primary text-sm py-1.5 px-3">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      Monitor
                    </Link>
                    <a href={`/api/sessions/${s.id}/export`}
                      className="btn-secondary text-sm py-1.5 px-3">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                      Export
                    </a>
                    <SessionRowActions id={s.id} name={s.name} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

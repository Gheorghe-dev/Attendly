'use client';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { QRDisplay } from '@/components/QRDisplay';

interface AttendanceRecord {
  id: string; status: string; verifiedAt: string | null;
  studentLat: number | null; studentLng: number | null; studentAccuracy: number | null;
  distanceMeters: number | null;
  student: { id: string; name: string; email: string; group: string };
}
interface SessionDetail {
  id: string; name: string; status: string;
  date: string; groups: string;
  course: { id: string; name: string };
  classroomLat: number | null;
  classroomLng: number | null;
  classroomRadius: number;
  attendance: AttendanceRecord[];
  enrolledStudents: Array<{ id: string; name: string; email: string; group: string }>;
  unrecognized: Array<{ id: string; email: string; submittedAt: string }>;
}

export default function SessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [qr, setQr] = useState<{
    qr: string;
    url: string;
    scannedFromLocalhost?: boolean;
    baseUrl?: string;
    tip?: string;
  } | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [filter, setFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [toggling, setToggling] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [activeTab, setActiveTab] = useState<'roster' | 'unrecognized'>('roster');

  const load = useCallback(async () => {
    const res = await fetch(`/api/sessions/${id}`);
    if (res.ok) setSession(await res.json());
  }, [id]);

  useEffect(() => {
    load();
    fetch(`/api/sessions/${id}/qr`).then(r => r.json()).then(setQr);
  }, [id, load]);

  // SSE live updates
  useEffect(() => {
    const es = new EventSource(`/api/sessions/${id}/stream`);
    es.onmessage = () => load();
    es.onerror = () => es.close();
    return () => es.close();
  }, [id, load]);

  async function toggleStatus() {
    if (!session) return;
    setToggling(true);
    const newStatus = session.status === 'open' ? 'closed' : 'open';
    await fetch(`/api/sessions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    await load();
    setToggling(false);
  }

  async function duplicateSession() {
    if (!session) return;
    setDuplicating(true);
    try {
      const res = await fetch(`/api/sessions/${id}/duplicate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? 'Could not duplicate.');
        return;
      }
      router.push(`/dashboard/sessions/${data.id}`);
    } finally {
      setDuplicating(false);
    }
  }

  if (!session) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-80" />
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl" />)}
      </div>
      <div className="h-96 bg-gray-100 rounded-2xl" />
    </div>
  );

  const sessionGroups = session.groups.split(',').map(g => g.trim());
  const verifiedEmails = new Set(
    session.attendance.filter(a => a.status === 'verified').map(a => a.student.email)
  );

  const filteredStudents = session.enrolledStudents.filter(s => {
    const q = filter.toLowerCase();
    const textOk = !q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
    const groupOk = !groupFilter || s.group === groupFilter;
    const present = verifiedEmails.has(s.email);
    const statusOk = !statusFilter || (statusFilter === 'present' ? present : !present);
    return textOk && groupOk && statusOk;
  });

  const presentCount = verifiedEmails.size;
  const totalCount = session.enrolledStudents.length;
  const absentCount = totalCount - presentCount;
  const pct = totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  const recentVerified = session.attendance
    .filter(a => a.status === 'verified')
    .sort((a, b) => new Date(b.verifiedAt!).getTime() - new Date(a.verifiedAt!).getTime())
    .slice(0, 5);

  // Proximity stats for verified records that have distance data
  const verifiedWithDistance = session.attendance.filter(
    a => a.status === 'verified' && a.studentLat != null && a.studentLng != null
  );
  const proximityStats = session.classroomLat != null && session.classroomLng != null
    ? {
        in:  verifiedWithDistance.filter(a => (a.distanceMeters ?? Infinity) <= session.classroomRadius).length,
        out: verifiedWithDistance.filter(a => (a.distanceMeters ?? 0) >  session.classroomRadius).length,
        none: session.attendance.filter(a => a.status === 'verified' && a.distanceMeters == null).length
             + (session.attendance.filter(a => a.status === 'verified').length - verifiedWithDistance.length),
      }
    : null;

  return (
    <div className="space-y-6">
      {showQR && qr && (
        <QRDisplay
          qr={qr.qr} url={qr.url}
          sessionName={session.name} courseName={session.course.name}
          onClose={() => setShowQR(false)}
        />
      )}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400 flex-wrap">
        <Link href="/dashboard" className="hover:text-gray-600">Dashboard</Link>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <Link href={`/dashboard/courses/${session.course.id}`} className="hover:text-gray-600">{session.course.name}</Link>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-gray-700 font-medium">{session.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{session.name}</h1>
            <span className={session.status === 'open' ? 'badge-open' : 'badge-closed'}>
              <span className={`w-1.5 h-1.5 rounded-full ${session.status === 'open' ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              {session.status === 'open' ? 'Open' : 'Closed'}
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            {session.course.name} · {new Date(session.date).toLocaleString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {sessionGroups.map(g => <span key={g} className="badge-group">{g}</span>)}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setShowQR(true)}
            className="btn-primary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Show QR Code
          </button>
          <button onClick={toggleStatus} disabled={toggling}
            className={session.status === 'open'
              ? 'btn-danger'
              : 'inline-flex items-center gap-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium px-4 py-2 rounded-lg border border-emerald-200 transition-all'
            }>
            {session.status === 'open' ? (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>Close Registration</>
            ) : (
              <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg>Reopen Registration</>
            )}
          </button>
          <a href={`/api/sessions/${id}/export`}
            className="btn-secondary">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export Excel
          </a>
          <button
            onClick={duplicateSession}
            disabled={duplicating}
            className="inline-flex items-center gap-2 bg-purple-50 hover:bg-purple-100 active:bg-purple-200 text-purple-700 font-medium px-4 py-2 rounded-lg border border-purple-200 transition-all disabled:opacity-50"
            title="Create a copy of this session for a follow-up lecture. Same groups, classroom and radius; date defaults to now."
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {duplicating ? 'Duplicating…' : 'Duplicate'}
          </button>
        </div>
      </div>

      {/* Warning when professor opened dashboard from localhost — the QR still
          encodes the LAN/public URL (APP_URL) so phones can reach it, but
          here we make that obvious and offer a copy-paste phone URL. */}
      {qr?.scannedFromLocalhost && (
        <div className="card p-4 bg-amber-50 border-amber-200">
          <div className="flex items-start gap-3 flex-wrap">
            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-amber-900">
                You opened this dashboard from <code className="bg-amber-100 px-1 rounded">localhost</code> — your phone will not be able to scan a QR that says <code className="bg-amber-100 px-1 rounded">http://localhost:3000/…</code>.
              </p>
              <p className="text-sm text-amber-800 mt-1">
                The QR codes this page generates already use your <strong>LAN base URL</strong> ({qr.baseUrl || 'set APP_URL in .env'}), so scanning them on a phone that&apos;s on the same Wi-Fi will work. To be safe, you can also copy the URL below and text/email it.
              </p>
              <div className="mt-3 flex items-center gap-2 bg-white rounded-lg border border-amber-200 p-2">
                <code className="text-xs text-gray-700 flex-1 break-all px-2">{qr.url}</code>
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(qr.url)}
                  className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold px-3 py-1.5 rounded-md"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="text-3xl font-bold text-blue-700">{totalCount}</div>
          <div className="text-sm text-gray-500 mt-1">Enrolled</div>
          <div className="text-xs text-gray-400 mt-0.5">in selected groups</div>
        </div>
        <div className="card p-5 bg-emerald-50 border-emerald-200">
          <div className="text-3xl font-bold text-emerald-700">{presentCount}</div>
          <div className="text-sm text-gray-500 mt-1">Present</div>
          <div className="text-xs text-gray-400 mt-0.5">verified attendance</div>
        </div>
        <div className="card p-5 bg-red-50 border-red-200">
          <div className="text-3xl font-bold text-red-600">{absentCount}</div>
          <div className="text-sm text-gray-500 mt-1">Absent</div>
          <div className="text-xs text-gray-400 mt-0.5">not yet verified</div>
        </div>
        <div className="card p-5">
          <div className="text-3xl font-bold text-gray-900">{pct}%</div>
          <div className="text-sm text-gray-500 mt-1">Attendance Rate</div>
          <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-500 ${pct >= 75 ? 'bg-emerald-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Attendance Table */}
        <div className="lg:col-span-2 card">
          {/* Tabs */}
          <div className="border-b border-gray-100 px-4">
            <div className="flex gap-4">
              {[
                ['roster', `Attendance Roster`, totalCount],
                ['unrecognized', 'Unrecognized', session.unrecognized.length],
              ].map(([tab, label, count]) => (
                <button key={tab} onClick={() => setActiveTab(tab as 'roster' | 'unrecognized')}
                  className={`pb-3 pt-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all ${
                    activeTab === tab
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-400 hover:text-gray-600'
                  }`}>
                  {label}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                  }`}>{count}</span>
                </button>
              ))}
            </div>
          </div>

          {activeTab === 'roster' && (
            <>
              {/* Filters */}
              <div className="p-4 border-b border-gray-50 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-40">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input value={filter} onChange={e => setFilter(e.target.value)}
                    className="input pl-9 text-sm" placeholder="Search name or email…" />
                </div>
                <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="input w-auto text-sm">
                  <option value="">All Groups</option>
                  {sessionGroups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-auto text-sm">
                  <option value="">All Status</option>
                  <option value="present">Present only</option>
                  <option value="absent">Absent only</option>
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">#</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Student</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Email</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Group</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                      {session.classroomLat != null && (
                        <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Distance</th>
                      )}
                      <th className="text-left py-3 px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filteredStudents.map((s, i) => {
                      const present = verifiedEmails.has(s.email);
                      const rec = session.attendance.find(a => a.student.email === s.email);
                      const distance = rec?.distanceMeters;
                      const inRadius = distance != null && session.classroomLat != null && distance <= session.classroomRadius;
                      const outRadius = distance != null && session.classroomLat != null && distance >  session.classroomRadius;
                      return (
                        <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${present ? '' : ''} ${outRadius ? 'bg-red-50/40' : ''}`}>
                          <td className="py-3 px-4 text-gray-300 font-mono text-xs">{i + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                                present ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {s.name.charAt(0)}
                              </div>
                              <span className="font-medium text-gray-900">{s.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-gray-400 font-mono text-xs hidden md:table-cell">{s.email}</td>
                          <td className="py-3 px-4"><span className="badge-group">{s.group}</span></td>
                          <td className="py-3 px-4">
                            <span className={present ? 'badge-present' : 'badge-absent'}>
                              <span className={`w-1.5 h-1.5 rounded-full ${present ? 'bg-emerald-500' : 'bg-red-500'}`} />
                              {present ? 'Present' : 'Absent'}
                            </span>
                          </td>
                          {session.classroomLat != null && (
                            <td className="py-3 px-4 text-xs">
                              {distance == null ? (
                                present ? (
                                  <span className="text-gray-400">—</span>
                                ) : (
                                  <span className="text-gray-300">—</span>
                                )
                              ) : inRadius ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  {distance < 1000 ? `${Math.round(distance)} m` : `${(distance/1000).toFixed(1)} km`}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                  {distance < 1000 ? `${Math.round(distance)} m` : `${(distance/1000).toFixed(1)} km`}
                                </span>
                              )}
                            </td>
                          )}
                          <td className="py-3 px-4 text-gray-400 text-xs hidden lg:table-cell">
                            {rec?.verifiedAt ? new Date(rec.verifiedAt).toLocaleTimeString('en-GB') : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
                  <span>Showing {filteredStudents.length} of {totalCount} students</span>
                  <span>{presentCount} present · {absentCount} absent</span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'unrecognized' && (
            <div>
              {session.unrecognized.length === 0 ? (
                <div className="p-12 text-center">
                  <svg className="w-10 h-10 text-gray-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-gray-400 text-sm">No unrecognized submissions</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {session.unrecognized.map(u => (
                    <div key={u.id} className="flex items-center justify-between px-4 py-3 hover:bg-orange-50">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 bg-orange-100 rounded-full flex items-center justify-center">
                          <svg className="w-4 h-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <span className="font-mono text-sm text-orange-700">{u.email}</span>
                      </div>
                      <span className="text-xs text-gray-400">{new Date(u.submittedAt).toLocaleString('en-GB')}</span>
                    </div>
                  ))}
                  <div className="px-4 py-3 bg-orange-50 border-t">
                    <p className="text-xs text-orange-700">
                      These emails were submitted but not found in the student list. They are stored for review and never counted as attendance.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* QR Quick Access */}
          {qr && (
            <div className="card p-5 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Attendance QR Code</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr.qr} alt="QR Code" className="w-36 h-36 mx-auto mb-3 rounded-lg" />
              <button onClick={() => setShowQR(true)}
                className="btn-primary w-full justify-center text-sm">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                Full Screen / Projector
              </button>
              <p className="text-xs text-gray-400 mt-2 break-all">{qr.url}</p>
            </div>
          )}

          {/* Recent Arrivals */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              {session.status === 'open' && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {session.status === 'open' ? 'Live — Recent Arrivals' : 'Recent Arrivals'}
              </p>
            </div>
            {recentVerified.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No verified attendances yet</p>
            ) : (
              <div className="space-y-2">
                {recentVerified.map(a => (
                  <div key={a.id} className="flex items-center gap-3 p-2 bg-emerald-50 rounded-lg">
                    <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-700 font-bold text-xs flex-shrink-0">
                      {a.student.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.student.name}</p>
                      <p className="text-xs text-gray-400">{a.student.group} · {a.verifiedAt ? new Date(a.verifiedAt).toLocaleTimeString('en-GB') : ''}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Session Info */}
          <div className="card p-5 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Session Info</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Course</span>
                <span className="font-medium text-gray-900 text-right">{session.course.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="font-medium text-gray-900">{new Date(session.date).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Time</span>
                <span className="font-medium text-gray-900">{new Date(session.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Groups</span>
                <span className="font-medium text-gray-900">{sessionGroups.join(', ')}</span>
              </div>
              {session.classroomLat != null && session.classroomLng != null ? (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Classroom</span>
                    <a
                      className="font-mono text-xs text-blue-600 hover:underline"
                      href={`https://www.openstreetmap.org/?mlat=${session.classroomLat}&mlon=${session.classroomLng}#map=18/${session.classroomLat}/${session.classroomLng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {session.classroomLat.toFixed(4)}, {session.classroomLng.toFixed(4)}
                    </a>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Radius</span>
                    <span className="font-medium text-gray-900">{session.classroomRadius} m</span>
                  </div>
                  {proximityStats && (
                    <div className="pt-2 mt-2 border-t border-gray-100 space-y-1.5">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Proximity</p>
                      <div className="flex justify-between text-xs">
                        <span className="text-emerald-700">In classroom</span>
                        <span className="font-semibold">{proximityStats.in}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-red-600">Outside radius</span>
                        <span className="font-semibold">{proximityStats.out}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">No location</span>
                        <span className="font-semibold">{proximityStats.none}</span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="pt-2 mt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    No classroom location set. Distance checks are disabled.
                  </p>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Unrecognized</span>
                <span className={`font-medium ${session.unrecognized.length > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                  {session.unrecognized.length}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

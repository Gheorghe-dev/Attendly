'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface Course {
  id: string;
  name: string;
  createdAt: string;
  _count: { students: number; sessions: number };
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/courses');
    if (res.ok) setCourses(await res.json());
    setFetching(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setName('');
      load();
    } finally {
      setLoading(false);
    }
  }

  async function deleteCourse(id: string) {
    setDeleteConfirm(null);
    const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? 'Could not delete course.');
      return;
    }
    const s = data.summary;
    const parts: string[] = [];
    if (s?.studentsRemoved) parts.push(`${s.studentsRemoved} student(s)`);
    if (s?.sessionsRemoved) parts.push(`${s.sessionsRemoved} session(s)`);
    if (s?.liveSessionsClosed) parts.push(`${s.liveSessionsClosed} live session(s) closed`);
    alert(
      parts.length
        ? `Course deleted. ${parts.join(', ')}.`
        : 'Course deleted.'
    );
    load();
  }

  if (fetching) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-40" />
        <div className="h-24 bg-gray-100 rounded-2xl" />
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-40 bg-gray-100 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Courses</h1>
          <p className="text-gray-500 mt-1">{courses.length} course{courses.length !== 1 ? 's' : ''} total</p>
        </div>
      </div>

      {/* Create Form */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-100 rounded flex items-center justify-center">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          Create New Course
        </h2>
        <form onSubmit={create} className="flex gap-3">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="input flex-1"
            placeholder="e.g. Mathematics 101, Computer Science, Physics Lab…"
          />
          <button type="submit" disabled={loading || !name.trim()} className="btn-primary whitespace-nowrap">
            {loading ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            )}
            Create Course
          </button>
        </form>
        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">Delete Course?</h3>
            <p className="text-sm text-gray-500 mb-6">
              This will permanently delete the course and all its students, sessions, and attendance records. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => deleteCourse(deleteConfirm)}
                className="btn-danger flex-1 justify-center">
                Yes, Delete
              </button>
              <button onClick={() => setDeleteConfirm(null)}
                className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Courses Grid */}
      {courses.length === 0 ? (
        <div className="card p-16 text-center">
          <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No courses yet</h3>
          <p className="text-gray-400 mb-6">Create your first course above and start importing students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {courses.map(c => (
            <div key={c.id} className="card p-5 hover:shadow-md hover:border-blue-200 transition-all group flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shadow-sm">
                  {c.name.charAt(0)}
                </div>
                <button
                  onClick={() => setDeleteConfirm(c.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-all"
                  title="Delete course"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              <h3 className="font-bold text-gray-900 text-lg mb-1 group-hover:text-blue-700 transition-colors">{c.name}</h3>
              <p className="text-sm text-gray-400 mb-4">
                Created {new Date(c.createdAt).toLocaleDateString()}
              </p>

              <div className="flex gap-4 mb-5">
                <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{c._count.students}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Students</div>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-gray-900">{c._count.sessions}</div>
                  <div className="text-xs text-gray-500 mt-0.5">Sessions</div>
                </div>
              </div>

              <div className="flex gap-2 mt-auto">
                <Link href={`/dashboard/courses/${c.id}`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2 rounded-lg transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  Manage
                </Link>
                <Link href={`/dashboard/courses/${c.id}/sessions/new`}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-sm font-semibold py-2 rounded-lg border border-emerald-200 transition-all">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Session
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

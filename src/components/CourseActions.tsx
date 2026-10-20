'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface CourseCardProps {
  course: {
    id: string;
    name: string;
    _count: { students: number; sessions: number };
  };
}

export function CourseCard({ course }: CourseCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(course.name);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [gone, setGone] = useState(false); // optimistic hide
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  function flash(kind: 'ok' | 'err', msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 4000);
  }

  async function saveName() {
    const trimmed = name.trim();
    setEditing(false);
    if (!trimmed || trimmed === course.name) {
      setName(course.name);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not rename course.');
        setName(course.name);
        return;
      }
      router.refresh();
    } catch {
      setError('Network error.');
      setName(course.name);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCourse() {
    setConfirmDelete(false);
    setDeleting(true);
    // Optimistically hide the card right away.
    setGone(true);
    try {
      const res = await fetch(`/api/courses/${course.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Roll back the optimistic hide if the server rejected.
        setGone(false);
        setDeleting(false);
        flash('err', data.error ?? 'Delete failed.');
        return;
      }
      const s = data.summary;
      const parts: string[] = ['Course deleted.'];
      if (s?.liveSessionsClosed) parts.push(`${s.liveSessionsClosed} live session(s) closed.`);
      if (s?.sessionsRemoved) parts.push(`${s.sessionsRemoved} session(s) wiped.`);
      if (s?.studentsRemoved) parts.push(`${s.studentsRemoved} student row(s) removed.`);
      flash('ok', parts.join(' '));
      router.refresh();
    } catch {
      setGone(false);
      setDeleting(false);
      flash('err', 'Network error.');
    }
  }

  if (gone) {
    return (
      <div className="card p-5 border-dashed border-gray-300 bg-gray-50 text-center text-sm text-gray-500 transition-all">
        <div className="flex items-center justify-center gap-2">
          <svg className="w-4 h-4 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Deleting <strong>{course.name}</strong>…
        </div>
        {toast && (
          <div
            className={`mt-3 mx-auto max-w-xs text-xs px-3 py-1.5 rounded-lg border ${
              toast.kind === 'ok'
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-red-50 text-red-800 border-red-200'
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card p-5 hover:shadow-md hover:border-blue-200 transition-all group flex flex-col relative">
      {toast && (
        <div
          className={`absolute -top-2 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-lg text-xs font-medium border shadow ${
            toast.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}
      <div className="flex items-start justify-between mb-4">
        <Link href={`/dashboard/courses/${course.id}`} className="flex items-center gap-4 flex-1 min-w-0">
          <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center font-bold text-blue-700 text-sm flex-shrink-0">
            {(editing ? name : course.name).charAt(0).toUpperCase()}
          </div>
          {editing ? (
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') {
                  setName(course.name);
                  setEditing(false);
                  setError('');
                }
              }}
              onBlur={saveName}
              disabled={saving}
              className="input py-1.5 text-sm font-semibold"
              maxLength={200}
            />
          ) : (
            <h3 className="font-semibold text-gray-900 group-hover:text-blue-700 truncate">
              {course.name}
            </h3>
          )}
        </Link>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setMenuOpen((v) => !v);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-all"
            aria-label="Course actions"
            title="More actions"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setEditing(true);
                }}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Rename
              </button>
              <Link
                href={`/dashboard/courses/${course.id}/sessions/new`}
                className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                onClick={() => setMenuOpen(false)}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                New session
              </Link>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmDelete(true);
                }}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 border-t border-gray-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-600 mb-2">{error}</p>
      )}

      <Link href={`/dashboard/courses/${course.id}`} className="block">
        <div className="flex gap-4 mb-2">
          <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{course._count.students}</div>
            <div className="text-xs text-gray-500 mt-0.5">Students</div>
          </div>
          <div className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{course._count.sessions}</div>
            <div className="text-xs text-gray-500 mt-0.5">Sessions</div>
          </div>
        </div>
      </Link>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">Delete course?</h3>
            <p className="text-sm text-gray-500 mb-6">
              <strong>{course.name}</strong> — {course._count.students} students, {course._count.sessions} sessions
              will be permanently removed, and every live session in this course will be closed immediately.
              This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={deleteCourse}
                disabled={deleting}
                className="btn-danger flex-1 justify-center disabled:opacity-50"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                disabled={deleting}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

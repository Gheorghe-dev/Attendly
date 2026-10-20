'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LiveSession {
  id: string;
  name: string;
  course: { name: string; id: string };
  attendance: { id: string }[];
}

export function LiveSessionsPanel({ sessions }: { sessions: LiveSession[] }) {
  const router = useRouter();
  const [busyClose, setBusyClose] = useState(false);
  const [busyDelete, setBusyDelete] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmCloseAll, setConfirmCloseAll] = useState(false);
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  function flash(kind: 'ok' | 'err', msg: string) {
    setToast({ kind, msg });
    setTimeout(() => setToast(null), 3500);
  }

  async function closeAllLive() {
    setConfirmCloseAll(false);
    setBusyClose(true);
    try {
      const res = await fetch('/api/sessions/close-all-live', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        flash('err', data.error ?? 'Could not close live sessions.');
        return;
      }
      flash('ok', `Closed ${data.closed} live session${data.closed === 1 ? '' : 's'}.`);
      router.refresh();
    } catch {
      flash('err', 'Network error.');
    } finally {
      setBusyClose(false);
    }
  }

  async function deleteSession(id: string) {
    setConfirmDelete(null);
    setBusyDelete(id);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        flash('err', data.error ?? 'Delete failed.');
        return;
      }
      const s = data.summary;
      const wasLive = s?.wasLive;
      flash(
        'ok',
        `Deleted. ${wasLive ? 'Live session closed. ' : ''}${s?.attendanceRemoved ?? 0} attendance row(s) wiped.`
      );
      router.refresh();
    } catch {
      flash('err', 'Network error.');
    } finally {
      setBusyDelete(null);
    }
  }

  return (
    <div className="card border-l-4 border-l-green-500 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </div>
          <h2 className="font-bold text-gray-900 text-lg">Live Sessions Right Now</h2>
          <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {sessions.length} OPEN
          </span>
        </div>
        <button
          type="button"
          onClick={() => setConfirmCloseAll(true)}
          disabled={busyClose}
          className="inline-flex items-center gap-2 bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-800 font-semibold px-4 py-2 rounded-lg border border-amber-200 transition-all disabled:opacity-50"
          title="Close every open session in one click. Students currently scanning will see the registration form disappear."
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
          {busyClose ? 'Closing…' : 'End ALL live now'}
        </button>
      </div>

      {toast && (
        <div
          className={`mb-3 px-4 py-2 rounded-lg text-sm font-medium border ${
            toast.kind === 'ok'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="space-y-2">
        {sessions.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between gap-3 p-4 bg-gray-50 hover:bg-blue-50 rounded-xl border border-gray-200 hover:border-blue-200 transition-all group"
          >
            <Link href={`/dashboard/sessions/${s.id}`} className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 group-hover:text-blue-700 truncate">{s.name}</p>
              <p className="text-sm text-gray-500">
                {s.course.name} · {s.attendance.length} verified
              </p>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/sessions/${s.id}`}
                className="text-sm font-medium text-blue-600 hover:underline"
              >
                Monitor →
              </Link>
              <button
                type="button"
                onClick={() => setConfirmDelete(s.id)}
                disabled={busyDelete === s.id}
                className="text-sm font-medium text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-all border border-transparent hover:border-red-200 disabled:opacity-50"
              >
                {busyDelete === s.id ? 'Deleting…' : 'End & Delete'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* End ALL confirm */}
      {confirmCloseAll && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">End every live session?</h3>
            <p className="text-sm text-gray-500 mb-6">
              All <strong>{sessions.length}</strong> currently open session
              {sessions.length === 1 ? '' : 's'} will close immediately. Students currently scanning will
              see the registration form disabled. You can reopen them later.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeAllLive}
                disabled={busyClose}
                className="btn-danger flex-1 justify-center disabled:opacity-50"
              >
                {busyClose ? 'Closing…' : 'Yes, close all'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmCloseAll(false)}
                disabled={busyClose}
                className="btn-secondary flex-1 justify-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-session delete confirm */}
      {confirmDelete && (() => {
        const s = sessions.find((x) => x.id === confirmDelete);
        if (!s) return null;
        return (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="card p-6 max-w-sm w-full">
              <h3 className="font-bold text-gray-900 mb-2">End & delete?</h3>
              <p className="text-sm text-gray-500 mb-6">
                <strong>{s.name}</strong> will be closed, deleted, and every attendance / verification
                row attached to it will be wiped. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => deleteSession(confirmDelete)}
                  disabled={busyDelete === confirmDelete}
                  className="btn-danger flex-1 justify-center disabled:opacity-50"
                >
                  {busyDelete === confirmDelete ? 'Deleting…' : 'Yes, end & delete'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  disabled={busyDelete === confirmDelete}
                  className="btn-secondary flex-1 justify-center"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

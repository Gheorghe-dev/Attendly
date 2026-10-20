'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  id: string;
  name: string;
}

export function SessionRowActions({ id, name }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function doDelete() {
    setConfirming(false);
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? 'Delete failed.');
        setDeleting(false);
        return;
      }
      router.refresh();
    } catch {
      alert('Network error.');
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={deleting}
        className="btn-secondary text-sm py-1.5 px-3 text-red-600 border-red-200 hover:bg-red-50"
        title="Permanently delete this session"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        {deleting ? 'Deleting…' : 'Delete'}
      </button>

      {confirming && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 max-w-sm w-full">
            <h3 className="font-bold text-gray-900 mb-2">Delete session?</h3>
            <p className="text-sm text-gray-500 mb-6">
              <strong>{name}</strong> and every attendance / verification record attached to it will be wiped. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={doDelete} disabled={deleting} className="btn-danger flex-1 justify-center disabled:opacity-50">
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button type="button" onClick={() => setConfirming(false)} disabled={deleting} className="btn-secondary flex-1 justify-center">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

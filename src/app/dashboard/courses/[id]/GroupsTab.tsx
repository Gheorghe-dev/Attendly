'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Group {
  name: string;
  studentCount: number;
  isExtra: boolean;
}

interface Props {
  courseId: string;
}

export default function GroupsTab({ courseId }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newGroup, setNewGroup] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [mergeSource, setMergeSource] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/courses/${courseId}/groups`);
      if (!res.ok) {
        setError('Could not load groups');
        return;
      }
      const data = await res.json();
      setGroups(data.groups || []);
      setError('');
    } finally {
      setLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (editing && editRef.current) editRef.current.focus();
  }, [editing]);

  async function callAction(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/courses/${courseId}/groups`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Action failed');
        return false;
      }
      await load();
      return true;
    } catch {
      setError('Network error');
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function addGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroup.trim()) return;
    const ok = await callAction({ action: 'add', group: newGroup });
    if (ok) setNewGroup('');
  }

  function startEdit(g: Group) {
    setEditing(g.name);
    setEditValue(g.name);
  }

  async function commitEdit() {
    if (!editing) return;
    const from = editing;
    const to = editValue.trim();
    setEditing(null);
    if (to === from) return;
    await callAction({ action: 'rename', from, to });
  }

  async function removeGroup(g: Group) {
    if (!confirm(`Remove empty group "${g.name}"? (No students are currently assigned.)`)) return;
    await callAction({ action: 'remove', group: g.name });
  }

  async function confirmMerge() {
    if (!mergeSource) return;
    if (!mergeTarget || mergeTarget === mergeSource) return;
    const ok = await callAction({ action: 'merge', from: mergeSource, to: mergeTarget });
    if (ok) {
      setMergeSource(null);
      setMergeTarget('');
    }
  }

  if (loading) {
    return (
      <div className="card p-12 text-center animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-32 mx-auto" />
      </div>
    );
  }

  const usedInStudents = groups.filter((g) => !g.isExtra);
  const extrasOnly = groups.filter((g) => g.isExtra);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-bold text-gray-800">Manage Groups</h2>
            <p className="text-sm text-gray-500 mt-1">
              Rename, add, or merge groups. Changes apply to all students already assigned
              and update any sessions that reference the old name.
            </p>
          </div>
          <div className="text-sm text-gray-500">
            <span className="font-semibold text-gray-900">{usedInStudents.length}</span> used ·{' '}
            <span className="font-semibold text-gray-900">{extrasOnly.length}</span> empty
          </div>
        </div>

        <form onSubmit={addGroup} className="flex gap-2 mt-4">
          <input
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
            placeholder="e.g. ELA3.5, ISM 2.1, Group X"
            className="input flex-1"
            disabled={busy}
          />
          <button
            type="submit"
            disabled={busy || !newGroup.trim()}
            className="btn-primary whitespace-nowrap"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Group
          </button>
        </form>

        {error && (
          <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
            {error}
          </div>
        )}
      </div>

      {/* Group list */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            All Groups ({groups.length})
          </p>
        </div>

        {groups.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">
              No groups yet. Import students from Excel or add a group above.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {groups.map((g) => (
              <li
                key={g.name}
                className={`flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors ${
                  g.isExtra ? 'opacity-75' : ''
                }`}
              >
                {mergeSource === g.name ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
                    <span className="text-xs text-orange-700 font-semibold">
                      MERGING INTO...
                    </span>
                  </>
                ) : (
                  <span
                    className={`w-2 h-2 rounded-full ${
                      g.isExtra ? 'bg-gray-300' : 'bg-blue-500'
                    }`}
                  />
                )}

                {editing === g.name ? (
                  <input
                    ref={editRef}
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit();
                      if (e.key === 'Escape') setEditing(null);
                    }}
                    onBlur={commitEdit}
                    className="flex-1 input py-1.5 text-sm"
                    disabled={busy}
                  />
                ) : (
                  <span
                    className={`flex-1 font-medium ${
                      g.isExtra ? 'text-gray-500 italic' : 'text-gray-900'
                    }`}
                  >
                    {g.name}
                  </span>
                )}

                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    g.studentCount > 0
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {g.studentCount} student{g.studentCount !== 1 ? 's' : ''}
                </span>

                {g.isExtra && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    Empty
                  </span>
                )}

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => startEdit(g)}
                    disabled={busy || editing === g.name || mergeSource !== null}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all disabled:opacity-30"
                    title="Rename"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>

                  {mergeSource === null ? (
                    <button
                      onClick={() => setMergeSource(g.name)}
                      disabled={busy || g.studentCount === 0}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-orange-600 hover:bg-orange-50 transition-all disabled:opacity-30"
                      title="Merge into another group"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                      </svg>
                    </button>
                  ) : mergeSource === g.name ? (
                    <button
                      onClick={() => {
                        setMergeSource(null);
                        setMergeTarget('');
                      }}
                      className="p-1.5 rounded-lg text-orange-600 hover:bg-orange-100 transition-all"
                      title="Cancel merge"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      onClick={() => setMergeTarget(g.name)}
                      disabled={busy}
                      className={`p-1.5 rounded-lg transition-all ${
                        mergeTarget === g.name
                          ? 'text-white bg-orange-500'
                          : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                      }`}
                      title="Click to merge source into this group"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                  )}

                  <button
                    onClick={() => removeGroup(g)}
                    disabled={busy || g.studentCount > 0 || mergeSource !== null}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all disabled:opacity-30"
                    title="Remove (only empty groups)"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* Merge banner */}
        {mergeSource && (
          <div className="p-4 bg-orange-50 border-t border-orange-200 flex items-center gap-3 flex-wrap">
            <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            <span className="text-sm text-orange-800">
              Merging <strong>{mergeSource}</strong> into:
              <span className="font-semibold ml-1">{mergeTarget || '(choose target on the right)'}</span>
            </span>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => {
                  setMergeSource(null);
                  setMergeTarget('');
                }}
                className="btn-secondary text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmMerge}
                disabled={!mergeTarget || mergeTarget === mergeSource || busy}
                className="btn-primary text-sm"
              >
                Confirm Merge
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help */}
      <div className="card p-4 bg-blue-50/50 border-blue-100">
        <p className="text-xs font-semibold text-blue-800 uppercase tracking-wider mb-2">
          How it works
        </p>
        <ul className="text-sm text-blue-700 space-y-1.5 list-disc list-inside">
          <li>
            <strong>Add</strong> creates an empty placeholder - useful for setting up groups
            before student rosters arrive.
          </li>
          <li>
            <strong>Rename</strong> updates every student with the old name and fixes any
            sessions that referenced it.
          </li>
          <li>
            <strong>Merge</strong> moves all students from one group into another. Use this
            before deleting - you cannot remove a group that still has students.
          </li>
          <li>
            <strong>Remove</strong> only works on empty (placeholder) groups.
          </li>
        </ul>
      </div>
    </div>
  );
}

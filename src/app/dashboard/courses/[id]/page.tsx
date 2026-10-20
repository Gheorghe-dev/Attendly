'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import GroupsTab from './GroupsTab';

interface Student { id: string; name: string; email: string; group: string; }
interface Course { id: string; name: string; students: Student[]; sessions: Array<{ id: string; name: string; date: string; status: string; groups: string }> }
interface ValidationResult {
  valid: Array<{ name: string; email: string; group: string }>;
  errors: Array<{ row: number; reason: string }>;
  duplicates: Array<{ row: number; email: string }>;
}

export default function CourseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [course, setCourse] = useState<Course | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<ValidationResult | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [replace, setReplace] = useState(false);
  const [filter, setFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [importResult, setImportResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'students' | 'sessions' | 'import' | 'groups'>('students');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/courses/${id}`);
    if (res.ok) setCourse(await res.json());
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function processFile(file: File) {
    if (!file.name.endsWith('.xlsx')) {
      setImportResult({ ok: false, msg: 'Only .xlsx files are supported.' });
      return;
    }
    setUploadFile(file);
    setPreview(null);
    setImportResult(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('preview', 'true');
    setUploading(true);
    try {
      const res = await fetch(`/api/courses/${id}/students`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) setPreview(data.validation);
      else setImportResult({ ok: false, msg: data.error });
    } finally {
      setUploading(false);
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  async function commitImport() {
    if (!uploadFile || !preview) return;
    const fd = new FormData();
    fd.append('file', uploadFile);
    fd.append('replace', String(replace));
    setUploading(true);
    try {
      const res = await fetch(`/api/courses/${id}/students`, { method: 'POST', body: fd });
      const data = await res.json();
      if (res.ok) {
        setImportResult({ ok: true, msg: `Imported ${data.imported} students successfully. ${data.errors?.length || 0} rows skipped.` });
        setPreview(null);
        setUploadFile(null);
        if (fileRef.current) fileRef.current.value = '';
        load();
        setActiveTab('students');
      } else {
        setImportResult({ ok: false, msg: data.error });
      }
    } finally {
      setUploading(false);
    }
  }

  const groups = course ? Array.from(new Set(course.students.map(s => s.group))).sort() : [];
  const filtered = (course?.students || []).filter(s => {
    const q = filter.toLowerCase();
    return (!q || s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) &&
           (!groupFilter || s.group === groupFilter);
  });

  if (!course) return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-60" />
      <div className="h-64 bg-gray-100 rounded-2xl" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb + Header */}
      <div>
        <nav className="flex items-center gap-2 text-sm text-gray-400 mb-3">
          <Link href="/dashboard" className="hover:text-gray-600">Dashboard</Link>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <Link href="/dashboard/courses" className="hover:text-gray-600">Courses</Link>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-gray-700 font-medium">{course.name}</span>
        </nav>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white font-bold text-xl shadow-sm">
              {course.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{course.name}</h1>
              <p className="text-gray-500 text-sm">{course.students.length} students · {course.sessions?.length || 0} sessions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {course.students.length > 0 && (
              <a href={`/api/courses/${id}/export`}
                className="btn-secondary">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                Export All
              </a>
            )}
            <Link href={`/dashboard/courses/${id}/sessions/new`} className="btn-primary">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              New Session
            </Link>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-blue-700">{course.students.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Total Students</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-purple-700">{groups.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Groups</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-emerald-700">{course.sessions?.length || 0}</div>
          <div className="text-xs text-gray-500 mt-0.5">Sessions</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {([
            ['students', 'Students', course.students.length],
            ['sessions', 'Sessions', course.sessions?.length || 0],
            ['groups', 'Groups', null],
            ['import', 'Import Excel', null],
          ] as const).map(([tab, label, count]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`pb-3 text-sm font-semibold border-b-2 transition-all flex items-center gap-2 ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {label}
              {count !== null && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  activeTab === tab ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab: Students */}
      {activeTab === 'students' && (
        <div className="card">
          <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input value={filter} onChange={e => setFilter(e.target.value)}
                className="input pl-9" placeholder="Search by name or email…" />
            </div>
            <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)}
              className="input w-auto">
              <option value="">All Groups</option>
              {groups.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
            {(filter || groupFilter) && (
              <button onClick={() => { setFilter(''); setGroupFilter(''); }}
                className="btn-secondary text-sm">Clear</button>
            )}
          </div>

          {filtered.length === 0 ? (
            <div className="p-16 text-center">
              {course.students.length === 0 ? (
                <div>
                  <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-500 mb-3">No students imported yet.</p>
                  <button onClick={() => setActiveTab('import')} className="btn-primary">
                    Import Excel File
                  </button>
                </div>
              ) : (
                <p className="text-gray-400">No students match your search.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">#</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-500 text-xs uppercase tracking-wider">Group</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((s, i) => (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-gray-300 font-mono text-xs">{i + 1}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 font-bold text-xs flex-shrink-0">
                            {s.name.charAt(0)}
                          </div>
                          <span className="font-medium text-gray-900">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-xs">{s.email}</td>
                      <td className="py-3 px-4"><span className="badge-group">{s.group}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
                Showing {filtered.length} of {course.students.length} students
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Sessions */}
      {activeTab === 'sessions' && (
        <div className="space-y-3">
          {!course.sessions || course.sessions.length === 0 ? (
            <div className="card p-12 text-center">
              <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-500 mb-4">No sessions created yet.</p>
              <Link href={`/dashboard/courses/${id}/sessions/new`} className="btn-primary">Create First Session</Link>
            </div>
          ) : (
            course.sessions.map(s => (
              <Link key={s.id} href={`/dashboard/sessions/${s.id}`}
                className="card p-4 flex items-center justify-between hover:shadow-md hover:border-blue-200 transition-all group">
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${s.status === 'open' ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <div>
                    <p className="font-semibold text-gray-900 group-hover:text-blue-700">{s.name}</p>
                    <p className="text-sm text-gray-400">
                      {new Date(s.date).toLocaleString()} · Groups: {s.groups}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={s.status === 'open' ? 'badge-open' : 'badge-closed'}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status === 'open' ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    {s.status === 'open' ? 'Open' : 'Closed'}
                  </span>
                  <svg className="w-5 h-5 text-gray-300 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Tab: Import */}
      {activeTab === 'import' && (
        <div className="space-y-5">
          <div className="card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">Import Student List</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Upload an Excel (<code>.xlsx</code>) file with: <strong>Column 1: Student Name</strong>, <strong>Column 2: University Email</strong>, and <strong>Column 3: Group</strong>.
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Groups can be formatted like: <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">AIA 3.3A</span>, <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">AIA 3.1 B</span>, <span className="font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">ELA 2.2 A</span>, or any custom group name.
                </p>
              </div>
              <a
                href="/api/courses/template"
                download="student-roster-template.xlsx"
                className="btn-secondary text-sm flex items-center gap-2 self-start whitespace-nowrap shadow-sm hover:border-blue-400"
              >
                <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Template (.xlsx)
              </a>
            </div>

            {/* Drop Zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                dragOver
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              }`}
            >
              <input ref={fileRef} type="file" accept=".xlsx" onChange={handleFileSelect} className="hidden" />
              {uploading ? (
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-10 h-10 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <p className="text-blue-600 font-medium">Analyzing file…</p>
                </div>
              ) : uploadFile ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{uploadFile.name}</p>
                    <p className="text-sm text-gray-400">Click to choose a different file</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-700">Drop your .xlsx file here</p>
                    <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                  </div>
                </div>
              )}
            </div>

            {/* Replace option */}
            <label className="flex items-center gap-3 mt-4 cursor-pointer">
              <div className={`w-10 h-6 rounded-full transition-colors ${replace ? 'bg-blue-600' : 'bg-gray-200'}`}
                onClick={() => setReplace(!replace)}>
                <div className={`w-4 h-4 bg-white rounded-full shadow-sm mt-1 transition-transform ${replace ? 'translate-x-5' : 'translate-x-1'}`} />
              </div>
              <span className="text-sm font-medium text-gray-700">Replace all existing students</span>
            </label>
          </div>

          {/* Import Result */}
          {importResult && (
            <div className={`card p-4 flex items-start gap-3 ${importResult.ok ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${importResult.ok ? 'text-green-600' : 'text-red-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={importResult.ok ? 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' : 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'} />
              </svg>
              <p className={`text-sm font-medium ${importResult.ok ? 'text-green-800' : 'text-red-800'}`}>{importResult.msg}</p>
            </div>
          )}

          {/* Validation Preview */}
          {preview && (
            <div className="space-y-4">
              <div className="card p-5 bg-green-50 border-green-200">
                <div className="flex items-center gap-3 mb-1">
                  <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-bold text-green-800">{preview.valid.length} valid students ready to import</span>
                </div>
                <p className="text-sm text-green-700 ml-8">These will be added/updated in the database.</p>
              </div>

              {preview.errors.length > 0 && (
                <div className="card p-5 bg-red-50 border-red-200">
                  <div className="flex items-center gap-3 mb-3">
                    <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-bold text-red-800">{preview.errors.length} rows with errors (will be skipped)</span>
                  </div>
                  <div className="space-y-1.5 ml-8">
                    {preview.errors.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm text-red-700">
                        <span className="font-mono bg-red-100 px-1.5 py-0.5 rounded text-xs flex-shrink-0">Row {e.row}</span>
                        <span>{e.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {preview.duplicates.length > 0 && (
                <div className="card p-5 bg-yellow-50 border-yellow-200">
                  <div className="flex items-center gap-3 mb-3">
                    <svg className="w-5 h-5 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-bold text-yellow-800">{preview.duplicates.length} duplicate emails (will be skipped)</span>
                  </div>
                  <div className="space-y-1.5 ml-8">
                    {preview.duplicates.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-yellow-700">
                        <span className="font-mono bg-yellow-100 px-1.5 py-0.5 rounded text-xs">Row {d.row}</span>
                        <span className="font-mono">{d.email}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={commitImport} disabled={uploading || preview.valid.length === 0}
                  className="btn-primary">
                  {uploading ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                  )}
                  Confirm Import ({preview.valid.length} students)
                </button>
                <button onClick={() => { setPreview(null); setUploadFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                  className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Groups */}
      {activeTab === 'groups' && <GroupsTab courseId={id} />}
    </div>
  );
}

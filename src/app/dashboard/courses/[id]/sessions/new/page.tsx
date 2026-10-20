'use client';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface CourseBasic { id: string; name: string; students: Array<{ group: string }> }

export default function NewSessionPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [groups, setGroups] = useState<string[]>([]);
  const [allGroups, setAllGroups] = useState<string[]>([]);
  const [course, setCourse] = useState<CourseBasic | null>(null);
  const [status, setStatus] = useState('open');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [classroomLat, setClassroomLat] = useState<number | null>(null);
  const [classroomLng, setClassroomLng] = useState<number | null>(null);
  const [classroomRadius, setClassroomRadius] = useState(50);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'detecting' | 'ok' | 'denied'>('idle');
  const [geoError, setGeoError] = useState('');

  // Set default datetime to now
  useEffect(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    setDate(local.toISOString().slice(0, 16));
  }, []);

  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then(r => r.json())
      .then((c: CourseBasic) => {
        setCourse(c);
        const gs = Array.from(new Set((c.students || []).map(s => s.group))).sort() as string[];
        setAllGroups(gs);
        setGroups(gs); // Select all by default
      });
  }, [courseId]);

  function toggleGroup(g: string) {
    setGroups(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (groups.length === 0) { setError('Select at least one group'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId, name, date, groups, status,
          classroomLat, classroomLng, classroomRadius,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      router.push(`/dashboard/sessions/${data.id}`);
    } finally {
      setLoading(false);
    }
  }

  function detectClassroomLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by this browser.');
      setGeoStatus('denied');
      return;
    }
    setGeoStatus('detecting');
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClassroomLat(pos.coords.latitude);
        setClassroomLng(pos.coords.longitude);
        if (pos.coords.accuracy) setClassroomRadius(Math.max(20, Math.round(pos.coords.accuracy * 1.5)));
        setGeoStatus('ok');
      },
      (err) => {
        setGeoError(err.message || 'Could not detect location.');
        setGeoStatus('denied');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-600">Dashboard</Link>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <Link href="/dashboard/courses" className="hover:text-gray-600">Courses</Link>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        {course && <Link href={`/dashboard/courses/${courseId}`} className="hover:text-gray-600">{course.name}</Link>}
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        <span className="text-gray-700 font-medium">New Session</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create New Session</h1>
        <p className="text-gray-500 mt-1">
          {course ? `For ${course.name}` : 'Loading…'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* Session Name */}
        <div className="card p-6 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Session Name *</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              className="input"
              placeholder="e.g. Lecture 1 – Introduction, Lab Session 3, Midterm Review…" />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Date & Time *</label>
            <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} required
              className="input" />
            <p className="text-xs text-gray-400 mt-1.5">Students will see this date on the registration page</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-semibold text-gray-700">Groups to Include *</label>
              {allGroups.length > 0 && (
                <div className="flex gap-2">
                  <button type="button" onClick={() => setGroups([...allGroups])}
                    className="text-xs text-blue-600 hover:underline">Select All</button>
                  <span className="text-gray-300">·</span>
                  <button type="button" onClick={() => setGroups([])}
                    className="text-xs text-gray-500 hover:underline">Clear</button>
                </div>
              )}
            </div>
            {allGroups.length === 0 ? (
              <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm">
                <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-amber-800">No groups found. Import students first.</span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allGroups.map(g => (
                  <button key={g} type="button" onClick={() => toggleGroup(g)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium transition-all ${
                      groups.includes(g)
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                    }`}>
                    {groups.includes(g) && (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {g}
                  </button>
                ))}
              </div>
            )}
            {groups.length > 0 && (
              <p className="text-xs text-gray-500 mt-2">{groups.length} group{groups.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Initial Status</label>
            <div className="grid grid-cols-2 gap-3">
              {[
                { value: 'open', label: 'Open', desc: 'Accept registrations immediately', color: 'emerald' },
                { value: 'closed', label: 'Closed', desc: 'Start closed, open later', color: 'gray' },
              ].map(opt => (
                <label key={opt.value}
                  className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                    status === opt.value
                      ? opt.color === 'emerald' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-400 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input type="radio" name="status" value={opt.value}
                    checked={status === opt.value} onChange={e => setStatus(e.target.value)}
                    className="mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Classroom Location */}
        <div className="card p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Classroom Location
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Optional. When set, students who share their phone location will be flagged
                if they are outside this radius.
              </p>
            </div>
            <button
              type="button"
              onClick={detectClassroomLocation}
              disabled={geoStatus === 'detecting'}
              className="btn-secondary text-sm whitespace-nowrap"
            >
              {geoStatus === 'detecting' ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
              {classroomLat != null ? 'Re-detect' : 'Use my location'}
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Latitude</label>
              <input
                type="number"
                step="any"
                value={classroomLat ?? ''}
                onChange={(e) => setClassroomLat(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="e.g. 47.1234"
                className="input text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Longitude</label>
              <input
                type="number"
                step="any"
                value={classroomLng ?? ''}
                onChange={(e) => setClassroomLng(e.target.value === '' ? null : Number(e.target.value))}
                placeholder="e.g. 27.5678"
                className="input text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              Allowed radius: <span className="text-blue-700">{classroomRadius} m</span>
            </label>
            <input
              type="range"
              min={10}
              max={500}
              step={10}
              value={classroomRadius}
              onChange={(e) => setClassroomRadius(Number(e.target.value))}
              className="w-full accent-blue-600"
              disabled={classroomLat == null}
            />
            <p className="text-xs text-gray-400 mt-1">
              {classroomLat == null
                ? 'Set a location first, then adjust the radius.'
                : 'Students outside this radius will be flagged as suspicious.'}
            </p>
          </div>

          {geoStatus === 'ok' && (
            <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Location captured. Radius set to {classroomRadius} m.
            </div>
          )}
          {geoStatus === 'denied' && geoError && (
            <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Could not auto-detect: {geoError}. You can still enter the values manually above.
            </div>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button type="submit" disabled={loading || groups.length === 0 || !name.trim()}
            className="btn-primary flex-1 justify-center py-3">
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating Session…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Create Session
              </>
            )}
          </button>
          <Link href={`/dashboard/courses/${courseId}`} className="btn-secondary justify-center px-6">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

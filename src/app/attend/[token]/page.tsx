'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface SessionInfo {
  courseName: string;
  sessionName: string;
  date: string;
  status: string;
  classroomLat?: number | null;
  classroomLng?: number | null;
  classroomRadius?: number | null;
}

export default function AttendPage() {
  const params = useParams();
  const token = params.token as string;
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [email, setEmail] = useState('');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [devUrl, setDevUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [shareLocation, setShareLocation] = useState(true);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'requesting' | 'granted' | 'denied'>('idle');

  useEffect(() => {
    fetch(`/api/attend/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setLoadError(data.error);
        else setInfo(data);
      })
      .catch(() => setLoadError('Could not load session. Check your internet connection.'));
  }, [token]);

  function tryGetLocation(): Promise<{ lat: number; lng: number; accuracy: number } | null> {
    return new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      setLocationStatus('requesting');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const geo = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
          setLocationStatus('granted');
          resolve(geo);
        },
        () => {
          setLocationStatus('denied');
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitStatus('loading');
    setMessage('');
    try {
      let geolocation: { lat: number; lng: number; accuracy: number } | null = null;
      if (shareLocation) {
        geolocation = await tryGetLocation();
      }
      const res = await fetch(`/api/attend/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          geolocation,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSubmitStatus('sent');
        setMessage(data.message);
        setDevUrl(typeof data.verificationUrl === 'string' ? data.verificationUrl : null);
      } else {
        setSubmitStatus('error');
        setMessage(data.error);
        // If SMTP failed but the API still handed us a dev URL, surface it as well.
        if (typeof data.verificationUrl === 'string') {
          setDevUrl(data.verificationUrl);
          setSubmitStatus('sent');
          setMessage(
            'Email could not be sent, but a verification link was generated. Use the button below to continue.'
          );
        }
      }
    } catch {
      setSubmitStatus('error');
      setMessage('Network error. Please check your connection and try again.');
    }
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl p-8 w-full max-w-sm text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="font-bold text-gray-900 text-lg mb-2">Session Not Found</h2>
          <p className="text-gray-500 text-sm">{loadError}</p>
        </div>
      </div>
    );
  }

  const isClosed = info?.status === 'closed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white text-center">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          {info ? (
            <>
              <h1 className="text-xl font-bold">{info.courseName}</h1>
              <p className="text-blue-200 text-sm mt-1">{info.sessionName}</p>
              <p className="text-blue-300 text-xs mt-1">
                {new Date(info.date).toLocaleDateString('en-GB', {
                  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                })}
              </p>
            </>
          ) : (
            <div className="space-y-2">
              <div className="h-5 bg-white/20 rounded animate-pulse" />
              <div className="h-4 bg-white/10 rounded animate-pulse w-3/4 mx-auto" />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="p-6">
          {isClosed ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h2 className="font-bold text-gray-900 text-lg mb-1">Registration Closed</h2>
              <p className="text-gray-500 text-sm">This session is no longer accepting attendance submissions.</p>
            </div>
          ) : submitStatus === 'sent' ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h2 className="font-bold text-gray-900 text-lg mb-2">Check Your Email!</h2>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{message}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left">
                <p className="text-xs text-amber-800 font-semibold mb-1">⏱ Important</p>
                <p className="text-xs text-amber-700">The verification link expires in <strong>15 minutes</strong>. Please click it right away.</p>
              </div>
              {devUrl && (
                <div className="mt-5 text-left">
                  <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-3">
                    <p className="text-xs text-emerald-800 font-semibold mb-1">
                      🔧 Dev Mode — no SMTP configured
                    </p>
                    <p className="text-xs text-emerald-700">
                      No real email was sent. Tap the button below to verify attendance instantly.
                      (Set <code className="bg-emerald-100 px-1 rounded">SMTP_HOST</code>,{' '}
                      <code className="bg-emerald-100 px-1 rounded">SMTP_USER</code>,{' '}
                      <code className="bg-emerald-100 px-1 rounded">SMTP_PASS</code> in{' '}
                      <code className="bg-emerald-100 px-1 rounded">.env</code> to switch to real email.)
                    </p>
                  </div>
                  <a
                    href={devUrl}
                    className="block w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-2xl text-base transition-all text-center"
                  >
                    Verify My Attendance →
                  </a>
                  <p className="text-xs text-gray-400 mt-2 break-all text-center">{devUrl}</p>
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  University Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:border-blue-500 transition-all placeholder-gray-300"
                  placeholder="you@university.edu"
                  autoComplete="email"
                  inputMode="email"
                  disabled={submitStatus === 'loading'}
                />
              </div>

              {submitStatus === 'error' && message && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <svg className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700 leading-relaxed">{message}</p>
                </div>
              )}

              {/* Location sharing — optional but recommended */}
              <label className={`flex items-start gap-3 p-3 rounded-2xl border-2 cursor-pointer transition-all ${
                shareLocation ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
              }`}>
                <input
                  type="checkbox"
                  checked={shareLocation}
                  onChange={(e) => setShareLocation(e.target.checked)}
                  className="mt-1 accent-blue-600"
                  disabled={submitStatus === 'loading'}
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Share my location
                    {info?.classroomLat != null && (
                      <span className="text-xs font-normal text-gray-500 ml-1">
                        (verifies you are in the classroom)
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {info?.classroomLat != null
                      ? 'Your professor set a classroom location. Sharing confirms you are in the room.'
                      : 'Optional. Helps your professor confirm attendance. Not stored after this session.'}
                  </p>
                  {locationStatus === 'granted' && (
                    <p className="text-xs text-emerald-700 mt-1">Location captured.</p>
                  )}
                  {locationStatus === 'denied' && (
                    <p className="text-xs text-amber-700 mt-1">Location was denied. You can still submit.</p>
                  )}
                </div>
              </label>

              <button
                type="submit"
                disabled={submitStatus === 'loading' || !email.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base transition-all flex items-center justify-center gap-2"
              >
                {submitStatus === 'loading' ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Submitting…
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Submit Attendance
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center">
                A verification link will be sent to your university email.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Logo } from '@/components/branding/Logo';
import { formatDate, formatTime } from '@/lib/utils';
import { formatDistance } from '@/lib/distance';
import { getDeviceSecurityPayload } from '@/lib/device';
import {
  ArrowRight,
  Loader2,
  AlertTriangle,
  Lock,
  XCircle,
  ShieldAlert,
  Smartphone,
  CheckCircle2,
  Navigation,
  MapPin,
} from 'lucide-react';

interface SessionMeta {
  courseName: string;
  sessionName: string;
  classroom?: string;
  classroomSlug?: string;
  date: string;
  status: string;
  localHostUrl?: string;
}

interface SuccessData {
  student: {
    name: string;
    email: string;
    group: string;
  };
  courseName: string;
  sessionName: string;
  classroom?: string;
  checkInTime: string;
  distance?: number | null;
  city?: string | null;
  message?: string;
  isAlreadyRegistered?: boolean;
}

export default function StudentAttendPage() {
  const params = useParams();
  const token = params.token as string;

  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  // Flow step: 1 (Email) -> 2 (Submitting) -> 3 (Success)
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form states
  const [email, setEmail] = useState('');

  // Submission error
  const [apiError, setApiError] = useState<{
    code: string;
    title: string;
    message: string;
  } | null>(null);

  // Success state
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Pre-warmed GPS coordinates from the scanning device
  const [deviceCoords, setDeviceCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Pre-warm device location as soon as student opens the scan link
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setDeviceCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
      );
    }
  }, []);

  // Load session metadata
  const [sameLocalNetwork, setSameLocalNetwork] = useState(false);

  useEffect(() => {
    fetch(`/api/attend/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 'NOT_FOUND' || data.error) {
          setMetaError(data.error || 'Session does not exist.');
        } else {
          setMeta(data);
          // In-room Wi-Fi probe: check if student device is on the same local Wi-Fi router as host
          if (data.localHostUrl) {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 700);
            fetch(`${data.localHostUrl}/api/health`, { mode: 'no-cors', signal: ctrl.signal })
              .then(() => setSameLocalNetwork(true))
              .catch(() => {})
              .finally(() => clearTimeout(timer));
          }
        }
      })
      .catch(() => setMetaError('Server connection failed. Please check your network.'))
      .finally(() => setLoadingMeta(false));
  }, [token]);

  // Handle email submission
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    setApiError(null);
    setStep(2);

    // Acquire device location to compute exact distance from host machine
    let coords: { lat: number; lng: number } | null = deviceCoords;
    if (!coords && typeof window !== 'undefined' && navigator.geolocation) {
      coords = await new Promise<{ lat: number; lng: number } | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 1800);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            clearTimeout(timer);
            resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          },
          () => {
            clearTimeout(timer);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 1800, maximumAge: 60000 }
        );
      });
    }

    try {
      const devicePayload = await getDeviceSecurityPayload();

      const res = await fetch(`/api/attend/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          coords,
          sameLocalNetwork,
          deviceId: devicePayload.deviceId,
          deviceFingerprint: devicePayload.deviceFingerprint,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        let title = 'Check-in Failed';
        let message = data.error || 'An error occurred while confirming attendance.';

        if (data.code === 'NOT_IN_ROSTER') {
          title = 'Email not found in roster';
          message =
            'The entered email address is not in the official roster for this course. Please verify you entered your correct institutional email.';
        } else if (data.code === 'DEVICE_ALREADY_USED') {
          title = 'Device Already Registered';
          message =
            data.error ||
            'This device has already been used to check in another student in this session.';
        } else if (data.code === 'GROUP_NOT_ALLOWED') {
          title = 'Group Not Scheduled';
          message = data.error;
        } else if (data.code === 'SESSION_CLOSED') {
          title = 'Session Closed';
          message = 'Attendance check-in has been closed by the instructor.';
        }

        setApiError({
          code: data.code,
          title,
          message,
        });

        setStep(1);
        return;
      }

      setSuccessData({
        student: data.student,
        courseName: data.courseName || meta?.courseName || 'University Course',
        sessionName: data.sessionName || meta?.sessionName || 'Session',
        classroom: data.classroom || meta?.classroom,
        checkInTime: data.checkInTime || data.originalCheckInTime || new Date().toISOString(),
        distance: data.distance,
        city: data.city,
        isAlreadyRegistered: data.code === 'ALREADY_CHECKED_IN',
      });

      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([40, 50, 40]);
        } catch {}
      }

      setStep(3);
    } catch {
      setApiError({
        code: 'NETWORK_ERROR',
        title: 'Connection Error',
        message: 'Could not reach the server. Please verify your internet connection.',
      });
      setStep(1);
    }
  }

  // Loading state
  if (loadingMeta) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
        <p className="text-xs font-mono text-muted-foreground">
          Connecting to course session…
        </p>
      </div>
    );
  }

  // 404 / Invalid token error
  if (metaError || !meta) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-7 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-danger-soft text-danger flex items-center justify-center mx-auto">
            <XCircle className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Invalid or Expired QR Code
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {metaError || 'The attendance session was not found or has been deleted.'}
          </p>
        </div>
      </div>
    );
  }

  // If session is officially closed
  if (meta.status === 'closed' && step !== 3) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-7 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Session Closed {meta.classroom ? `· ${meta.classroom}` : ''}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Attendance check-in for{' '}
            <span className="font-semibold text-foreground">{meta.courseName}</span>
            {meta.classroom ? ` in ${meta.classroom}` : ''} has been closed by the instructor. New check-ins are no longer accepted.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-6 select-none overflow-x-hidden">
      {/* ── Header: Logo + Course Details ───────────────────────────── */}
      <div className="w-full max-w-[420px] mx-auto pt-2 pb-6 space-y-3 text-center">
        <Logo size="sm" className="mx-auto" />
        <div className="space-y-1">
          <h1 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            {meta.courseName}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted-foreground font-mono">
            <span>{meta.sessionName}</span>
            <span>·</span>
            <span>{formatDate(meta.date)}</span>
            {meta.classroom && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-accent/15 text-accent border border-accent/25">
                <MapPin className="w-3 h-3 text-accent" />
                <span>{meta.classroom}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Step Card ─────────────────────────────────────────── */}
      <div className="w-full max-w-[420px] mx-auto my-auto">
        <div className="rounded-card border border-border bg-card p-6 sm:p-7 shadow-md space-y-6">
          {/* Error Banner if any */}
          {apiError && (
            <div className="p-3.5 rounded-card bg-danger-soft text-danger border border-danger/20 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold">
                {apiError.code === 'DEVICE_ALREADY_USED' ? (
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{apiError.title}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-foreground/85">
                {apiError.message}
              </p>
              {apiError.code === 'DEVICE_ALREADY_USED' && (
                <div className="pt-1 border-t border-danger/20 text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <Smartphone className="w-3 h-3 text-danger flex-shrink-0" />
                  <span>Each student must check in exclusively from their own device.</span>
                </div>
              )}
            </div>
          )}

          {/* ── STEP 1: Email Input ─────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div className="space-y-1">
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  Confirm Attendance
                </h2>
                <p className="text-xs text-muted-foreground">
                  Enter your official university email address to record your presence.
                </p>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-foreground">
                  University email
                </label>
                <input
                  type="email"
                  required
                  autoFocus
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="student@university.edu"
                  className="flex min-h-[48px] w-full rounded-input border border-input bg-card px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
                />
                <p className="text-[11px] text-muted-foreground font-mono">
                  Use the email address registered in the official course roster.
                </p>
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-input bg-accent text-white dark:text-neutral-900 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-accent/90 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
              >
                <span>Confirm Attendance</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground font-mono pt-0.5">
                <ShieldAlert className="w-3 h-3 text-accent flex-shrink-0" />
                <span>1 check-in per device · Proxy attendance is prohibited</span>
              </div>
            </form>
          )}

          {/* ── STEP 2: Submitting State ────────────────────────────── */}
          {step === 2 && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto" />
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  Verifying attendance…
                </h3>
                <p className="text-xs text-muted-foreground">
                  Validating official course roster and computing scan proximity.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 3: Animated Success Screen ─────────────────────── */}
          {step === 3 && successData && (
            <div className="text-center space-y-6 py-2">
              <div className="w-16 h-16 rounded-full bg-success-soft text-success flex items-center justify-center mx-auto border-2 border-success/30 shadow-md">
                <svg
                  className="w-8 h-8 text-success"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                    style={{
                      strokeDasharray: 24,
                      strokeDashoffset: 0,
                      animation: 'dash 0.6s ease-in-out forwards',
                    }}
                  />
                </svg>
              </div>

              <div className="space-y-1">
                <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                  {successData.isAlreadyRegistered
                    ? 'Attendance Already Confirmed'
                    : 'Attendance Recorded!'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Your check-in has been successfully sent to the instructor&apos;s screen.
                </p>
              </div>

              {/* Student Confirmation Card */}
              <div className="p-4 rounded-card bg-muted/40 border border-border text-left space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground font-sans">Student:</span>
                  <span className="font-semibold text-foreground font-sans">
                    {successData.student.name}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground font-sans">Group:</span>
                  <span className="font-semibold text-accent">
                    {successData.student.group}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground font-sans">Email:</span>
                  <span className="text-foreground">{successData.student.email}</span>
                </div>
                {successData.classroom && (
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <span className="text-muted-foreground font-sans">Classroom:</span>
                    <span className="font-semibold text-accent font-sans flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-accent" />
                      <span>{successData.classroom}</span>
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground font-sans">Scan Time:</span>
                  <span className="text-success font-medium">
                    {formatDate(successData.checkInTime)} {formatTime(successData.checkInTime)}
                  </span>
                </div>
                {successData.distance != null && (
                  <div className="flex justify-between items-center border-b border-border pb-2">
                    <span className="text-muted-foreground font-sans">Scan Proximity:</span>
                    <span className="font-semibold text-accent flex items-center gap-1">
                      <Navigation className="w-3.5 h-3.5 text-accent" />
                      <span>{formatDistance(successData.distance)} away</span>
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-muted-foreground font-sans">Status:</span>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" />
                    Verified Present
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                You can safely close this page.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

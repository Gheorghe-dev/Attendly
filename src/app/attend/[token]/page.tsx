'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Logo } from '@/components/branding/Logo';
import { formatDate, formatTime } from '@/lib/utils';
import {
  MapPin,
  Compass,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Lock,
  ChevronDown,
  ChevronUp,
  XCircle,
  HelpCircle,
} from 'lucide-react';

interface SessionMeta {
  courseName: string;
  sessionName: string;
  date: string;
  status: string;
  requiresLocation: boolean;
  classroomRadius?: number;
}

interface SuccessData {
  student: {
    name: string;
    email: string;
    group: string;
  };
  courseName: string;
  sessionName: string;
  checkInTime: string;
  distance?: number | null;
  message?: string;
  isAlreadyRegistered?: boolean;
}

export default function StudentAttendPage() {
  const params = useParams();
  const token = params.token as string;

  const [meta, setMeta] = useState<SessionMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState('');

  // Flow step: 1 (Email) -> 2 (Location Permission) -> 3 (Submitting) -> 4 (Success)
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Form states
  const [email, setEmail] = useState('');
  const [acquiringGps, setAcquiringGps] = useState(false);
  const [gpsErrorType, setGpsErrorType] = useState<'denied' | 'timeout' | null>(null);
  const [showIosGuide, setShowIosGuide] = useState(false);

  // Submission error
  const [apiError, setApiError] = useState<{
    code: string;
    title: string;
    message: string;
    distance?: number;
    allowedRadius?: number;
  } | null>(null);

  // Success state
  const [successData, setSuccessData] = useState<SuccessData | null>(null);

  // Load session metadata
  useEffect(() => {
    fetch(`/api/attend/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.code === 'NOT_FOUND' || data.error) {
          setMetaError(data.error || 'Sesiune inexistentă.');
        } else {
          setMeta(data);
        }
      })
      .catch(() => setMetaError('Conexiunea la server a eșuat. Verifică rețeaua.'))
      .finally(() => setLoadingMeta(false));
  }, [token]);

  // Step 1 -> Step 2
  function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    setApiError(null);

    if (meta?.requiresLocation) {
      setStep(2);
    } else {
      // Direct submit if no GPS required
      submitAttendance(null);
    }
  }

  // Request GPS
  function requestLocation() {
    if (!navigator.geolocation) {
      setGpsErrorType('timeout');
      return;
    }

    setAcquiringGps(true);
    setGpsErrorType(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        };
        setAcquiringGps(false);
        // Automatically submit with acquired coords
        submitAttendance(c);
      },
      (err) => {
        setAcquiringGps(false);
        if (err.code === 1) {
          setGpsErrorType('denied');
        } else {
          setGpsErrorType('timeout');
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  // Final submission
  async function submitAttendance(
    locationCoords: { lat: number; lng: number; accuracy: number } | null
  ) {
    setStep(3);
    setApiError(null);

    try {
      const res = await fetch(`/api/attend/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          geolocation: locationCoords,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Humanize error states
        let title = 'Înregistrare eșuată';
        let message = data.error || 'A apărut o problemă la confirmarea prezenței.';

        if (data.code === 'NOT_IN_ROSTER') {
          title = 'Email nerecunoscut în catalog';
          message =
            'Adresa introdusă nu se află în catalogul oficial al acestui curs. Verifică dacă ai introdus adresa instituțională corectă.';
        } else if (data.code === 'GROUP_NOT_ALLOWED') {
          title = 'Grupă neprogramată';
          message = data.error;
        } else if (data.code === 'OUTSIDE_GEOFENCE') {
          title = 'În afara perimetrului sălii';
          message = data.error;
        } else if (data.code === 'SESSION_CLOSED') {
          title = 'Sesiune închisă';
          message =
            'Înregistrarea prezenței a fost oprită de către profesorul titular.';
        } else if (data.code === 'LOCATION_REQUIRED') {
          title = 'Locație obligatorie';
          message = 'Pentru această sesiune este obligatoriu acordul GPS.';
        }

        setApiError({
          code: data.code,
          title,
          message,
          distance: data.distance,
          allowedRadius: data.allowedRadius,
        });

        // Go back to appropriate step
        setStep(data.code === 'LOCATION_REQUIRED' || data.code === 'OUTSIDE_GEOFENCE' ? 2 : 1);
        return;
      }

      // Check for ALREADY_CHECKED_IN or SUCCESS
      setSuccessData({
        student: data.student,
        courseName: data.courseName || meta?.courseName || 'Curs Universitar',
        sessionName: data.sessionName || meta?.sessionName || 'Sesiune',
        checkInTime: data.checkInTime || data.originalCheckInTime || new Date().toISOString(),
        distance: data.distance,
        isAlreadyRegistered: data.code === 'ALREADY_CHECKED_IN',
      });

      setStep(4);
    } catch {
      setApiError({
        code: 'NETWORK_ERROR',
        title: 'Eroare de conexiune',
        message: 'Nu s-a putut contacta serverul. Verifică dacă telefonul este conectat la internet.',
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
          Se conectează la sesiunea de curs…
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
            Cod QR Invalid sau Expirat
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {metaError || 'Sesiunea de prezență nu a fost găsită sau a fost ștearsă.'}
          </p>
        </div>
      </div>
    );
  }

  // If session is officially closed
  if (meta.status === 'closed' && step !== 4) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-[420px] rounded-card border border-border bg-card p-7 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="font-serif text-xl font-semibold text-foreground">
            Sesiune Închisă
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Înregistrarea prezenței pentru cursul{' '}
            <span className="font-semibold text-foreground">{meta.courseName}</span> a
            fost închisă de profesor. Nu se mai acceptă scanări noi.
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
        <div className="space-y-0.5">
          <h1 className="font-serif text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
            {meta.courseName}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            {meta.sessionName} · {formatDate(meta.date)}
          </p>
        </div>

        {/* Slim Progress Indicator (Step 1 -> Step 2) */}
        {step < 4 && meta.requiresLocation && (
          <div className="flex items-center justify-center gap-1.5 pt-2">
            <span
              className={`h-1 rounded-full transition-all duration-300 ${
                step >= 1 ? 'w-8 bg-accent' : 'w-3 bg-muted'
              }`}
            />
            <span
              className={`h-1 rounded-full transition-all duration-300 ${
                step >= 2 ? 'w-8 bg-accent' : 'w-3 bg-muted'
              }`}
            />
          </div>
        )}
      </div>

      {/* ── Main Step Card ─────────────────────────────────────────── */}
      <div className="w-full max-w-[420px] mx-auto my-auto">
        <div className="rounded-card border border-border bg-card p-6 sm:p-7 shadow-md space-y-6">
          {/* Error Banner if any */}
          {apiError && (
            <div className="p-3.5 rounded-card bg-danger-soft text-danger border border-danger/20 text-xs space-y-1">
              <div className="flex items-center gap-2 font-semibold">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{apiError.title}</span>
              </div>
              <p className="text-[11px] leading-relaxed text-foreground/80">
                {apiError.message}
              </p>
            </div>
          )}

          {/* ── STEP 1: Email Input ─────────────────────────────────── */}
          {step === 1 && (
            <form onSubmit={handleEmailSubmit} className="space-y-5">
              <div className="space-y-1">
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  Confirmă Prezența
                </h2>
                <p className="text-xs text-muted-foreground">
                  Introdu adresa oficială de email primită de la universitate.
                </p>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-foreground">
                  Email universitar
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
                  placeholder="student@student.univ.ro"
                  className="flex min-h-[48px] w-full rounded-input border border-input bg-card px-3.5 py-3 text-base text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
                />
                <p className="text-[11px] text-muted-foreground font-mono">
                  Folosește adresa cu care ești înscris în catalogul oficial.
                </p>
              </div>

              <button
                type="submit"
                className="w-full min-h-[48px] rounded-input bg-accent text-white dark:text-neutral-900 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-accent/90 active:scale-[0.98] transition-all shadow-sm cursor-pointer"
              >
                <span>Continuă</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}

          {/* ── STEP 2: Location Permission Explainer ───────────────── */}
          {step === 2 && (
            <div className="space-y-5 text-center">
              <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto border border-accent/20">
                <MapPin className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  Verificare Perimetru Sală
                </h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Profesorul a activat verificarea prezenței fizice în amfiteatru. Browserul tău va calcula distanța până la catedră.
                </p>
              </div>

              {/* True Privacy Disclosure */}
              <div className="p-3 rounded-card bg-muted/50 border border-border text-[11px] text-muted-foreground text-left space-y-1">
                <span className="font-semibold text-foreground block">
                  Protecția intimității:
                </span>
                <p>
                  Coordonatele GPS sunt folosite exclusiv în acest moment pentru calculul distanței și nu sunt stocate permanent pe dispozitive terțe.
                </p>
              </div>

              {/* Permission Denied Resolution Accordion */}
              {gpsErrorType === 'denied' && (
                <div className="text-left rounded-card border border-warning/30 bg-warning-soft/40 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-warning font-semibold">
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="w-4 h-4" />
                      Permisiunea GPS a fost blocată
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowIosGuide(!showIosGuide)}
                      className="p-1 text-muted-foreground hover:text-foreground"
                    >
                      {showIosGuide ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {showIosGuide && (
                    <div className="text-[11px] text-muted-foreground space-y-1.5 pt-1 border-t border-border">
                      <p className="font-semibold text-foreground">Cum reactivezi localizarea:</p>
                      <p>
                        • <strong>iPhone (Safari):</strong> Apasă pe pictograma &quot;aA&quot; din stânga barei de adrese → Setări pagină web → Locație → Permite.
                      </p>
                      <p>
                        • <strong>Android (Chrome):</strong> Apasă pe pictograma de lacăt din bara de sus → Permisiuni → Locație → Activează.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  disabled={acquiringGps}
                  onClick={requestLocation}
                  className="w-full min-h-[48px] rounded-input bg-accent text-white dark:text-neutral-900 font-semibold text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-accent/90 active:scale-[0.98] transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {acquiringGps ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Se detectează semnalul GPS…</span>
                    </>
                  ) : (
                    <>
                      <Compass className="w-4 h-4" />
                      <span>Permite Locația &amp; Înregistrează</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs text-muted-foreground hover:text-foreground underline p-2"
                >
                  Schimbă emailul ({email})
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Submitting State ────────────────────────────── */}
          {step === 3 && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto" />
              <div className="space-y-1">
                <h3 className="font-serif text-lg font-semibold text-foreground">
                  Se verifică prezența…
                </h3>
                <p className="text-xs text-muted-foreground">
                  Validare catalog universitar și verificare perimetru.
                </p>
              </div>
            </div>
          )}

          {/* ── STEP 4: Animated Success Screen ─────────────────────── */}
          {step === 4 && successData && (
            <div className="text-center space-y-6 py-2">
              {/* CSS Animated SVG Checkmark */}
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
                    ? 'Prezență Deja Confirmată'
                    : 'Prezență Înregistrată!'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  Confirmarea ta a fost transmisă pe ecranul profesorului.
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
                  <span className="text-muted-foreground font-sans">Grupă:</span>
                  <span className="font-semibold text-accent">
                    {successData.student.group}
                  </span>
                </div>
                <div className="flex justify-between border-b border-border pb-2">
                  <span className="text-muted-foreground font-sans">Email:</span>
                  <span className="text-foreground">{successData.student.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-sans">Ora scanării:</span>
                  <span className="text-success font-medium">
                    {formatDate(successData.checkInTime)} {formatTime(successData.checkInTime)}
                  </span>
                </div>
                {successData.distance != null && (
                  <div className="flex justify-between pt-1">
                    <span className="text-muted-foreground font-sans">Distanță sală:</span>
                    <span className="text-accent">{successData.distance} metri</span>
                  </div>
                )}
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Poți închide această pagină web în siguranță.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <div className="w-full max-w-[420px] mx-auto text-center text-[10px] font-mono text-muted-foreground pt-6 pb-2">
        Sistem Universitar de Prezență · Universitatea Politehnica
      </div>
    </div>
  );
}

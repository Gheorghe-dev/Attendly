'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Logo } from '@/components/branding/Logo';
import { MapPin, CheckCircle2, Loader2, Navigation, AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Link from 'next/link';

interface SessionInfo {
  id: string;
  courseName: string;
  sessionName: string;
  classroom?: string | null;
  hostLat?: number | null;
  hostLng?: number | null;
  isCalibrated: boolean;
}

export default function CalibrateSessionPage() {
  const params = useParams();
  const id = params.id as string;

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [calibrating, setCalibrating] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/sessions/${id}/calibrate`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) setSession(data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  function handleCalibrate() {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setError(null);
    setCalibrating(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;

          const res = await fetch(`/api/sessions/${id}/calibrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          });

          const data = await res.json();
          if (res.ok) {
            setSuccess(`Classroom location calibrated to ${lat.toFixed(6)}, ${lng.toFixed(6)}!`);
            setSession((prev) => (prev ? { ...prev, hostLat: lat, hostLng: lng, isCalibrated: true } : prev));
          } else {
            setError(data.error || 'Failed to save location.');
          }
        } catch {
          setError('Network error while saving calibration.');
        } finally {
          setCalibrating(false);
        }
      },
      (err) => {
        setCalibrating(false);
        setError(`Could not access GPS (${err.message}). Please ensure Location permission is allowed.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-6">
      <div className="w-full max-w-md mx-auto pt-4 space-y-6 text-center">
        <Logo size="sm" className="mx-auto" />

        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-accent/15 text-accent border border-accent/25">
            <Navigation className="w-3.5 h-3.5" />
            <span>Classroom GPS Calibration</span>
          </span>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            {session?.courseName || 'Course Session'}
          </h1>
          <p className="text-xs text-muted-foreground font-mono">
            {session?.sessionName} {session?.classroom ? `· ${session.classroom}` : ''}
          </p>
        </div>

        <div className="rounded-card border border-border bg-card p-6 shadow-md text-left space-y-4">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MapPin className="w-4 h-4 text-accent" />
              <span>Location Anchor</span>
            </h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Calibrating sets your phone&apos;s real hardware GPS coordinates as the official classroom anchor. All student scans will be accurately measured against this exact point.
            </p>
          </div>

          {session?.isCalibrated && session.hostLat != null && (
            <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-mono space-y-0.5">
              <div className="font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Currently Calibrated</span>
              </div>
              <div className="text-[11px] text-muted-foreground">
                Lat: {session.hostLat.toFixed(6)}, Lng: {session.hostLng?.toFixed(6)}
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 font-mono flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <Button
            variant="accent"
            size="lg"
            className="w-full shadow-md text-xs font-mono font-bold uppercase tracking-wider"
            onClick={handleCalibrate}
            loading={calibrating}
          >
            <Navigation className="w-4 h-4" />
            <span>{session?.isCalibrated ? 'Recalibrate GPS Anchor' : 'Calibrate Classroom GPS'}</span>
          </Button>
        </div>

        <Link
          href={`/dashboard/sessions/${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-mono"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Session Dashboard</span>
        </Link>
      </div>

      <div className="text-center text-[11px] font-mono text-muted-foreground py-4">
        Attendly &middot; High-Precision WGS-84 Distance Engine
      </div>
    </div>
  );
}

'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle2, AlertTriangle, Loader2, GraduationCap, MapPin } from 'lucide-react';
import { Card } from '@/components/ui/Card';

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Missing verification token. Please open the link sent directly to your institutional email address.');
      return;
    }
    fetch(`/api/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setStatus('success');
          setMessage(data.message || 'Attendance verified successfully.');
          if (data.city) setCity(data.city);
        } else {
          setStatus('error');
          setMessage(data.error || 'Invalid or expired verification token.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Network error communicating with server. Please check your connection or notify the instructor.');
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4 relative overflow-hidden font-sans">
      {/* Subtle academic background watermark */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none">
        <GraduationCap className="w-[500px] h-[500px] text-foreground" />
      </div>

      <Card className="p-8 sm:p-10 w-full max-w-md text-center relative z-10 shadow-lg border-border space-y-6">
        {status === 'loading' && (
          <div className="space-y-4 py-4">
            <div className="w-16 h-16 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto border border-accent/20">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-widest text-accent font-semibold">
                Token Verification
              </span>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                Verifying Attendance...
              </h1>
              <p className="text-xs text-muted-foreground">
                Synchronizing confirmation with the session register.
              </p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-success-soft text-success flex items-center justify-center mx-auto border border-success/20">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-widest text-success font-semibold">
                Confirmation Succeeded
              </span>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                Attendance Confirmed
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {message}
              </p>
            </div>

            <div className="p-4 rounded-input bg-success-soft/50 border border-success/20 text-xs text-success text-left flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="font-semibold block">Your attendance is officially confirmed</span>
                {city && (
                  <span className="text-[11px] text-accent font-medium flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Confirmed location: {city}
                  </span>
                )}
                <span className="text-[11px] text-muted-foreground block">
                  You may safely close this browser window.
                </span>
              </div>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-4">
            <div className="w-16 h-16 rounded-full bg-danger-soft text-danger flex items-center justify-center mx-auto border border-danger/20">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-widest text-danger font-semibold">
                Validation Error
              </span>
              <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
                Confirmation Failed
              </h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {message}
              </p>
            </div>

            <div className="p-4 rounded-input bg-danger-soft/50 border border-danger/20 text-xs text-danger text-left">
              If you are in the lecture hall, please re-scan the projected QR code or inform the instructor.
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-border flex items-center justify-between text-[11px] font-mono text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <GraduationCap className="w-4 h-4 text-accent" />
            <span>Attendly</span>
          </div>
          <Link href="/login" className="hover:text-foreground transition-colors">
            Sign In
          </Link>
        </div>
      </Card>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}

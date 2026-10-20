'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  QrCode,
  MapPin,
  Radio,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '@/components/branding/Logo';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/shell/ThemeToggle';

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  // If already authenticated, redirect straight to dashboard
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.replace('/dashboard');
    }
  }, [status, session, router]);

  // Display confirmation when redirected from setup
  useEffect(() => {
    if (searchParams.get('registered') === '1') {
      setInfo('Contul de profesor a fost configurat cu succes. Te rugăm să te autentifici.');
      const e = searchParams.get('email');
      if (e) setEmail(e);
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (res?.error) {
        setError('Date de autentificare incorecte. Verifică adresa de email și parola.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('A apărut o eroare la conectare. Te rugăm să reîncerci.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail('prof@university.edu');
    setPassword('professor123');
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background text-foreground selection:bg-accent/20">
      {/* ── Left 50% Panel: Deep Navy Academic Brand Stage ──────────── */}
      <div className="hidden md:flex md:w-1/2 bg-[#0B1220] text-[#EDE9E0] flex-col justify-between p-8 lg:p-14 relative overflow-hidden select-none border-r border-[#22304A]">
        {/* Subtle geometric QR watermark pattern at ~6% opacity */}
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage: `radial-gradient(#C9A56B 1.5px, transparent 1.5px), radial-gradient(#EDE9E0 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
            backgroundPosition: '0 0, 14px 14px',
          }}
        />

        <div className="relative z-10">
          <Logo size="lg" className="text-[#EDE9E0]" />
        </div>

        {/* Central Brand Narrative */}
        <div className="relative z-10 max-w-md my-auto space-y-8">
          <div className="space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#C9A56B] px-2.5 py-1 rounded bg-[#C9A56B]/10 border border-[#C9A56B]/20">
              Sistem Academic de Prezență
            </span>
            <h1 className="font-serif text-3xl lg:text-4xl font-medium tracking-tight text-[#EDE9E0] leading-snug">
              Prezența, fără hârtie. <br />
              <span className="text-[#C9A56B] italic">Fără proxy.</span>
            </h1>
            <p className="text-xs lg:text-sm text-[#9AA4B5] leading-relaxed">
              Platformă universitară de monitorizare a prezenței studenților prin coduri QR dinamice, verificare biometrică GPS a sălii și sincronizare directă cu catalogul Excel.
            </p>
          </div>

          {/* 3 Academic Feature Lines with 1.5 stroke icons */}
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-input bg-[#16213A] text-[#C9A56B] flex items-center justify-center flex-shrink-0 border border-[#22304A]">
                <QrCode className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#EDE9E0]">
                  Scanare instantanee în amfiteatru
                </h4>
                <p className="text-[11px] text-[#9AA4B5] leading-relaxed">
                  Proiecție video a codului QR pe ecranul mare; scanare nativă fără instalare de aplicație pe telefon.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-input bg-[#16213A] text-[#C9A56B] flex items-center justify-center flex-shrink-0 border border-[#22304A]">
                <MapPin className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#EDE9E0]">
                  Geolocație sferică anti-proxy
                </h4>
                <p className="text-[11px] text-[#9AA4B5] leading-relaxed">
                  Calcul matematic Haversine ce garantează că studentul se află fizic în perimetrul sălii de curs.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3.5">
              <div className="w-8 h-8 rounded-input bg-[#16213A] text-[#C9A56B] flex items-center justify-center flex-shrink-0 border border-[#22304A]">
                <Radio className="w-4 h-4" strokeWidth={1.5} />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#EDE9E0]">
                  Monitorizare live &amp; Catalog Excel
                </h4>
                <p className="text-[11px] text-[#9AA4B5] leading-relaxed">
                  Flux continuu Server-Sent Events și export direct în foi de calcul colorate gata de arhivare.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-[#9AA4B5]">
          <span>Licență MIT · 100% Free &amp; Open Source</span>
          <span>v1.0.0</span>
        </div>
      </div>

      {/* ── Right 50% Panel: Ivory Academic Form Card ───────────────── */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 relative">
        <div className="flex items-center justify-between w-full">
          {/* Mobile brand header */}
          <div className="md:hidden">
            <Logo size="sm" />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="w-full max-w-[400px] mx-auto my-auto space-y-6">
          <div className="space-y-1.5">
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              Autentificare Profesor
            </h2>
            <p className="text-xs text-muted-foreground">
              Introdu credențialele instituționale pentru a deschide sesiunea.
            </p>
          </div>

          {info && (
            <div className="flex items-start gap-2.5 p-3 rounded-input bg-success-soft text-success border border-success/20 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-input bg-danger-soft text-danger border border-danger/20 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-foreground">
                Email universitar
              </label>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="profesor@universitate.ro"
                className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-foreground">
                  Parolă
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="w-3.5 h-3.5" />
                      <span>Ascunde</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-3.5 h-3.5" />
                      <span>Arată</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 pr-10 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loading}
              className="w-full text-xs font-semibold justify-center min-h-[44px] mt-2"
            >
              <span>Conectare la Panou</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </form>

          {/* Quick Demo Fill Card */}
          <div className="p-3.5 rounded-card border border-border bg-card/60 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                Cont Demonstrativ
              </p>
              <p className="text-xs font-mono text-foreground truncate mt-0.5">
                prof@university.edu
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={fillDemo}
              className="text-[11px] gap-1 text-accent border-accent/30 hover:bg-accent-soft"
            >
              <KeyRound className="w-3 h-3" />
              <span>Completează</span>
            </Button>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border">
            <Link
              href="/setup"
              className="hover:text-foreground hover:underline transition-colors flex items-center gap-1"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>Configurare inițială (Setup)</span>
            </Link>
          </div>
        </div>

        <div className="w-full text-center text-[11px] font-mono text-muted-foreground pt-6">
          QR Attendance System · Ediția Academică Universitară
        </div>
      </div>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-accent" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
  GraduationCap,
} from 'lucide-react';
import { Logo } from '@/components/branding/Logo';
import { Button } from '@/components/ui/Button';
import { ThemeToggle } from '@/components/shell/ThemeToggle';

export default function SetupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Parola trebuie să conțină cel puțin 8 caractere.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Nu s-a putut inițializa contul de profesor.');
        return;
      }

      router.push(`/login?registered=1&email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch {
      setError('Eroare de rețea. Te rugăm să reîncerci.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-background text-foreground selection:bg-accent/20">
      {/* ── Left 50% Panel: Deep Navy Academic Brand Stage ──────────── */}
      <div className="hidden md:flex md:w-1/2 bg-[#0B1220] text-[#EDE9E0] flex-col justify-between p-8 lg:p-14 relative overflow-hidden select-none border-r border-[#22304A]">
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

        <div className="relative z-10 max-w-md my-auto space-y-6">
          <div className="space-y-3">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#C9A56B] px-2.5 py-1 rounded bg-[#C9A56B]/10 border border-[#C9A56B]/20">
              Instalare &amp; Provizionare
            </span>
            <h1 className="font-serif text-3xl lg:text-4xl font-medium tracking-tight text-[#EDE9E0] leading-snug">
              Configurare Inițială <br />
              <span className="text-[#C9A56B] italic">Profesor Administrator</span>
            </h1>
            <p className="text-xs lg:text-sm text-[#9AA4B5] leading-relaxed">
              Creează contul principal pentru gestionarea cataloagelor, a perimetrelor GPS și a sesiunilor de curs.
            </p>
          </div>

          <div className="p-4 rounded-card bg-[#16213A] border border-[#22304A] space-y-2 text-xs text-[#9AA4B5]">
            <div className="flex items-center gap-2 text-[#C9A56B] font-semibold">
              <ShieldCheck className="w-4 h-4" />
              <span>Instanță Locală Securizată</span>
            </div>
            <p className="leading-relaxed">
              Datele sunt stocate local pe laptopul dumneavoastră într-o bază de date SQLite privată. Nu este necesară nicio cheie externă sau abonament cloud.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between text-[11px] font-mono text-[#9AA4B5]">
          <span>Sistem Universitar de Prezență</span>
          <span>v1.0.0</span>
        </div>
      </div>

      {/* ── Right 50% Panel: Ivory Academic Form Card ───────────────── */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-12 lg:p-16 relative">
        <div className="flex items-center justify-between w-full">
          <div className="md:hidden">
            <Logo size="sm" />
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>

        <div className="w-full max-w-[400px] mx-auto my-auto space-y-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-accent text-xs font-mono mb-1">
              <GraduationCap className="w-4 h-4" />
              <span>CREARE CONT PROFESOR</span>
            </div>
            <h2 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
              Înregistrare Administrator
            </h2>
            <p className="text-xs text-muted-foreground">
              Inițializează profilul profesorului titular.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-input bg-danger-soft text-danger border border-danger/20 text-xs animate-in fade-in">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-foreground">
                Nume complet titular
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex. Prof. Dr. Dan Popescu"
                className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-foreground">
                Email universitar
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="profesor@universitate.ro"
                className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-foreground">
                Parolă nouă (min. 8 caractere)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
              />
            </div>

            <Button
              type="submit"
              variant="accent"
              size="lg"
              loading={loading}
              className="w-full text-xs font-semibold justify-center min-h-[44px] mt-2"
            >
              <span>Inițializează Contul</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </form>

          <div className="text-center text-xs text-muted-foreground pt-3 border-t border-border">
            Ai deja un cont configurat?{' '}
            <Link href="/login" className="text-accent hover:underline font-medium">
              Conectează-te
            </Link>
          </div>
        </div>

        <div className="w-full text-center text-[11px] font-mono text-muted-foreground pt-6">
          QR Attendance System · Configurare Inițială
        </div>
      </div>
    </div>
  );
}

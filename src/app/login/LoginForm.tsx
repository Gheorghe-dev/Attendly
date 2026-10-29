'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { signIn, useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import { Logo } from '@/components/branding/Logo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
      setInfo('Instructor account successfully configured. Please sign in.');
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
        setError('Invalid credentials. Please verify your email and password.');
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch {
      setError('An error occurred during sign in. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail('prof@university.edu');
    setPassword('professor123');
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 bg-background text-foreground relative selection:bg-accent/20">
      {/* Top bar with Logo and Theme toggle */}
      <div className="flex items-center justify-between w-full max-w-[420px] pt-2">
        <Logo size="md" />
        <ThemeToggle />
      </div>

      {/* Main Login Card */}
      <Card className="w-full max-w-[420px] p-7 sm:p-8 my-auto space-y-6 shadow-md border-border">
        <div className="space-y-1.5 text-center">
          <div className="w-10 h-10 rounded-full bg-accent-soft text-accent mx-auto flex items-center justify-center border border-accent/20 mb-2">
            <Lock className="w-5 h-5" />
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Instructor Sign In
          </h1>
          <p className="text-xs text-muted-foreground">
            Enter your institutional credentials to open your dashboard.
          </p>
        </div>

        {info && (
          <div className="flex items-start gap-2.5 p-3 rounded-input bg-success-soft text-success border border-success/20 text-xs animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{info}</span>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-input bg-danger-soft text-danger border border-danger/20 text-xs animate-in fade-in">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-foreground">
              University Email
            </label>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="instructor@university.edu"
              className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-medium text-foreground">
                Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
              >
                {showPassword ? (
                  <>
                    <EyeOff className="w-3.5 h-3.5" />
                    <span>Hide</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-3.5 h-3.5" />
                    <span>Show</span>
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
            <span>Sign In to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </form>

        {/* Quick Demo Fill Card */}
        <div className="p-3.5 rounded-card border border-border bg-muted/40 flex items-center justify-between gap-3 text-xs">
          <div className="min-w-0">
            <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Demo Account (Clean New Slate)
            </p>
            <p className="text-xs font-mono text-foreground truncate mt-0.5">
              prof@university.edu
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Always starts fresh as a new instructor account
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fillDemo}
            className="text-[11px] gap-1 text-accent border-accent/30 hover:bg-accent-soft h-8 flex-shrink-0"
          >
            <KeyRound className="w-3 h-3" />
            <span>Auto-fill</span>
          </Button>
        </div>

        <div className="flex items-center justify-center text-xs text-muted-foreground pt-2 border-t border-border">
          <Link
            href="/setup"
            className="hover:text-foreground hover:underline transition-colors flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-accent" />
            <span>First time here? Initial Account Setup</span>
          </Link>
        </div>
      </Card>

      <div className="h-4" />
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

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  AlertTriangle,
  GraduationCap,
  UserPlus,
} from 'lucide-react';
import { Logo } from '@/components/branding/Logo';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
      setError('Password must contain at least 8 characters.');
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
        setError(data.error || 'Failed to initialize instructor account.');
        return;
      }

      router.push(`/login?registered=1&email=${encodeURIComponent(email.trim().toLowerCase())}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 bg-background text-foreground relative selection:bg-accent/20">
      {/* Top bar with Logo and Theme toggle */}
      <div className="flex items-center justify-between w-full max-w-[420px] pt-2">
        <Logo size="md" />
        <ThemeToggle />
      </div>

      {/* Main Setup Card */}
      <Card className="w-full max-w-[420px] p-7 sm:p-8 my-auto space-y-6 shadow-md border-border">
        <div className="space-y-1.5 text-center">
          <div className="w-10 h-10 rounded-full bg-accent-soft text-accent mx-auto flex items-center justify-center border border-accent/20 mb-2">
            <UserPlus className="w-5 h-5" />
          </div>
          <div className="flex items-center justify-center gap-1.5 text-accent text-xs font-mono">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>INSTRUCTOR SETUP</span>
          </div>
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
            Administrator Registration
          </h1>
          <p className="text-xs text-muted-foreground">
            Initialize the primary instructor account on this computer.
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
              Full Name &amp; Title
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Dr. Alex Johnson"
              className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-foreground">
              University Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="instructor@university.edu"
              className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-foreground">
              New Password (min. 8 characters)
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
            <span>Create Instructor Account</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </form>

        <div className="text-center text-xs text-muted-foreground pt-3 border-t border-border">
          Already have an account?{' '}
          <Link href="/login" className="text-accent hover:underline font-medium">
            Sign in
          </Link>
        </div>
      </Card>

      <div className="h-4" />
    </div>
  );
}

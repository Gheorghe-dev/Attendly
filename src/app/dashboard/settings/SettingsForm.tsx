'use client';

import React, { useState } from 'react';
import { Lock, ShieldCheck, CheckCircle2, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from 'sonner';

export function SettingsForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (next !== confirm) {
      setError('New password does not match confirmation.');
      return;
    }
    if (next.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }
    if (current === next) {
      setError('New password must differ from current password.');
      return;
    }

    setBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to update password.');
        return;
      }
      setSuccess('Password updated successfully. Please use it for your next sign-in.');
      toast.success('Access password has been updated.');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch {
      setError('Server connection error.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7 shadow-xs border-border space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-border">
        <div className="w-9 h-9 rounded-input bg-accent-soft text-accent flex items-center justify-center border border-accent/20">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <CardTitle className="text-base">Security &amp; Credentials</CardTitle>
          <CardDescription>
            Update the access password for your instructor account.
          </CardDescription>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-input bg-danger-soft text-danger border border-danger/20 text-xs animate-in fade-in">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-input bg-success-soft text-success border border-success/20 text-xs animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          type={showPw ? 'text' : 'password'}
          label="Current password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="••••••••••••"
        />

        <Input
          type={showPw ? 'text' : 'password'}
          label="New password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Minimum 8 characters"
          helperText="Recommended: combination of uppercase, lowercase, and numbers."
        />

        <Input
          type={showPw ? 'text' : 'password'}
          label="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Re-enter new password"
        />

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
          >
            {showPw ? (
              <EyeOff className="w-3.5 h-3.5 text-accent" />
            ) : (
              <Eye className="w-3.5 h-3.5" />
            )}
            <span>{showPw ? 'Hide password characters' : 'Show password characters'}</span>
          </button>
        </div>

        <div className="pt-2 border-t border-border">
          <Button
            type="submit"
            variant="accent"
            loading={busy}
            disabled={!current || !next || !confirm}
            className="w-full sm:w-auto"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Update Password</span>
          </Button>
        </div>
      </form>
    </Card>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export function DemoResetCard() {
  const router = useRouter();
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    if (
      !confirm(
        'Are you sure you want to reset this demo account? All test courses, students, and sessions created in this demo account will be wiped, returning it to a brand-new clean state.'
      )
    ) {
      return;
    }

    setResetting(true);
    try {
      const res = await fetch('/api/demo/reset', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Failed to reset demo account.');
        return;
      }
      toast.success('Demo account reset to clean new account state.');
      router.refresh();
      router.push('/dashboard');
    } catch {
      toast.error('Network error resetting demo account.');
    } finally {
      setResetting(false);
    }
  }

  return (
    <Card className="p-6 sm:p-7 shadow-xs border-accent/30 bg-accent-soft/10 space-y-4">
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="w-9 h-9 rounded-input bg-accent-soft text-accent flex items-center justify-center border border-accent/20">
          <RotateCcw className="w-4 h-4" />
        </div>
        <div>
          <CardTitle className="text-base">Demo Account Reset</CardTitle>
          <CardDescription>
            Clear all demo courses and test data to return to a clean, brand-new state.
          </CardDescription>
        </div>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed">
        This account (<strong className="text-foreground">prof@university.edu</strong>) is
        configured to let users test Attendly from a clean slate. You can wipe all data created
        during your tests at any time.
      </p>

      <div className="pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={resetting}
          onClick={handleReset}
          className="border-accent/40 text-accent hover:bg-accent-soft"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo to Clean State</span>
        </Button>
      </div>
    </Card>
  );
}

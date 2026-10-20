'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error to console for debugging
    console.error('Unhandled app error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <Card className="max-w-md w-full p-8 text-center relative z-10 shadow-lg border-border space-y-6">
        <div className="w-16 h-16 rounded-full bg-danger-soft text-danger mx-auto flex items-center justify-center border border-danger/20">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-widest text-danger font-semibold">
            Eroare de Execuție
          </span>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            A apărut o problemă neașteptată
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Sistemul a întâmpinat o eroare internă la procesarea acestei cereri. Puteți încerca să reîncărcați componenta sau să reveniți la panoul principal.
          </p>
          {error.digest && (
            <p className="text-[11px] font-mono text-muted-foreground pt-1">
              Cod referință: <span className="text-foreground">{error.digest}</span>
            </p>
          )}
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            variant="accent"
            size="md"
            onClick={() => reset()}
            className="w-full sm:w-auto gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reîncearcă</span>
          </Button>

          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="outline" size="md" className="w-full gap-2">
              <Home className="w-4 h-4" />
              <span>Panoul Principal</span>
            </Button>
          </Link>
        </div>
      </Card>

      <footer className="mt-8 text-center text-xs font-mono text-muted-foreground">
        QR Attendance System · Universitatea Tehnică
      </footer>
    </div>
  );
}

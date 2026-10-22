import * as React from 'react';
import { cn } from '@/lib/utils';

export function LiveBadge({
  isOpen,
  className,
}: {
  isOpen: boolean;
  className?: string;
}) {
  if (isOpen) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-success-soft text-success text-[11px] font-mono font-semibold border border-success/25 shadow-xs',
          className
        )}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
        </span>
        <span>LIVE</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill bg-muted text-muted-foreground text-[11px] font-mono font-semibold border border-border',
        className
      )}
    >
      <span className="inline-flex rounded-full h-2 w-2 bg-muted-foreground/60" />
      <span>CLOSED</span>
    </span>
  );
}

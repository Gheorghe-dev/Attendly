import * as React from 'react';
import { cn } from '@/lib/utils';

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const getInitials = (n: string) => {
    const parts = n.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const sizeClasses = {
    sm: 'w-7 h-7 text-[10px]',
    md: 'w-8 h-8 text-xs',
    lg: 'w-10 h-10 text-sm',
  };

  return (
    <div
      className={cn(
        'rounded-full bg-accent-soft text-accent font-semibold font-mono flex items-center justify-center border border-accent/25 select-none flex-shrink-0',
        sizeClasses[size],
        className
      )}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

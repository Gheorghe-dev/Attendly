import * as React from 'react';
import { cn } from '@/lib/utils';

export function ProgressRing({
  percentage,
  size = 54,
  strokeWidth = 4.5,
  className,
  showLabel = true,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
}) {
  const clamped = Math.min(100, Math.max(0, percentage));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;

  return (
    <div
      className={cn('relative inline-flex items-center justify-center select-none', className)}
      style={{ width: size, height: size }}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Rată de prezență: ${clamped}%`}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted/80"
          fill="none"
        />
        {/* Progress stroke */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="text-accent transition-all duration-500 ease-academic"
          fill="none"
        />
      </svg>
      {showLabel && (
        <span className="absolute font-mono text-[11px] font-bold text-foreground tabular-nums">
          {clamped}%
        </span>
      )}
    </div>
  );
}

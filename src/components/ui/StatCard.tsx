import * as React from 'react';
import { Card } from './Card';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  label: string;
  value: string | number;
  context?: string;
  icon?: React.ReactNode;
  trend?: {
    positive?: boolean;
    text: string;
  };
  sparklineData?: number[];
  className?: string;
}

export function StatCard({
  label,
  value,
  context,
  icon,
  trend,
  sparklineData,
  className,
}: StatCardProps) {
  // Hand-rolled SVG sparkline generator
  const renderSparkline = () => {
    if (!sparklineData || sparklineData.length < 2) return null;
    const width = 80;
    const height = 28;
    const min = Math.min(...sparklineData);
    const max = Math.max(...sparklineData);
    const range = max - min || 1;

    const points = sparklineData
      .map((val, idx) => {
        const x = (idx / (sparklineData.length - 1)) * (width - 4) + 2;
        const y = height - ((val - min) / range) * (height - 8) - 4;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

    return (
      <div className="flex items-center" title="Tendință ultimele sesiuni">
        <svg width={width} height={height} className="overflow-visible">
          <polyline
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
        </svg>
      </div>
    );
  };

  return (
    <Card className={cn('p-5 sm:p-6 relative overflow-hidden', className)}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider font-mono">
            {label}
          </p>
          <div className="flex items-baseline gap-3">
            <span className="font-serif text-3xl sm:text-4xl font-semibold text-foreground tracking-tight tabular-nums">
              {value}
            </span>
            {trend && (
              <span
                className={cn(
                  'text-[11px] font-medium font-mono px-1.5 py-0.5 rounded',
                  trend.positive
                    ? 'bg-success-soft text-success'
                    : 'bg-danger-soft text-danger'
                )}
              >
                {trend.text}
              </span>
            )}
          </div>
        </div>

        {icon && (
          <div className="w-9 h-9 rounded-full bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 shadow-xs border border-accent/20">
            {icon}
          </div>
        )}
      </div>

      {(context || sparklineData) && (
        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          {context && <span>{context}</span>}
          {sparklineData && renderSparkline()}
        </div>
      )}
    </Card>
  );
}

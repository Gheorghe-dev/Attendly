import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const badgeVariants = cva(
  'inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-medium transition-colors select-none',
  {
    variants: {
      variant: {
        default:
          'bg-muted text-foreground border border-border',
        accent:
          'bg-accent/15 text-accent border border-accent/30',
        success:
          'bg-success-soft text-success border border-success/20',
        danger:
          'bg-danger-soft text-danger border border-danger/20',
        warning:
          'bg-warning-soft text-warning border border-warning/20',
        info:
          'bg-info-soft text-info border border-info/20',
        outline:
          'border border-border text-foreground',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export function GroupBadge({
  group,
  className,
}: {
  group: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-mono text-[11px] font-semibold px-2 py-0.5 rounded-md bg-accent-soft text-accent border border-accent/25 tracking-tight',
        className
      )}
    >
      {group}
    </span>
  );
}

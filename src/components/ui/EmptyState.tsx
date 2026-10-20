import * as React from 'react';
import { Button } from './Button';
import { cn } from '@/lib/utils';

export interface EmptyStateActionObj {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'accent' | 'outline';
}

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode | EmptyStateActionObj;
  className?: string;
  children?: React.ReactNode;
}

function isActionObj(action: unknown): action is EmptyStateActionObj {
  return (
    typeof action === 'object' &&
    action !== null &&
    'label' in action &&
    typeof (action as Record<string, unknown>).onClick === 'function'
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  children,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-card border border-dashed border-border bg-card/50',
        className
      )}
    >
      {icon && (
        <div className="w-12 h-12 rounded-card bg-muted text-muted-foreground flex items-center justify-center mb-4 border border-border">
          {icon}
        </div>
      )}
      <h4 className="font-serif text-base font-semibold text-foreground tracking-tight">
        {title}
      </h4>
      <p className="text-xs text-muted-foreground max-w-sm mt-1 mb-5 leading-relaxed">
        {description}
      </p>
      {isActionObj(action) ? (
        <Button
          variant={action.variant || 'accent'}
          size="sm"
          onClick={action.onClick}
        >
          {action.icon}
          <span>{action.label}</span>
        </Button>
      ) : (
        (action as React.ReactNode)
      )}
      {children}
    </div>
  );
}

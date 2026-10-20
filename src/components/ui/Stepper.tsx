import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Step {
  title: string;
  description?: string;
}

export function Stepper({
  steps,
  currentStep,
  className,
}: {
  steps: Step[];
  currentStep: number; // 0-indexed
  className?: string;
}) {
  return (
    <div className={cn('w-full flex items-center justify-between', className)}>
      {steps.map((step, idx) => {
        const isCompleted = idx < currentStep;
        const isCurrent = idx === currentStep;

        return (
          <React.Fragment key={idx}>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-semibold transition-all duration-200 border',
                  isCompleted
                    ? 'bg-success text-white border-success'
                    : isCurrent
                    ? 'bg-accent text-white dark:text-neutral-900 border-accent shadow-xs'
                    : 'bg-muted text-muted-foreground border-border'
                )}
              >
                {isCompleted ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>
              <div className="hidden sm:block text-left">
                <span
                  className={cn(
                    'block text-xs font-medium tracking-tight',
                    isCurrent ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  )}
                >
                  {step.title}
                </span>
                {step.description && (
                  <span className="block text-[10px] text-muted-foreground">
                    {step.description}
                  </span>
                )}
              </div>
            </div>

            {idx < steps.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-[2px] mx-3 sm:mx-4 transition-all duration-200',
                  idx < currentStep ? 'bg-success' : 'bg-border'
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

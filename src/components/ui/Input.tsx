import * as React from 'react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, label, helperText, error, icon, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-medium text-foreground tracking-tight"
          >
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-muted-foreground">
              {icon}
            </div>
          )}
          <input
            type={type}
            id={inputId}
            disabled={disabled}
            className={cn(
              'flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground transition-all duration-150',
              'hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none',
              'disabled:cursor-not-allowed disabled:opacity-50',
              icon && 'pl-10',
              error && 'border-danger focus-visible:border-danger focus-visible:ring-danger/20',
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {error ? (
          <p className="text-[11px] font-medium text-danger">{error}</p>
        ) : helperText ? (
          <p className="text-[11px] text-muted-foreground">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
Input.displayName = 'Input';

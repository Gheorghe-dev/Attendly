import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-input text-xs font-medium transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 select-none active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
        accent:
          'bg-accent text-accent-foreground font-semibold hover:bg-accent/90 shadow-sm text-white dark:text-neutral-900',
        outline:
          'border border-border bg-card hover:bg-muted text-foreground shadow-sm',
        ghost:
          'hover:bg-muted text-foreground',
        destructive:
          'bg-danger text-white hover:bg-danger/90 shadow-sm',
        link:
          'text-accent underline-offset-4 hover:underline p-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-[11px] gap-1.5',
        md: 'h-10 px-4 text-xs gap-2',
        lg: 'h-11 px-5 text-sm gap-2.5',
        icon: 'h-9 w-9 p-0',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading = false, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }), loading && 'relative')}
        disabled={disabled || loading}
        ref={ref}
        {...props}
      >
        {loading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-4 h-4 animate-spin text-current" />
          </span>
        )}
        <span className={cn('inline-flex items-center gap-2', loading && 'invisible')}>
          {children}
        </span>
      </button>
    );
  }
);
Button.displayName = 'Button';

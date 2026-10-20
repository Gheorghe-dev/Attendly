import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  breadcrumbs?: BreadcrumbItem[];
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  breadcrumbs,
  title,
  description,
  action,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-border',
        className
      )}
    >
      <div className="space-y-1.5">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground mb-1">
            {breadcrumbs.map((b, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="w-3 h-3 text-border" />}
                {b.href ? (
                  <Link
                    href={b.href}
                    className="hover:text-foreground transition-colors"
                  >
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-foreground font-medium">{b.label}</span>
                )}
              </React.Fragment>
            ))}
          </nav>
        )}
        <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {action && (
        <div className="flex items-center gap-2.5 flex-shrink-0">{action}</div>
      )}
    </div>
  );
}

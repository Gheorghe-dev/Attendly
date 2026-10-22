import React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'hero';
  showTagline?: boolean;
  collapsed?: boolean;
  href?: string;
  className?: string;
}

export function Logo({
  size = 'md',
  showTagline = false,
  collapsed = false,
  href,
  className = '',
}: LogoProps) {
  const iconSizes = {
    sm: 'w-8 h-8',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    hero: 'w-14 h-14',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    hero: 'text-2xl',
  };

  const content = (
    <div className={cn('inline-flex items-center gap-2.5 select-none', className)}>
      {/* Attendly Glowing Holographic Emblem */}
      <div
        className={cn(
          'relative rounded-card overflow-hidden bg-[#0A0E17] border border-accent/40 shadow-xs flex-shrink-0 flex items-center justify-center p-0.5 group-hover:scale-105 transition-transform duration-200',
          iconSizes[size]
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/emblem.png"
          alt="Attendly"
          className="w-full h-full object-cover rounded-[5px]"
        />
      </div>

      {!collapsed && (
        <div className="flex flex-col min-w-0">
          <span
            className={cn(
              'font-serif font-bold tracking-tight text-foreground leading-none',
              textSizes[size]
            )}
          >
            Attendly
          </span>
          {showTagline && (
            <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground mt-1">
              Academic Edition
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center group">
        {content}
      </Link>
    );
  }

  return content;
}

import React from 'react';
import Link from 'next/link';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  href?: string;
  className?: string;
}

export function Logo({
  size = 'md',
  showTagline = false,
  href,
  className = '',
}: LogoProps) {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-8 h-8',
    lg: 'w-10 h-10',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  const content = (
    <div className={`inline-flex items-center gap-3 select-none ${className}`}>
      {/* 3x3 QR-Grid Glyph with 1 gold module */}
      <div
        className={`${iconSizes[size]} rounded-card bg-primary text-primary-foreground p-1.5 flex items-center justify-center shadow-sm relative overflow-hidden group`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full"
        >
          {/* Top-Left Module */}
          <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor" />
          <rect x="4" y="4" width="2" height="2" fill="var(--background)" />
          {/* Top-Right Module */}
          <rect x="16" y="2" width="6" height="6" rx="1" fill="currentColor" />
          <rect x="18" y="4" width="2" height="2" fill="var(--background)" />
          {/* Bottom-Left Module */}
          <rect x="2" y="16" width="6" height="6" rx="1" fill="currentColor" />
          <rect x="4" y="18" width="2" height="2" fill="var(--background)" />
          {/* Center Signature Gold Module */}
          <rect x="10" y="10" width="4" height="4" rx="1" fill="var(--accent)" />
          {/* Data Modules */}
          <rect x="10" y="4" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
          <rect x="10" y="18" width="4" height="2" rx="0.5" fill="currentColor" opacity="0.6" />
          <rect x="16" y="10" width="2" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
          <rect x="4" y="10" width="2" height="4" rx="0.5" fill="currentColor" opacity="0.6" />
          <rect x="16" y="16" width="6" height="6" rx="1" fill="currentColor" opacity="0.8" />
        </svg>
      </div>

      <div className="flex flex-col">
        <span
          className={`font-serif font-semibold tracking-tight text-foreground ${textSizes[size]}`}
        >
          QR Attendance
        </span>
        {showTagline && (
          <span className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
            Academic Edition
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="inline-flex items-center">
        {content}
      </Link>
    );
  }

  return content;
}

'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

export interface MultiSelectChipsProps {
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  label?: string;
  helperText?: string;
  showSelectAll?: boolean;
  className?: string;
}

export function MultiSelectChips({
  options,
  selected,
  onChange,
  label,
  helperText,
  showSelectAll = true,
  className,
}: MultiSelectChipsProps) {
  const toggleOption = (opt: string) => {
    if (selected.includes(opt)) {
      onChange(selected.filter((item) => item !== opt));
    } else {
      onChange([...selected, opt]);
    }
  };

  const handleSelectAll = () => {
    if (selected.length === options.length) {
      onChange([]);
    } else {
      onChange([...options]);
    }
  };

  const isAllSelected = options.length > 0 && selected.length === options.length;

  return (
    <div className={cn('w-full space-y-2', className)}>
      <div className="flex items-center justify-between">
        {label && (
          <label className="text-xs font-medium text-foreground tracking-tight">
            {label}
          </label>
        )}
        {showSelectAll && options.length > 0 && (
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-[11px] font-mono text-accent hover:underline cursor-pointer"
          >
            {isAllSelected ? 'Deselectează tot' : 'Selectează tot'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggleOption(opt)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-xs font-semibold transition-all duration-150 border select-none',
                isSelected
                  ? 'bg-accent text-white dark:text-neutral-900 border-accent shadow-xs'
                  : 'bg-card text-muted-foreground border-border hover:border-accent/40 hover:text-foreground'
              )}
            >
              {isSelected && <Check className="w-3.5 h-3.5" />}
              <span>{opt}</span>
            </button>
          );
        })}
      </div>

      {helperText && (
        <p className="text-[11px] text-muted-foreground">{helperText}</p>
      )}
    </div>
  );
}

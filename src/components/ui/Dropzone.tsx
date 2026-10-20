'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface DropzoneProps {
  accept?: string;
  onFileSelect: (file: File) => void;
  selectedFile?: File | null;
  onClear?: () => void;
  error?: string;
  className?: string;
  helper?: string;
}

export function Dropzone({
  accept = '.xlsx, .xls',
  onFileSelect,
  selectedFile,
  onClear,
  error,
  className,
  helper = 'Trage fișierul Excel (.xlsx) aici sau fă clic pentru a selecta de pe disc',
}: DropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  if (selectedFile) {
    return (
      <div
        className={cn(
          'p-5 rounded-card border border-border bg-card flex items-center justify-between gap-4 shadow-xs',
          className
        )}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-input bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 border border-accent/20">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {selectedFile.name}
            </p>
            <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
        </div>

        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="p-1.5 rounded-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Elimină fișier"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={cn(
        'cursor-pointer border-2 border-dashed rounded-card p-8 sm:p-10 text-center transition-all duration-200 select-none flex flex-col items-center justify-center',
        isDragOver
          ? 'border-accent bg-accent-soft/40 scale-[1.01]'
          : 'border-border bg-card/60 hover:bg-muted/40 hover:border-accent/40',
        error && 'border-danger bg-danger-soft/20',
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <div className="w-12 h-12 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-3 shadow-xs border border-accent/20">
        <UploadCloud className="w-6 h-6" />
      </div>
      <p className="text-xs font-medium text-foreground max-w-sm">{helper}</p>
      <p className="text-[11px] text-muted-foreground font-mono mt-1">
        Formate acceptate: .xlsx, .xls (max. 10MB)
      </p>
      {error && <p className="text-xs font-medium text-danger mt-2">{error}</p>}
    </div>
  );
}

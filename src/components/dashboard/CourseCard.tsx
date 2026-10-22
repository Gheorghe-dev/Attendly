'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import {
  Users,
  Layers,
  Calendar,
  MoreVertical,
  FileSpreadsheet,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { toast } from 'sonner';

export interface CourseCardProps {
  id: string;
  name: string;
  description?: string | null;
  studentCount: number;
  sessionCount: number;
  lastSessionDate?: Date | string | null;
  attendanceRate?: number;
}

export function CourseCard({
  id,
  name,
  description,
  studentCount,
  sessionCount,
  lastSessionDate,
  attendanceRate = 0,
}: CourseCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm(`Are you sure you want to delete the course "${name}"? All associated students and sessions will be deleted.`)) {
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success(`Course "${name}" was deleted.`);
        router.refresh();
      } else {
        toast.error('Failed to delete course.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Card
      interactive
      className="p-5 sm:p-6 flex flex-col justify-between relative group"
      onClick={() => router.push(`/dashboard/courses/${id}`)}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3 className="font-serif text-lg font-semibold tracking-tight text-foreground group-hover:text-accent transition-colors truncate">
              {name}
            </h3>
            {description ? (
              <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {description}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No description provided
              </p>
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 rounded-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              aria-label="Course options"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 top-8 z-30 w-44 rounded-card border border-border bg-card shadow-md py-1 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                <Link
                  href={`/dashboard/courses/${id}`}
                  className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open course</span>
                </Link>

                <a
                  href={`/api/courses/${id}/export`}
                  className="flex items-center gap-2 px-3 py-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-success" />
                  <span>Export roster (.xlsx)</span>
                </a>

                <div className="h-[1px] bg-border my-1" />

                <button
                  type="button"
                  disabled={deleting}
                  onClick={handleDelete}
                  className="w-full flex items-center gap-2 px-3 py-2 text-danger hover:bg-danger-soft transition-colors text-left"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete course</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-2 gap-2 pt-2 text-xs font-mono">
          <div className="flex items-center gap-2 p-2 rounded-input bg-muted/40 border border-border/40">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground font-semibold tabular-nums">{studentCount}</span>
            <span className="text-muted-foreground text-[10px]">students</span>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-input bg-muted/40 border border-border/40">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-foreground font-semibold tabular-nums">{sessionCount}</span>
            <span className="text-muted-foreground text-[10px]">sessions</span>
          </div>
        </div>
      </div>

      {/* Footer & Progress Bar */}
      <div className="mt-5 pt-3 border-t border-border space-y-2">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5 font-mono">
            <Calendar className="w-3 h-3 text-accent" />
            <span>
              {lastSessionDate ? `Last: ${formatDate(lastSessionDate)}` : 'No sessions yet'}
            </span>
          </div>
          <span className="font-mono font-medium text-foreground tabular-nums">
            {attendanceRate}% attendance
          </span>
        </div>

        {/* Thin attendance bar */}
        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500 ease-academic"
            style={{ width: `${Math.min(100, Math.max(0, attendanceRate))}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

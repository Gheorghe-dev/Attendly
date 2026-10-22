'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { GroupBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { SessionRowActions } from '@/components/SessionRowActions';
import { formatDateTime } from '@/lib/utils';
import {
  Layers,
  Search,
  Radio,
  Eye,
  FileSpreadsheet,
  Plus,
  X,
  CheckCircle2,
} from 'lucide-react';

export interface SessionItem {
  id: string;
  name: string;
  date: string;
  status: string;
  groups: string;
  classroom?: string | null;
  course: {
    id: string;
    name: string;
  };
  verifiedCount: number;
}

interface SessionsClientViewProps {
  initialSessions: SessionItem[];
}

export function SessionsClientView({ initialSessions }: SessionsClientViewProps) {
  const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return initialSessions.filter((s) => {
      if (filter === 'open' && s.status !== 'open') return false;
      if (filter === 'closed' && s.status !== 'closed') return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.course.name.toLowerCase().includes(q) ||
          s.groups.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [initialSessions, filter, search]);

  const openCount = useMemo(
    () => initialSessions.filter((s) => s.status === 'open').length,
    [initialSessions]
  );

  const totalVerified = useMemo(
    () => initialSessions.reduce((acc, s) => acc + s.verifiedCount, 0),
    [initialSessions]
  );

  if (initialSessions.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="w-6 h-6" />}
        title="No attendance sessions"
        description="You have not launched any sessions yet. Choose a course from the courses list and launch an attendance session with QR generation."
        action={
          <Link href="/dashboard/courses">
            <Button variant="accent" size="sm">
              <Plus className="w-3.5 h-3.5" />
              <span>Go to Courses</span>
            </Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls: Search & Status Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search by session, course, or group..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-card bg-muted/60 border border-border text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-input transition-all ${
              filter === 'all'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            All ({initialSessions.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('open')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-input transition-all ${
              filter === 'open'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Active ({openCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilter('closed')}
            className={`px-3 py-1.5 rounded-input transition-all ${
              filter === 'closed'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Closed ({initialSessions.length - openCount})
          </button>
        </div>
      </div>

      {/* Quick metrics banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-card bg-card border border-border flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Total Sessions
            </span>
            <div className="text-xl font-bold font-mono text-foreground tabular-nums">
              {initialSessions.length}
            </div>
          </div>
          <Layers className="w-5 h-5 text-muted-foreground opacity-40" />
        </div>

        <div className="p-3.5 rounded-card bg-card border border-border flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Active Sessions Now
            </span>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {openCount}
            </div>
          </div>
          <Radio className="w-5 h-5 text-emerald-500 opacity-60" />
        </div>

        <div className="p-3.5 rounded-card bg-card border border-border flex items-center justify-between">
          <div className="space-y-0.5">
            <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Total Verified Attendance
            </span>
            <div className="text-xl font-bold font-mono text-foreground tabular-nums">
              {totalVerified}
            </div>
          </div>
          <CheckCircle2 className="w-5 h-5 text-accent opacity-60" />
        </div>
      </div>

      {/* Sessions List */}
      {filtered.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-card border border-dashed border-border bg-card/40">
          <Layers className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="font-serif text-base font-semibold text-foreground">
            No sessions found
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            No sessions match the selected filter criteria.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((s) => {
            const isOpen = s.status === 'open';
            const groupsList = s.groups
              ? s.groups
                  .split(',')
                  .map((g) => g.trim())
                  .filter(Boolean)
              : [];

            return (
              <Card
                key={s.id}
                className={`p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:border-accent/50 ${
                  isOpen
                    ? 'border-l-4 border-l-emerald-500 bg-emerald-500/[0.02]'
                    : ''
                }`}
              >
                {/* Left Info */}
                <div className="flex items-start gap-3.5 min-w-0 flex-1">
                  <div className="mt-1 flex-shrink-0">
                    {isOpen ? (
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                      </span>
                    ) : (
                      <span className="inline-block w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />
                    )}
                  </div>

                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/sessions/${s.id}`}
                        className="font-serif text-base font-semibold text-foreground hover:text-accent transition-colors truncate"
                      >
                        {s.name}
                      </Link>
                      <span className="text-muted-foreground text-xs">·</span>
                      <Link
                        href={`/dashboard/courses/${s.course.id}`}
                        className="text-xs text-muted-foreground hover:text-foreground font-medium truncate"
                      >
                        {s.course.name}
                      </Link>
                      {isOpen && <LiveBadge isOpen={true} />}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-muted-foreground pt-0.5">
                      <span>{formatDateTime(s.date)}</span>
                      {s.classroom && (
                        <>
                          <span>·</span>
                          <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
                            📍 {s.classroom}
                          </span>
                        </>
                      )}
                      {groupsList.length > 0 && (
                        <>
                          <span>·</span>
                          <div className="flex flex-wrap gap-1">
                            {groupsList.map((g) => (
                              <GroupBadge key={g} group={g} />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Metrics & Actions */}
                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end pt-3 md:pt-0 border-t md:border-t-0 border-border">
                  {/* Verified Count */}
                  <div className="text-right pr-2">
                    <div className="text-base font-bold font-mono text-foreground tabular-nums">
                      {s.verifiedCount}
                    </div>
                    <div className="text-[10px] uppercase font-mono tracking-wider text-muted-foreground">
                      verified
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/sessions/${s.id}`}>
                      <Button
                        variant={isOpen ? 'accent' : 'outline'}
                        size="sm"
                        className="gap-1.5 h-8 text-xs"
                      >
                        {isOpen ? (
                          <>
                            <Radio className="w-3.5 h-3.5 text-inherit animate-pulse" />
                            <span>Monitor Live</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Details</span>
                          </>
                        )}
                      </Button>
                    </Link>

                    <a
                      href={`/api/sessions/${s.id}/export`}
                      title="Download Excel attendance report (.xlsx)"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-muted-foreground hover:text-success"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-xs ml-1">Export</span>
                      </Button>
                    </a>

                    <SessionRowActions id={s.id} name={s.name} />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

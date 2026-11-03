import React from 'react';
import { Card } from '@/components/ui/Card';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Check } from 'lucide-react';

interface SessionStatsProps {
  enrolledCount: number;
  presentCount: number;
  absentCount: number;
  remoteCount: number;
  attendanceRate: number;
}

export function SessionStats({
  enrolledCount,
  presentCount,
  absentCount,
  remoteCount,
  attendanceRate,
}: SessionStatsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card className="p-4 flex items-center justify-between border-border bg-card">
        <div className="space-y-0.5">
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
            Enrolled
          </span>
          <div className="text-2xl font-bold font-mono text-foreground">
            {enrolledCount}
          </div>
        </div>
        <div className="w-10 h-10 rounded-input bg-muted/60 flex items-center justify-center text-muted-foreground text-xs font-mono font-bold">
          ALL
        </div>
      </Card>

      <Card className="p-4 flex items-center justify-between border-emerald-500/20 bg-emerald-500/5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
              Present
            </span>
            {remoteCount > 0 && (
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                {remoteCount} remote
              </span>
            )}
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            {presentCount}
          </div>
        </div>
        <div className="w-10 h-10 rounded-input bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
          <Check className="w-5 h-5 stroke-[2.5]" />
        </div>
      </Card>

      <Card className="p-4 flex items-center justify-between border-rose-500/20 bg-rose-500/5">
        <div className="space-y-0.5">
          <span className="text-[11px] font-mono text-rose-600 dark:text-rose-400 uppercase tracking-wider">
            Absent
          </span>
          <div className="text-2xl font-bold font-mono text-rose-600 dark:text-rose-400">
            {absentCount}
          </div>
        </div>
        <div className="w-10 h-10 rounded-input bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-mono font-bold text-xs">
          ABS
        </div>
      </Card>

      <Card className="p-4 flex items-center justify-between border-accent/20 bg-accent-soft/20">
        <div className="space-y-0.5">
          <span className="text-[11px] font-mono text-accent uppercase tracking-wider">
            Attendance
          </span>
          <div className="text-2xl font-bold font-mono text-accent">
            {attendanceRate}%
          </div>
        </div>
        <ProgressRing percentage={attendanceRate} size={42} strokeWidth={4} />
      </Card>
    </div>
  );
}

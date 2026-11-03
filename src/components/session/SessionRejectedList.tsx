import React from 'react';
import { Card } from '@/components/ui/Card';
import { AlertTriangle } from 'lucide-react';
import { formatTime } from '@/lib/utils';

interface RejectedItem {
  id: string;
  email: string;
  reason: string;
  submittedAt: string;
}

interface SessionRejectedListProps {
  unrecognized?: RejectedItem[];
}

export function SessionRejectedList({ unrecognized }: SessionRejectedListProps) {
  if (!unrecognized || unrecognized.length === 0) return null;

  return (
    <Card className="p-5 space-y-3 text-xs border-danger/20 bg-danger-soft/10">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <span className="font-semibold text-danger flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-danger" />
          Rejected Submissions ({unrecognized.length})
        </span>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-[11px]">
        {unrecognized.map((u) => (
          <div
            key={u.id}
            className="p-2 rounded bg-background border border-danger/20 flex flex-col gap-0.5"
          >
            <div className="flex justify-between items-center text-foreground font-medium">
              <span>{u.email}</span>
              <span className="text-[10px] text-muted-foreground">
                {formatTime(u.submittedAt)}
              </span>
            </div>
            <div className="text-[10px] text-danger font-semibold">
              {u.reason === 'DEVICE_ALREADY_USED'
                ? 'Device already registered for another student'
                : u.reason === 'GROUP_NOT_ALLOWED'
                ? 'Group not scheduled for this session'
                : 'Email not found in course roster'}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

import React from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { GroupBadge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Search, Radio, WifiOff, Check } from 'lucide-react';
import { formatTime } from '@/lib/utils';
import { formatDistance, getDistanceCategory } from '@/lib/distance';

export interface RosterStudent {
  id: string;
  name: string;
  email: string;
  group: string;
  checkInTime?: string | null;
  isPresent: boolean;
  distance?: number | null;
  city?: string | null;
}

interface SessionRosterTableProps {
  roster: RosterStudent[];
  filteredRoster: RosterStudent[];
  search: string;
  onSearchChange: (val: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  groupFilter: string;
  onGroupFilterChange: (val: string) => void;
  targetGroups: string[];
  viewFilter: 'all' | 'present' | 'absent' | 'remote';
  onViewFilterChange: (val: 'all' | 'present' | 'absent' | 'remote') => void;
  enrolledCount: number;
  presentCount: number;
  absentCount: number;
  remoteCount: number;
  sseConnected: boolean;
  recentCheckedInIds: Set<string>;
  onOpenQr: () => void;
}

export function SessionRosterTable({
  filteredRoster,
  search,
  onSearchChange,
  searchInputRef,
  groupFilter,
  onGroupFilterChange,
  targetGroups,
  viewFilter,
  onViewFilterChange,
  enrolledCount,
  presentCount,
  absentCount,
  remoteCount,
  sseConnected,
  recentCheckedInIds,
  onOpenQr,
}: SessionRosterTableProps) {
  return (
    <div className="lg:col-span-2 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-foreground flex items-center gap-2">
            <span>Student Roster</span>
            <span className="text-xs font-mono font-normal text-muted-foreground">
              ({filteredRoster.length} students)
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Real-time check-in stream synchronized with student scans.
          </p>
        </div>

        {/* SSE Health Pill */}
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          {sseConnected ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <WifiOff className="w-3 h-3" />
              Reconnecting…
            </span>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2.5 bg-card p-3 rounded-card border border-border">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Filter by name or email… (Press /)"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-input bg-muted/40 border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Group Dropdown */}
          {targetGroups.length > 1 && (
            <select
              value={groupFilter}
              onChange={(e) => onGroupFilterChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs rounded-input bg-muted/40 border border-input text-foreground font-mono cursor-pointer focus:outline-none focus:border-accent"
            >
              <option value="">All Groups</option>
              {targetGroups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          )}

          {/* Status Segmented Control */}
          <div className="inline-flex rounded-input border border-input p-0.5 bg-muted/40 text-xs font-mono">
            <button
              type="button"
              onClick={() => onViewFilterChange('all')}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                viewFilter === 'all'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All ({enrolledCount})
            </button>
            <button
              type="button"
              onClick={() => onViewFilterChange('present')}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                viewFilter === 'present'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Present ({presentCount})
            </button>
            <button
              type="button"
              onClick={() => onViewFilterChange('absent')}
              className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                viewFilter === 'absent'
                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Absent ({absentCount})
            </button>
            {remoteCount > 0 && (
              <button
                type="button"
                onClick={() => onViewFilterChange('remote')}
                className={`px-2.5 py-1 rounded text-[11px] transition-colors ${
                  viewFilter === 'remote'
                    ? 'bg-rose-500 text-white font-semibold shadow-xs'
                    : 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/10'
                }`}
              >
                Remote ({remoteCount})
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Roster Table */}
      {filteredRoster.length === 0 ? (
        <EmptyState
          icon={<Radio className="w-8 h-8 text-accent" />}
          title="Waiting for first check-ins…"
          description="Project the QR code onto the lecture hall screen. Students will appear here instantly as they confirm attendance."
          action={{
            label: 'Open QR Code',
            onClick: onOpenQr,
            variant: 'accent',
          }}
        />
      ) : (
        <div className="rounded-card border border-border bg-card overflow-x-auto shadow-xs">
          <table className="w-full min-w-[650px] text-xs text-left">
            <thead className="bg-muted text-muted-foreground font-medium border-b border-border sticky top-0 z-10">
              <tr className="h-12 font-mono text-[11px] uppercase tracking-wider">
                <th scope="col" className="px-4 py-3 whitespace-nowrap min-w-[200px]">Student</th>
                <th scope="col" className="px-3 py-3 whitespace-nowrap min-w-[90px]">Group</th>
                <th scope="col" className="hidden md:table-cell px-4 py-3 whitespace-nowrap min-w-[180px]">Email</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap min-w-[130px]">Check-in Time</th>
                <th scope="col" className="px-4 py-3 whitespace-nowrap min-w-[150px]">Scan Distance</th>
                <th scope="col" className="px-4 py-3 text-right whitespace-nowrap min-w-[110px]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-xs">
              {filteredRoster.map((student) => {
                const isRecentlyAdded = recentCheckedInIds.has(student.id);

                return (
                  <tr
                    key={student.id}
                    className={`h-12 transition-all duration-300 ${
                      isRecentlyAdded
                        ? 'bg-accent/20 animate-pulse'
                        : student.isPresent
                        ? 'hover:bg-muted/30 text-foreground'
                        : 'bg-muted/20 text-muted-foreground hover:bg-muted/30'
                    }`}
                  >
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <Avatar name={student.name} size="sm" />
                        <div className="min-w-0 font-sans">
                          <span
                            className={`font-semibold block truncate max-w-[200px] ${
                              student.isPresent ? 'text-foreground' : 'text-muted-foreground line-through decoration-border'
                            }`}
                          >
                            {student.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <GroupBadge group={student.group} />
                    </td>

                    <td className="hidden md:table-cell px-4 py-2.5 text-muted-foreground truncate max-w-[200px] whitespace-nowrap" title={student.email}>
                      {student.email}
                    </td>

                    <td className="px-4 py-2.5 tabular-nums whitespace-nowrap">
                      {student.isPresent && student.checkInTime ? (
                        <span className="text-success font-medium flex items-center gap-1.5">
                          <Check className="w-3.5 h-3.5 text-success stroke-[2.5]" />
                          {formatTime(student.checkInTime)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {student.isPresent ? (
                        (() => {
                          const distInfo = getDistanceCategory(student.distance);
                          const distFormatted = formatDistance(student.distance);
                          return (
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono border ${distInfo.badgeClass}`}
                              title={
                                student.distance != null
                                  ? `Distance to host: ${formatDistance(student.distance)}`
                                  : 'Scan distance not available'
                              }
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  distInfo.category === 'room'
                                    ? 'bg-emerald-500'
                                    : distInfo.category === 'campus'
                                    ? 'bg-accent'
                                    : distInfo.category === 'remote'
                                    ? 'bg-rose-500'
                                    : 'bg-muted-foreground'
                                }`}
                              />
                              {distFormatted}
                            </span>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      {student.isPresent ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Check className="w-3 h-3 stroke-[3]" />
                          Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-muted-foreground bg-muted/60 border border-border">
                          Absent
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

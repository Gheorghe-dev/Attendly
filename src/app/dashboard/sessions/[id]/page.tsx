'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { GroupBadge } from '@/components/ui/Badge';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { QRProjectionModal } from '@/components/session/QRProjectionModal';
import { CalibrateLocationModal } from '@/components/session/CalibrateLocationModal';
import { formatDate, formatTime } from '@/lib/utils';
import {
  Radio,
  Download,
  Copy,
  Check,
  Search,
  Lock,
  Unlock,
  Maximize2,
  WifiOff,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  MapPin,
  Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistance, getDistanceCategory } from '@/lib/distance';

interface RosterStudent {
  id: string;
  name: string;
  email: string;
  group: string;
  checkInTime?: string | null;
  isPresent: boolean;
  distance?: number | null;
  city?: string | null;
}

interface SessionData {
  id: string;
  name: string;
  date: string;
  status: string; // 'open' | 'closed'
  groups: string;
  classroom?: string | null;
  token?: string;
  hostLat?: number | null;
  hostLng?: number | null;
  hostCity?: string | null;
  course: {
    id: string;
    name: string;
  };
  enrolledStudents: Array<{
    id: string;
    name: string;
    email: string;
    group: string;
  }>;
  attendance: Array<{
    id: string;
    studentId: string;
    student: {
      id: string;
      name: string;
      email: string;
      group: string;
    };
    verifiedAt: string;
    distanceMeters?: number | null;
    studentCity?: string | null;
  }>;
  unrecognized?: Array<{
    id: string;
    email: string;
    reason: string;
    submittedAt: string;
  }>;
}

export default function LiveSessionMonitorPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [projectionOpen, setProjectionOpen] = useState(false);
  const [calibrateModalOpen, setCalibrateModalOpen] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Announcer text for screen readers (aria-live="polite")
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');

  // Set of recently added student IDs to flash highlight
  const [recentCheckedInIds, setRecentCheckedInIds] = useState<Set<string>>(new Set<string>());

  // Filter toolbar
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'present' | 'absent' | 'remote'>('all');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // QR data
  const [qrData, setQrData] = useState<{
    qr: string;
    url: string;
    baseUrl?: string;
  } | null>(null);

  // Load session data
  const loadInitialData = useCallback(async () => {
    try {
      const [sessionRes, qrRes] = await Promise.all([
        fetch(`/api/sessions/${id}`),
        fetch(`/api/sessions/${id}/qr`),
      ]);

      if (sessionRes.ok) {
        const sData = await sessionRes.json();
        setSession(sData);
      }
      if (qrRes.ok) {
        const qData = await qrRes.json();
        if (qData?.qr) {
          setQrData(qData);
        }
      } else {
        // Fallback retry after brief pause in case server was initializing
        setTimeout(async () => {
          try {
            const retryRes = await fetch(`/api/sessions/${id}/qr`);
            if (retryRes.ok) {
              const retryData = await retryRes.json();
              if (retryData?.qr) setQrData(retryData);
            }
          } catch {}
        }, 1200);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Continuously refresh QR code until Cloudflare worldwide tunnel URL is available for any Wi-Fi
  useEffect(() => {
    const isWorldwide = qrData?.url?.includes('trycloudflare.com');
    if (isWorldwide) return;

    let attempts = 0;
    const maxAttempts = 30; // 45 seconds polling

    const interval = setInterval(async () => {
      attempts++;
      if (attempts > maxAttempts) {
        clearInterval(interval);
        return;
      }

      try {
        const qrRes = await fetch(`/api/sessions/${id}/qr`);
        if (qrRes.ok) {
          const qData = await qrRes.json();
          if (qData?.url && qData?.qr) {
            setQrData(qData);
            if (qData.url.includes('trycloudflare.com')) {
              clearInterval(interval);
            }
          }
        }
      } catch {}
    }, 1500);

    return () => clearInterval(interval);
  }, [id, qrData?.url]);

  // Silently refine host location from professor's browser if available
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await fetch(`/api/sessions/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hostLat: pos.coords.latitude,
              hostLng: pos.coords.longitude,
            }),
          });
        } catch {
          // Silent fallback
        }
      },
      () => {},
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 }
    );
  }, [id]);

  // Connect to SSE stream
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout;

    function connectSSE() {
      eventSource = new EventSource(`/api/sessions/${id}/stream`);

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && Array.isArray(data.records)) {
            setSession((prev) => {
              if (!prev) return prev;

              // Detect newly added records
              const prevIds = new Set(prev.attendance.map((a) => a.studentId));
              const newlyAdded = data.records.filter(
                (r: { studentId: string }) => !prevIds.has(r.studentId)
              );

              if (newlyAdded.length > 0) {
                const firstNew = newlyAdded[0];
                const distInfo =
                  firstNew.distance != null
                    ? ` (${formatDistance(firstNew.distance)})`
                    : '';
                setAriaAnnouncement(`${firstNew.name} confirmed attendance${distInfo}.`);
                toast.success(`${firstNew.name} (${firstNew.group}) checked in${distInfo}.`);

                // Add to highlight set and remove after 1200ms
                const newIds: string[] = newlyAdded.map((r: { studentId: string }) => r.studentId);
                setRecentCheckedInIds((old) => new Set<string>([...Array.from(old), ...newIds]));
                setTimeout(() => {
                  setRecentCheckedInIds((old) => {
                    const next = new Set<string>(old);
                    newIds.forEach((sid) => next.delete(sid));
                    return next;
                  });
                }, 1200);
              }

              return {
                ...prev,
                status: data.status,
                attendance: data.records.map((r: {
                  id: string;
                  studentId: string;
                  name: string;
                  email: string;
                  group: string;
                  checkInTime: string;
                  distance?: number | null;
                  city?: string | null;
                }) => ({
                  id: r.id,
                  studentId: r.studentId,
                  student: {
                    id: r.studentId,
                    name: r.name,
                    email: r.email,
                    group: r.group,
                  },
                  verifiedAt: r.checkInTime,
                  distanceMeters: r.distance,
                  studentCity: r.city,
                })),
              };
            });
          }
        } catch (e) {
          console.error('[SSE parse error]', e);
        }
      };

      eventSource.onerror = () => {
        setSseConnected(false);
        eventSource?.close();
        // Retry connection in 3 seconds
        retryTimeout = setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      clearTimeout(retryTimeout);
    };
  }, [id]);

  // Target groups array
  const targetGroups = useMemo(() => {
    if (!session?.groups) return [];
    return session.groups.split(',').map((g) => g.trim()).filter(Boolean);
  }, [session]);

  // Combined Roster (Present + Absent)
  const roster = useMemo<RosterStudent[]>(() => {
    if (!session) return [];

    const presentMap = new Map<
      string,
      { time: string; distance?: number | null; city?: string | null }
    >();
    session.attendance.forEach((a) => {
      presentMap.set(a.studentId, {
        time: a.verifiedAt,
        distance: a.distanceMeters,
        city: a.studentCity,
      });
    });

    const list: RosterStudent[] = (session.enrolledStudents || []).map((s) => {
      const pres = presentMap.get(s.id);
      return {
        id: s.id,
        name: s.name,
        email: s.email,
        group: s.group,
        isPresent: Boolean(pres),
        checkInTime: pres?.time || null,
        distance: pres?.distance ?? null,
        city: pres?.city ?? null,
      };
    });

    // Sort: present students first by check-in time desc, then absent students alphabetically
    return list.sort((a, b) => {
      if (a.isPresent && !b.isPresent) return -1;
      if (!a.isPresent && b.isPresent) return 1;
      if (a.isPresent && b.isPresent) {
        return (
          new Date(b.checkInTime || 0).getTime() -
          new Date(a.checkInTime || 0).getTime()
        );
      }
      return a.name.localeCompare(b.name);
    });
  }, [session]);

  // Filtered Roster
  const filteredRoster = useMemo(() => {
    return roster.filter((student) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        student.name.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q);

      const matchesGroup =
        !groupFilter || student.group.trim() === groupFilter.trim();

      const matchesView =
        viewFilter === 'all'
          ? true
          : viewFilter === 'present'
          ? student.isPresent
          : viewFilter === 'absent'
          ? !student.isPresent
          : student.isPresent && (student.distance ?? 0) > 350;

      return matchesSearch && matchesGroup && matchesView;
    });
  }, [roster, search, groupFilter, viewFilter]);

  // Metrics calculation
  const enrolledCount = roster.length;
  const presentCount = roster.filter((r) => r.isPresent).length;
  const absentCount = Math.max(0, enrolledCount - presentCount);
  const remoteCount = roster.filter((r) => r.isPresent && (r.distance ?? 0) > 350).length;
  const attendanceRate =
    enrolledCount > 0 ? Math.round((presentCount / enrolledCount) * 100) : 0;

  // Toggle session open/closed with confirmation
  async function toggleSessionStatus() {
    if (!session) return;
    const isCurrentlyOpen = session.status === 'open';

    if (isCurrentlyOpen) {
      const confirmed = confirm(
        'Are you sure you want to close attendance check-in? Students attempting to scan after this will be rejected.'
      );
      if (!confirmed) return;
    }

    setTogglingStatus(true);
    const newStatus = isCurrentlyOpen ? 'closed' : 'open';

    try {
      const res = await fetch(`/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setSession((prev) => (prev ? { ...prev, status: newStatus } : prev));
        toast.success(
          newStatus === 'open'
            ? 'Session was reopened for check-ins.'
            : 'Attendance check-in has been closed.'
        );
      } else {
        toast.error('Failed to update session status.');
      }
    } catch {
      toast.error('Network error.');
    } finally {
      setTogglingStatus(false);
    }
  }

  const copyPublicLink = useCallback(() => {
    if (!qrData?.url) return;
    navigator.clipboard.writeText(qrData.url);
    setCopiedLink(true);
    toast.success('Attendance link copied to clipboard.');
    setTimeout(() => setCopiedLink(false), 2000);
  }, [qrData?.url]);

  // Lecturer keyboard shortcuts: P (present QR), C (copy URL), / (search)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const activeTag = document.activeElement?.tagName;
      const isInput =
        activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if ((e.key === 'p' || e.key === 'P') && !isInput && !projectionOpen) {
        e.preventDefault();
        setProjectionOpen(true);
        return;
      }
      if ((e.key === 'c' || e.key === 'C') && !isInput) {
        if (qrData?.url) {
          e.preventDefault();
          copyPublicLink();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [qrData?.url, projectionOpen, copyPublicLink]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!session) {
    return (
      <EmptyState
        title="Session not found"
        description="The requested attendance session does not exist or was deleted."
        action={{
          label: 'Back to Courses',
          onClick: () => router.push('/dashboard/courses'),
        }}
      />
    );
  }

  const isOpen = session.status === 'open';

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-12">
      {/* Invisible Screen Reader Announcer */}
      <div aria-live="polite" className="sr-only">
        {ariaAnnouncement}
      </div>

      {/* ── Top Header ────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-border">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <LiveBadge isOpen={isOpen} />
            <span className="text-xs font-mono text-muted-foreground">
              {formatDate(session.date)} at {formatTime(session.date)}
            </span>
            {session.classroom && (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-medium text-accent bg-accent/10 px-2.5 py-0.5 rounded-full border border-accent/20">
                <MapPin className="w-3 h-3 text-accent" />
                <span>{session.classroom}</span>
              </span>
            )}
            {targetGroups.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center ml-1">
                {targetGroups.map((g) => (
                  <GroupBadge key={g} group={g} />
                ))}
              </div>
            )}
            <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              <ShieldCheck className="w-3 h-3" />
              <span>1 Device / Student</span>
            </span>
            {session.hostLat != null && session.hostLng != null && (
              <span
                className="inline-flex items-center gap-1 text-xs font-mono text-sky-600 dark:text-sky-400 bg-sky-500/10 px-2.5 py-0.5 rounded-full border border-sky-500/20"
                title="Host device location calibrated: student scan proximity measured with WGS-84 precision"
              >
                <Navigation className="w-3 h-3" />
                <span>Host Proximity Calibrated</span>
              </span>
            )}
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {session.course.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Session topic:{' '}
            <span className="font-medium text-foreground">{session.name}</span>
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant={isOpen ? 'outline' : 'accent'}
            size="sm"
            loading={togglingStatus}
            onClick={toggleSessionStatus}
            className={isOpen ? 'text-danger border-danger/30 hover:bg-danger-soft' : ''}
          >
            {isOpen ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
            <span>{isOpen ? 'Close Check-in' : 'Reopen Session'}</span>
          </Button>

          <a href={`/api/sessions/${id}/export`}>
            <Button variant="outline" size="sm">
              <Download className="w-3.5 h-3.5 text-success" />
              <span>Export Excel</span>
            </Button>
          </a>

          <Button
            variant="outline"
            size="sm"
            onClick={copyPublicLink}
            className="flex items-center gap-1.5"
            title="Copy attendance URL (Press C)"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Copied' : 'Copy Link'}</span>
            <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
              C
            </kbd>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setCalibrateModalOpen(true)}
            className="flex items-center gap-1.5"
            title="Calibrate exact classroom GPS anchor"
          >
            <Navigation className="w-3.5 h-3.5 text-accent" />
            <span>{session.hostLat != null ? 'Calibrate GPS' : 'Set GPS Anchor'}</span>
          </Button>

          <Button
            variant="accent"
            size="sm"
            onClick={() => setProjectionOpen(true)}
            className="shadow-sm flex items-center gap-1.5"
            title="Present Fullscreen QR (Press P)"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Present QR</span>
            <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 text-accent-foreground border border-white/20">
              P
            </kbd>
          </Button>
        </div>
      </div>

      {/* ── Summary Counters ───────────────────────────────────────── */}
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

      {/* ── Main Two-Column Layout ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left 2 Cols: Live Attendance Roster */}
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
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by name or email… (Press /)"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-input bg-muted/40 border border-input text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent"
              />
            </div>

            <div className="flex items-center gap-2">
              {/* Group Dropdown */}
              {targetGroups.length > 1 && (
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
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
                  onClick={() => setViewFilter('all')}
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
                  onClick={() => setViewFilter('present')}
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
                  onClick={() => setViewFilter('absent')}
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
                    onClick={() => setViewFilter('remote')}
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
                onClick: () => setProjectionOpen(true),
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

        {/* Right 1 Col: Live QR Card + Session Details */}
        <div className="space-y-6">
          <Card className="p-6 text-center space-y-4 border-accent/20">
            <div className="space-y-1">
              <span className="text-xs font-mono text-accent font-semibold uppercase tracking-wider">
                Live Dynamic QR
              </span>
              <CardTitle className="text-base">Scan to Register</CardTitle>
              <CardDescription>
                Tokens cycle automatically every few seconds to prevent proxy attendance.
              </CardDescription>
            </div>

            <div className="p-3 bg-white rounded-card shadow-inner border border-border inline-block mx-auto max-w-[220px]">
              {qrData?.qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrData.qr}
                  alt="Session Attendance QR"
                  className="w-full h-auto rounded"
                />
              ) : (
                <div className="w-[196px] h-[196px] bg-muted/30 flex flex-col items-center justify-center text-muted-foreground p-3 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-accent" />
                  <span className="text-[11px] font-mono">Generating QR…</span>
                  <button
                    type="button"
                    onClick={() => {
                      fetch(`/api/sessions/${id}/qr`)
                        .then((r) => r.json())
                        .then((d) => {
                          if (d?.qr) setQrData(d);
                        })
                        .catch(() => {});
                    }}
                    className="text-[10px] text-accent hover:underline font-mono"
                  >
                    Click to reload
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-1">
              <Button
                variant="accent"
                size="md"
                onClick={() => setProjectionOpen(true)}
                className="w-full shadow-sm"
              >
                <Maximize2 className="w-4 h-4" />
                <span>Present Full Screen</span>
              </Button>

              <button
                type="button"
                onClick={copyPublicLink}
                className="text-xs text-muted-foreground hover:text-foreground font-mono flex items-center justify-center gap-1.5 mx-auto py-1"
              >
                {copiedLink ? (
                  <Check className="w-3 h-3 text-success" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedLink ? 'Copied URL' : 'Copy student direct URL'}</span>
              </button>

              {qrData?.url && (
                <div className="pt-1.5 border-t border-border/50">
                  <span className="text-[11px] font-mono flex items-center justify-center gap-1">
                    {qrData.url.includes('trycloudflare.com') ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                        🌍 Accessible from ANY Wi-Fi & 4G/5G
                      </span>
                    ) : !qrData.url.includes('localhost') && !qrData.url.includes('127.0.0.1') ? (
                      <span className="text-sky-600 dark:text-sky-400 font-medium">
                        📶 Accessible on local Wi-Fi
                      </span>
                    ) : (
                      <span className="text-amber-500 font-medium">
                        ⚠️ Connecting tunnel for worldwide Wi-Fi access…
                      </span>
                    )}
                  </span>
                </div>
              )}
            </div>
          </Card>

          {/* Session Overview Card */}
          <Card className="p-5 space-y-3 text-xs">
            <CardTitle className="text-sm">Session Overview</CardTitle>
            <div className="space-y-2.5 text-muted-foreground pt-1 border-t border-border">
              <div className="flex justify-between items-center">
                <span>Status:</span>
                <span className="font-mono text-foreground font-medium capitalize">
                  {session.status}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Device Protection:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  1 student / device
                </span>
              </div>
              <div className="flex justify-between">
                <span>Target groups:</span>
                <span className="font-mono text-foreground font-medium">
                  {targetGroups.length > 0 ? targetGroups.join(', ') : 'All groups'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Enrolled students:</span>
                <span className="font-mono text-foreground font-medium tabular-nums">
                  {enrolledCount}
                </span>
              </div>
            </div>
          </Card>

          {/* Rejected Submissions Log (Proxy protection) */}
          {session.unrecognized && session.unrecognized.length > 0 && (
            <Card className="p-5 space-y-3 text-xs border-danger/20 bg-danger-soft/10">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <span className="font-semibold text-danger flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-danger" />
                  Rejected Submissions ({session.unrecognized.length})
                </span>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto font-mono text-[11px]">
                {session.unrecognized.map((u) => (
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
          )}
        </div>
      </div>

      {/* ── Fullscreen Projector Modal ─────────────────────────────── */}
      <QRProjectionModal
        open={projectionOpen}
        onClose={() => setProjectionOpen(false)}
        qrDataUrl={qrData?.qr || ''}
        publicUrl={qrData?.url || ''}
        courseName={session.course.name}
        sessionName={session.name}
        classroom={session.classroom}
        targetGroups={targetGroups}
        presentCount={presentCount}
        enrolledCount={enrolledCount}
        isOpen={isOpen}
      />

      {/* ── Classroom GPS Calibration Modal ──────────────────────────── */}
      <CalibrateLocationModal
        open={calibrateModalOpen}
        onClose={() => setCalibrateModalOpen(false)}
        sessionId={id}
        hostLat={session.hostLat}
        hostLng={session.hostLng}
        publicBaseUrl={qrData?.baseUrl}
        onCalibrated={() => {
          loadInitialData();
          toast.success('Classroom GPS calibrated! Student proximity updated.');
        }}
      />
    </div>
  );
}

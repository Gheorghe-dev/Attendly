'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { GroupBadge } from '@/components/ui/Badge';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import { QRProjectionModal } from '@/components/session/QRProjectionModal';
import { CalibrateLocationModal } from '@/components/session/CalibrateLocationModal';
import { SessionStats } from '@/components/session/SessionStats';
import { SessionRosterTable, RosterStudent } from '@/components/session/SessionRosterTable';
import { SessionQRCodeCard } from '@/components/session/SessionQRCodeCard';
import { SessionRejectedList } from '@/components/session/SessionRejectedList';
import { formatDate, formatTime } from '@/lib/utils';
import {
  Download,
  Copy,
  Check,
  Lock,
  Unlock,
  Maximize2,
  Loader2,
  ShieldCheck,
  MapPin,
  Navigation,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistance } from '@/lib/distance';

interface SessionData {
  id: string;
  name: string;
  date: string;
  status: string;
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
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');
  const [recentCheckedInIds, setRecentCheckedInIds] = useState<Set<string>>(new Set<string>());

  // Filter toolbar state
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

  // Load initial data
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
        if (qData?.qr) setQrData(qData);
      } else {
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

    // Polling ensures attendance updates on PC even if SSE is buffered by proxies
    const pollInterval = setInterval(async () => {
      try {
        const sessionRes = await fetch(`/api/sessions/${id}`);
        if (sessionRes.ok) {
          const sData = await sessionRes.json();
          setSession((prev) => {
            if (!prev) return sData;

            const prevIds = new Set(prev.attendance.map((a) => a.studentId));
            const newlyAdded = (sData.attendance || []).filter(
              (a: { studentId: string }) => !prevIds.has(a.studentId)
            );

            if (newlyAdded.length > 0) {
              const firstNew = newlyAdded[0];
              const distInfo =
                firstNew.distanceMeters != null ? ` (${formatDistance(firstNew.distanceMeters)})` : '';
              const studentName = firstNew.student?.name || 'A student';
              const studentGroup = firstNew.student?.group || '';
              setAriaAnnouncement(`${studentName} confirmed attendance${distInfo}.`);
              toast.success(`${studentName} (${studentGroup}) checked in${distInfo}.`);

              const newIds: string[] = newlyAdded.map((a: { studentId: string }) => a.studentId);
              setRecentCheckedInIds((old) => new Set<string>([...Array.from(old), ...newIds]));
              setTimeout(() => {
                setRecentCheckedInIds((old) => {
                  const next = new Set<string>(old);
                  newIds.forEach((sid) => next.delete(sid));
                  return next;
                });
              }, 2000);
            }

            return sData;
          });
        }
      } catch {}
    }, 2000);

    const handleFocus = () => loadInitialData();
    window.addEventListener('focus', handleFocus);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') handleFocus();
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [id, loadInitialData]);

  // Continuously refresh QR code until Cloudflare worldwide tunnel is connected
  useEffect(() => {
    const isWorldwide = qrData?.url?.includes('trycloudflare.com');
    if (isWorldwide) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (attempts > 30) {
        clearInterval(interval);
        return;
      }

      try {
        const qrRes = await fetch(`/api/sessions/${id}/qr`);
        if (qrRes.ok) {
          const qData = await qrRes.json();
          if (qData?.url && qData?.qr) {
            setQrData(qData);
            if (qData.url.includes('trycloudflare.com')) clearInterval(interval);
          }
        }
      } catch {}
    }, 1500);

    return () => clearInterval(interval);
  }, [id, qrData?.url]);

  // Refine host location from lecturer's browser
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
        } catch {}
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
      eventSource.onopen = () => setSseConnected(true);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && Array.isArray(data.records)) {
            setSession((prev) => {
              if (!prev) return prev;
              const prevIds = new Set(prev.attendance.map((a) => a.studentId));
              const newlyAdded = data.records.filter(
                (r: { studentId: string }) => !prevIds.has(r.studentId)
              );

              if (newlyAdded.length > 0) {
                const firstNew = newlyAdded[0];
                const distInfo =
                  firstNew.distance != null ? ` (${formatDistance(firstNew.distance)})` : '';
                setAriaAnnouncement(`${firstNew.name} confirmed attendance${distInfo}.`);
                toast.success(`${firstNew.name} (${firstNew.group}) checked in${distInfo}.`);

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
                attendance: data.records.map((r: any) => ({
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
        retryTimeout = setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();
    return () => {
      if (eventSource) eventSource.close();
      clearTimeout(retryTimeout);
    };
  }, [id]);

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

    const seenStudentIds = new Set<string>();
    const list: RosterStudent[] = (session.enrolledStudents || []).map((s) => {
      seenStudentIds.add(s.id);
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

    // Ensure all checked in students appear in roster
    session.attendance.forEach((a) => {
      if (a.student && !seenStudentIds.has(a.studentId)) {
        seenStudentIds.add(a.studentId);
        list.push({
          id: a.student.id || a.studentId,
          name: a.student.name,
          email: a.student.email,
          group: a.student.group,
          isPresent: true,
          checkInTime: a.verifiedAt,
          distance: a.distanceMeters ?? null,
          city: a.studentCity ?? null,
        });
      }
    });

    return list.sort((a, b) => {
      if (a.isPresent && !b.isPresent) return -1;
      if (!a.isPresent && b.isPresent) return 1;
      if (a.isPresent && b.isPresent) {
        return (
          new Date(b.checkInTime || 0).getTime() - new Date(a.checkInTime || 0).getTime()
        );
      }
      return a.name.localeCompare(b.name);
    });
  }, [session]);

  const recentAttendees = useMemo(() => {
    if (!session?.attendance) return [];
    return session.attendance.map((a) => ({
      name: a.student?.name || 'Student',
      group: a.student?.group || '',
      checkInTime: a.verifiedAt,
    }));
  }, [session?.attendance]);

  const filteredRoster = useMemo(() => {
    return roster.filter((student) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        student.name.toLowerCase().includes(q) ||
        student.email.toLowerCase().includes(q);
      const matchesGroup = !groupFilter || student.group.trim() === groupFilter.trim();
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

  const enrolledCount = roster.length;
  const presentCount = roster.filter((r) => r.isPresent).length;
  const absentCount = Math.max(0, enrolledCount - presentCount);
  const remoteCount = roster.filter((r) => r.isPresent && (r.distance ?? 0) > 350).length;
  const attendanceRate =
    enrolledCount > 0 ? Math.round((presentCount / enrolledCount) * 100) : 0;

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
      if ((e.key === 'c' || e.key === 'C') && !isInput && qrData?.url) {
        e.preventDefault();
        copyPublicLink();
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
      <div aria-live="polite" className="sr-only">
        {ariaAnnouncement}
      </div>

      {/* Top Header */}
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

      {/* Summary Counters */}
      <SessionStats
        enrolledCount={enrolledCount}
        presentCount={presentCount}
        absentCount={absentCount}
        remoteCount={remoteCount}
        attendanceRate={attendanceRate}
      />

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <SessionRosterTable
          roster={roster}
          filteredRoster={filteredRoster}
          search={search}
          onSearchChange={setSearch}
          searchInputRef={searchInputRef}
          groupFilter={groupFilter}
          onGroupFilterChange={setGroupFilter}
          targetGroups={targetGroups}
          viewFilter={viewFilter}
          onViewFilterChange={setViewFilter}
          enrolledCount={enrolledCount}
          presentCount={presentCount}
          absentCount={absentCount}
          remoteCount={remoteCount}
          sseConnected={sseConnected}
          recentCheckedInIds={recentCheckedInIds}
          onOpenQr={() => setProjectionOpen(true)}
        />

        <div className="space-y-6">
          <SessionQRCodeCard
            qrData={qrData}
            onPresentFullscreen={() => setProjectionOpen(true)}
            onCopyLink={copyPublicLink}
            copiedLink={copiedLink}
            onReloadQr={() => {
              fetch(`/api/sessions/${id}/qr`)
                .then((r) => r.json())
                .then((d) => {
                  if (d?.qr) setQrData(d);
                })
                .catch(() => {});
            }}
            sessionStatus={session.status}
            targetGroups={targetGroups}
            enrolledCount={enrolledCount}
          />

          <SessionRejectedList unrecognized={session.unrecognized} />
        </div>
      </div>

      {/* Fullscreen Projector Modal */}
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
        recentAttendees={recentAttendees}
      />

      {/* Classroom GPS Calibration Modal */}
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

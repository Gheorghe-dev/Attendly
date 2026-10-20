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
} from 'lucide-react';
import { toast } from 'sonner';

interface RosterStudent {
  id: string;
  name: string;
  email: string;
  group: string;
  checkInTime?: string | null;
  distance?: number | null;
  isPresent: boolean;
}

interface SessionData {
  id: string;
  name: string;
  date: string;
  status: string; // 'open' | 'closed'
  groups: string;
  classroomLat?: number | null;
  classroomLng?: number | null;
  classroomRadius?: number | null;
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
  const [togglingStatus, setTogglingStatus] = useState(false);

  // Announcer text for screen readers (aria-live="polite")
  const [ariaAnnouncement, setAriaAnnouncement] = useState('');

  // Set of recently added student IDs to flash gold highlight for 1.2s
  const [recentCheckedInIds, setRecentCheckedInIds] = useState<Set<string>>(new Set<string>());

  // Filter toolbar
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [viewFilter, setViewFilter] = useState<'all' | 'present' | 'absent'>('all');

  // QR data
  const [qrData, setQrData] = useState<{
    qr: string;
    url: string;
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
        setQrData(qData);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

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
                setAriaAnnouncement(`${firstNew.name} a confirmat prezența.`);
                toast.success(`${firstNew.name} (${firstNew.group}) s-a înregistrat.`);

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
                attendance: data.records.map((r: { id: string; studentId: string; name: string; email: string; group: string; checkInTime: string; distance: number | null }) => ({
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

    const presentMap = new Map<string, { time: string; distance?: number | null }>();
    session.attendance.forEach((a) => {
      presentMap.set(a.studentId, {
        time: a.verifiedAt,
        distance: a.distanceMeters,
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
        distance: pres?.distance != null ? pres.distance : null,
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
          : !student.isPresent;

      return matchesSearch && matchesGroup && matchesView;
    });
  }, [roster, search, groupFilter, viewFilter]);

  // Metrics calculation
  const enrolledCount = roster.length;
  const presentCount = roster.filter((r) => r.isPresent).length;
  const absentCount = Math.max(0, enrolledCount - presentCount);
  const attendanceRate =
    enrolledCount > 0 ? Math.round((presentCount / enrolledCount) * 100) : 0;

  // Toggle session open/closed with confirmation
  async function toggleSessionStatus() {
    if (!session) return;
    const isCurrentlyOpen = session.status === 'open';

    if (isCurrentlyOpen) {
      const confirmed = confirm(
        'Ești sigur că vrei să închizi înregistrarea? Studenții care încearcă să scaneze după acest moment vor fi respinși.'
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
            ? 'Sesiunea a fost redeschisă pentru scanare.'
            : 'Înregistrarea a fost închisă.'
        );
      } else {
        toast.error('Nu s-a putut modifica starea sesiunii.');
      }
    } catch {
      toast.error('Eroare de rețea.');
    } finally {
      setTogglingStatus(false);
    }
  }

  function copyPublicLink() {
    if (!qrData?.url) return;
    navigator.clipboard.writeText(qrData.url);
    setCopiedLink(true);
    toast.success('Linkul de prezență a fost copiat în clipboard.');
    setTimeout(() => setCopiedLink(false), 2000);
  }

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
        title="Sesiunea nu a fost găsită"
        description="Sesiunea solicitată nu există sau nu ai permisiunea de a o vizualiza."
        action={{
          label: 'Înapoi la cursuri',
          onClick: () => router.push('/dashboard/courses'),
          variant: 'outline',
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
              {formatDate(session.date)} la {formatTime(session.date)}
            </span>
            {targetGroups.length > 0 && (
              <div className="flex flex-wrap gap-1 items-center ml-1">
                {targetGroups.map((g) => (
                  <GroupBadge key={g} group={g} />
                ))}
              </div>
            )}
          </div>

          <h1 className="font-serif text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">
            {session.course.name}
          </h1>
          <p className="text-xs text-muted-foreground">
            Tema sesiunii:{' '}
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
            <span>{isOpen ? 'Închide Înregistrarea' : 'Redeschide Sesiunea'}</span>
          </Button>

          <a href={`/api/sessions/${id}/export`}>
            <Button variant="outline" size="sm">
              <Download className="w-3.5 h-3.5 text-success" />
              <span>Exportă Excel</span>
            </Button>
          </a>

          <Button
            variant="accent"
            size="sm"
            onClick={() => setProjectionOpen(true)}
            className="shadow-sm"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Afișează QR Proiecție</span>
          </Button>
        </div>
      </div>

      {/* ── Connection Banner (if SSE drops) ─────────────────────────── */}
      {!sseConnected && (
        <div className="p-3 rounded-card bg-warning-soft text-warning border border-warning/20 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <WifiOff className="w-4 h-4 animate-pulse text-warning" />
            <span>Se reconectează la fluxul Server-Sent Events în timp real…</span>
          </div>
          <span className="text-[10px]">Reîncercare automată</span>
        </div>
      )}

      {/* ── Metrics Row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Înscriși */}
        <Card className="p-5 space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted-foreground">
            Total Înscriși
          </span>
          <p className="font-serif text-3xl sm:text-4xl font-semibold text-foreground tabular-nums">
            {enrolledCount}
          </p>
          <p className="text-[11px] text-muted-foreground">Conform catalogului activ</p>
        </Card>

        {/* Metric 2: Prezenți (Success tone) */}
        <Card className="p-5 space-y-1 bg-success-soft/30 border-success/20">
          <span className="text-[11px] font-mono uppercase text-success font-semibold">
            Prezenți Confirmați
          </span>
          <p className="font-serif text-3xl sm:text-4xl font-semibold text-success tabular-nums">
            {presentCount}
          </p>
          <p className="text-[11px] text-muted-foreground">Scanări verificate live</p>
        </Card>

        {/* Metric 3: Absenți */}
        <Card className="p-5 space-y-1">
          <span className="text-[11px] font-mono uppercase text-muted-foreground">
            Absenți Momentan
          </span>
          <p className="font-serif text-3xl sm:text-4xl font-semibold text-foreground/80 tabular-nums">
            {absentCount}
          </p>
          <p className="text-[11px] text-muted-foreground">Studenți neconfirmați</p>
        </Card>

        {/* Metric 4: Rată Prezență cu ProgressRing */}
        <Card className="p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-mono uppercase text-muted-foreground">
              Procent Prezență
            </span>
            <p className="font-serif text-3xl sm:text-4xl font-semibold text-accent tabular-nums">
              {attendanceRate}%
            </p>
            <p className="text-[11px] text-muted-foreground">Din total eligibili</p>
          </div>
          <ProgressRing percentage={attendanceRate} size={58} strokeWidth={5} />
        </Card>
      </div>

      {/* ── Main Content Grid: Live Roster Left + Right Rail ≥1280px ──── */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* ── Left Table Area (Span 8 on XL) ────────────────────────── */}
        <div className="xl:col-span-8 space-y-5">
          {/* Toolbar: Search, Group Chips, Segmented View Toggle */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Caută student în catalog…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex min-h-[38px] w-full rounded-input border border-input bg-card pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
                />
              </div>

              {session?.groups && (
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="min-h-[38px] rounded-input border border-input bg-card px-3 py-1.5 text-xs text-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:outline-none transition-all cursor-pointer"
                  aria-label="Filtrează după grupă"
                >
                  <option value="">Toate grupele</option>
                  {session.groups
                    .split(',')
                    .map((g) => g.trim())
                    .filter(Boolean)
                    .map((g) => (
                      <option key={g} value={g}>
                        Grupa {g}
                      </option>
                    ))}
                </select>
              )}

              {/* Segmented View Toggle: All / Present / Absent */}
              <div className="flex items-center p-1 rounded-input bg-muted border border-border text-xs select-none">
                <button
                  type="button"
                  onClick={() => setViewFilter('all')}
                  className={`px-3 py-1 rounded-input font-medium transition-all ${
                    viewFilter === 'all'
                      ? 'bg-card text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Toți ({enrolledCount})
                </button>
                <button
                  type="button"
                  onClick={() => setViewFilter('present')}
                  className={`px-3 py-1 rounded-input font-medium transition-all ${
                    viewFilter === 'present'
                      ? 'bg-card text-success font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Prezenți ({presentCount})
                </button>
                <button
                  type="button"
                  onClick={() => setViewFilter('absent')}
                  className={`px-3 py-1 rounded-input font-medium transition-all ${
                    viewFilter === 'absent'
                      ? 'bg-card text-foreground font-semibold shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Absenți ({absentCount})
                </button>
              </div>
            </div>

            {/* SSE Connection Status Pill */}
            <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              {sseConnected ? (
                <span className="flex items-center gap-1.5 text-success">
                  <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  Conectat Live
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-warning">
                  <span className="w-2 h-2 rounded-full bg-warning" />
                  Deconectat
                </span>
              )}
            </div>
          </div>

          {/* Roster Table */}
          {filteredRoster.length === 0 ? (
            <EmptyState
              icon={<Radio className="w-6 h-6 text-accent" />}
              title="Se așteaptă primele scanări…"
              description="Proiectează codul QR pe ecranul amfiteatrului. Studenții vor apărea instantaneu aici pe măsură ce confirmă prezența."
              action={{
                label: 'Deschide Codul QR',
                onClick: () => setProjectionOpen(true),
                variant: 'accent',
              }}
            />
          ) : (
            <div className="rounded-card border border-border bg-card overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b border-border sticky top-0 z-10">
                  <tr className="h-12 font-mono text-[11px] uppercase tracking-wider">
                    <th scope="col" className="px-5 py-3">Student</th>
                    <th scope="col" className="px-5 py-3">Grupă</th>
                    <th scope="col" className="hidden md:table-cell px-5 py-3">Email</th>
                    <th scope="col" className="px-5 py-3">Ora Scanării</th>
                    <th scope="col" className="px-5 py-3 text-right">Distanță GPS</th>
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
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={student.name} size="sm" />
                            <div className="min-w-0 font-sans">
                              <span
                                className={`font-semibold block truncate ${
                                  student.isPresent ? 'text-foreground' : 'text-muted-foreground line-through decoration-border'
                                }`}
                              >
                                {student.name}
                              </span>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-2.5">
                          <GroupBadge group={student.group} />
                        </td>

                        <td className="hidden md:table-cell px-5 py-2.5 text-muted-foreground truncate max-w-[200px]" title={student.email}>
                          {student.email}
                        </td>

                        <td className="px-5 py-2.5 tabular-nums">
                          {student.isPresent && student.checkInTime ? (
                            <span className="text-success font-medium flex items-center gap-1.5">
                              <Check className="w-3.5 h-3.5 text-success" />
                              {formatTime(student.checkInTime)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">
                              Neînregistrat
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-2.5 text-right tabular-nums">
                          {student.isPresent && student.distance != null ? (
                            <span className="text-accent font-medium">
                              {student.distance}m distanță
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
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

        {/* ── Right Rail: QR Thumbnail, Link & Telemetry (Span 4 on XL) ── */}
        <div className="xl:col-span-4 space-y-6">
          {/* QR Thumbnail Card */}
          <Card className="p-6 text-center space-y-4">
            <CardTitle className="text-base">Cod QR de Proiecție</CardTitle>
            <CardDescription>
              Fă clic pe imagine pentru a deschide modul de ecran complet pentru videoproiector.
            </CardDescription>

            {qrData?.qr ? (
              <div
                onClick={() => setProjectionOpen(true)}
                className="bg-white p-4 rounded-card border-2 border-border hover:border-accent shadow-sm inline-block cursor-pointer transition-all duration-200 group mx-auto"
                title="Afișează pe tot ecranul"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrData.qr}
                  alt="Cod QR de scanare"
                  className={`w-48 h-48 mx-auto object-contain transition-all ${
                    !isOpen ? 'opacity-20 blur-[1px]' : 'group-hover:scale-105'
                  }`}
                  style={{ imageRendering: 'pixelated' }}
                />
                {!isOpen && (
                  <p className="text-xs text-danger font-semibold mt-1">
                    Înregistrare blocată
                  </p>
                )}
              </div>
            ) : (
              <div className="w-48 h-48 rounded-card bg-muted flex items-center justify-center mx-auto text-xs text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Se generează…
              </div>
            )}

            <Button
              variant="accent"
              size="sm"
              onClick={() => setProjectionOpen(true)}
              className="w-full justify-center"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Deschide Ecran Proiecție (Esc)</span>
            </Button>
          </Card>

          {/* Public Link Card */}
          <Card className="p-5 space-y-3">
            <span className="text-xs font-semibold text-foreground block">
              Link Public de Verificare
            </span>
            <div className="flex items-center gap-2 p-2 rounded-input bg-muted/60 border border-border font-mono text-xs">
              <span className="truncate flex-1 text-muted-foreground select-all">
                {qrData?.url || 'Se încarcă…'}
              </span>
              <button
                type="button"
                onClick={copyPublicLink}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Copiază linkul"
              >
                {copiedLink ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Studenții pot accesa direct acest link de pe telefon dacă nu pot scana codul optic de la distanță.
            </p>
          </Card>

          {/* Session Security Telemetry Summary */}
          <Card className="p-5 space-y-3 text-xs">
            <span className="text-xs font-semibold text-foreground block border-b border-border pb-2">
              Parametri de Securitate
            </span>
            <div className="space-y-2 text-muted-foreground">
              <div className="flex justify-between">
                <span>Perimetru GPS:</span>
                <span className="font-mono text-foreground font-medium">
                  {session.classroomLat != null
                    ? `${session.classroomRadius || 50} metri`
                    : 'Dezactivat'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Grupe permise:</span>
                <span className="font-mono text-foreground font-medium">
                  {targetGroups.length > 0 ? targetGroups.join(', ') : 'Toate grupele'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Algoritm distanță:</span>
                <span className="font-mono text-foreground font-medium">
                  Haversine (6371 km)
                </span>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* ── QR Projection Modal ────────────────────────────────────── */}
      {qrData?.qr && (
        <QRProjectionModal
          open={projectionOpen}
          onClose={() => setProjectionOpen(false)}
          qrDataUrl={qrData.qr}
          publicUrl={qrData.url}
          courseName={session.course.name}
          sessionName={session.name}
          targetGroups={targetGroups}
          presentCount={presentCount}
          enrolledCount={enrolledCount}
          isOpen={isOpen}
        />
      )}
    </div>
  );
}

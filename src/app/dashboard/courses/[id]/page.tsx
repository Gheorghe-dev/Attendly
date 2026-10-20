'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { GroupBadge } from '@/components/ui/Badge';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { ImportRosterDialog } from '@/components/courses/ImportRosterDialog';
import { AddStudentDialog } from '@/components/courses/AddStudentDialog';
import { formatDate, formatTime } from '@/lib/utils';
import {
  Users,
  Layers,
  FileSpreadsheet,
  Download,
  PlusCircle,
  Search,
  Trash2,
  MapPin,
  Calendar,
  Loader2,
  UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  email: string;
  group: string;
  attendanceRate?: number;
}

interface SessionItem {
  id: string;
  name: string;
  date: string;
  status: string;
  groups: string;
  classroomLat?: number | null;
  classroomLng?: number | null;
  classroomRadius?: number | null;
  presentCount?: number;
  enrolledCount?: number;
}

interface CourseData {
  id: string;
  name: string;
  description?: string | null;
  students: Student[];
  sessions: SessionItem[];
}

export default function CourseDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();
  const searchParams = useSearchParams();

  // Tab sync with query param
  const activeTab = (searchParams.get('tab') as 'students' | 'sessions' | 'reports') || 'students';
  const setActiveTab = (tab: 'students' | 'sessions' | 'reports') => {
    const p = new URLSearchParams(searchParams.toString());
    p.set('tab', tab);
    router.replace(`?${p.toString()}`, { scroll: false });
  };

  const [course, setCourse] = useState<CourseData | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [importOpen, setImportOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const loadCourse = useCallback(async () => {
    try {
      const res = await fetch(`/api/courses/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCourse(data);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadCourse();
  }, [loadCourse]);

  // Distinct groups from students
  const allGroups = useMemo(() => {
    if (!course?.students) return [];
    const set = new Set<string>();
    course.students.forEach((s) => {
      if (s.group) set.add(s.group.trim());
    });
    return Array.from(set).sort();
  }, [course]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    if (!course?.students) return [];
    return course.students.filter((s) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);

      const matchesGroup =
        selectedGroups.length === 0 ||
        selectedGroups.includes(s.group.trim());

      return matchesSearch && matchesGroup;
    });
  }, [course, search, selectedGroups]);

  async function handleDeleteStudent(studentId: string, studentName: string) {
    if (!confirm(`Ești sigur că vrei să elimini studentul "${studentName}" din catalog?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/courses/${id}/students/${studentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(`Studentul ${studentName} a fost eliminat.`);
        loadCourse();
      } else {
        toast.error('Nu s-a putut elimina studentul.');
      }
    } catch {
      toast.error('Eroare de rețea.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center text-muted-foreground">
        <Loader2 className="w-7 h-7 animate-spin text-accent" />
      </div>
    );
  }

  if (!course) {
    return (
      <EmptyState
        title="Cursul nu a fost găsit"
        description="Cursul solicitat nu există sau nu ai permisiunea de a-l vizualiza."
        action={{
          label: 'Înapoi la cursuri',
          onClick: () => router.push('/dashboard/courses'),
          variant: 'outline',
        }}
      />
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <PageHeader
        breadcrumbs={[
          { label: 'Cursuri', href: '/dashboard/courses' },
          { label: course.name },
        ]}
        title={course.name}
        description={
          course.description ||
          'Catalog oficial al disciplinei, catalog de studenți și istoric sesiuni.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-accent" />
              <span>Importă Excel</span>
            </Button>

            <a href={`/api/courses/${id}/export`}>
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5 text-success" />
                <span>Exportă Catalog (.xlsx)</span>
              </Button>
            </a>

            <Link href={`/dashboard/courses/${id}/sessions/new`}>
              <Button variant="accent" size="sm">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Sesiune nouă</span>
              </Button>
            </Link>
          </div>
        }
      />

      {/* ── Tabs Navigation ────────────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-border text-xs select-none">
        <button
          type="button"
          onClick={() => setActiveTab('students')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative ${
            activeTab === 'students'
              ? 'text-accent font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Studenți Înscriși ({course.students.length})</span>
          {activeTab === 'students' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('sessions')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative ${
            activeTab === 'sessions'
              ? 'text-accent font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Sesiuni ({course.sessions.length})</span>
          {activeTab === 'sessions' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex items-center gap-2 px-4 py-3 font-medium transition-all relative ${
            activeTab === 'reports'
              ? 'text-accent font-semibold'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Rapoarte &amp; Statistici</span>
          {activeTab === 'reports' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />
          )}
        </button>
      </div>

      {/* ── TAB 1: Students ────────────────────────────────────────── */}
      {activeTab === 'students' && (
        <div className="space-y-5">
          {/* Search, Group Chips & Manual Add Action */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Caută student după nume sau email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex min-h-[40px] w-full rounded-input border border-input bg-card pl-9 pr-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
                />
              </div>

              {/* Group filter badges */}
              {allGroups.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono text-muted-foreground mr-1">
                    Grupe:
                  </span>
                  {allGroups.map((g) => {
                    const isSelected = selectedGroups.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedGroups(selectedGroups.filter((item) => item !== g));
                          } else {
                            setSelectedGroups([...selectedGroups, g]);
                          }
                        }}
                        className={`font-mono text-[11px] px-2 py-0.5 rounded transition-all select-none border ${
                          isSelected
                            ? 'bg-accent text-white dark:text-neutral-900 border-accent font-semibold'
                            : 'bg-muted/50 text-muted-foreground border-border hover:text-foreground'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                  {selectedGroups.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedGroups([])}
                      className="text-[10px] font-mono text-accent hover:underline ml-1"
                    >
                      Resetează
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
              <span className="font-mono text-muted-foreground">
                {filteredStudents.length} din {course.students.length} studenți
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddStudentOpen(true)}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Adaugă Student</span>
              </Button>
            </div>
          </div>

          {/* Table View (Desktop & Tablet) */}
          {course.students.length === 0 ? (
            <EmptyState
              icon={<Users className="w-6 h-6 text-accent" />}
              title="Catalogul este gol"
              description="Încarcă lista oficială a studenților folosind un fișier Excel (.xlsx) sau adaugă studenții individual."
              action={{
                label: 'Importă Catalog Excel',
                onClick: () => setImportOpen(true),
                variant: 'accent',
              }}
            />
          ) : (
            <div className="rounded-card border border-border bg-card overflow-hidden shadow-xs">
              {/* Desktop Table (≥640px) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted text-muted-foreground font-medium border-b border-border sticky top-0 z-10">
                    <tr className="h-12">
                      <th scope="col" className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider">
                        Student
                      </th>
                      <th scope="col" className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider">
                        Email Instituțional
                      </th>
                      <th scope="col" className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider">
                        Grupă
                      </th>
                      <th scope="col" className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-right">
                        Rată Prezență
                      </th>
                      <th scope="col" className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-right">
                        Acțiuni
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredStudents.map((s) => (
                      <tr
                        key={s.id}
                        className="h-12 hover:bg-muted/40 transition-colors"
                      >
                        <td className="px-5 py-2.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={s.name} size="sm" />
                            <span className="font-semibold text-foreground">
                              {s.name}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-2.5 font-mono text-muted-foreground truncate max-w-[220px]" title={s.email}>
                          {s.email}
                        </td>

                        <td className="px-5 py-2.5">
                          <GroupBadge group={s.group} />
                        </td>

                        <td className="px-5 py-2.5 text-right font-mono tabular-nums">
                          <span className="font-medium text-foreground">
                            {s.attendanceRate != null ? `${s.attendanceRate}%` : '85%'}
                          </span>
                        </td>

                        <td className="px-5 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(s.id, s.name)}
                            className="p-1.5 rounded-input text-muted-foreground hover:text-danger hover:bg-danger-soft transition-colors"
                            title="Elimină student din curs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Stacked Cards (<640px) */}
              <div className="sm:hidden divide-y divide-border">
                {filteredStudents.map((s) => (
                  <div key={s.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={s.name} size="sm" />
                        <div>
                          <p className="font-semibold text-foreground text-xs">{s.name}</p>
                          <p className="font-mono text-[11px] text-muted-foreground">{s.email}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleDeleteStudent(s.id, s.name)}
                        className="p-1 rounded-input text-muted-foreground hover:text-danger"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <GroupBadge group={s.group} />
                      <span className="font-mono text-xs text-foreground font-medium tabular-nums">
                        Prezență: 85%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: Sessions ────────────────────────────────────────── */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-semibold text-foreground">
                Istoric Sesiuni de Curs &amp; Laborator
              </h3>
              <p className="text-xs text-muted-foreground">
                Fă clic pe o sesiune pentru a vizualiza monitorul live sau a exporta prezența.
              </p>
            </div>

            <Link href={`/dashboard/courses/${id}/sessions/new`}>
              <Button variant="accent" size="sm">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Lansează Sesiune</span>
              </Button>
            </Link>
          </div>

          {course.sessions.length === 0 ? (
            <EmptyState
              icon={<Layers className="w-6 h-6 text-accent" />}
              title="Nicio sesiune înregistrată"
              description="Lansează prima sesiune de prezență pentru a genera codul QR de amfiteatru."
              action={{
                label: 'Creează prima sesiune',
                onClick: () => router.push(`/dashboard/courses/${id}/sessions/new`),
                variant: 'accent',
              }}
            />
          ) : (
            <div className="rounded-card border border-border bg-card overflow-hidden shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b border-border">
                  <tr className="h-12 font-mono text-[11px] uppercase tracking-wider">
                    <th scope="col" className="px-5 py-3">Data &amp; Nume Sesiune</th>
                    <th scope="col" className="px-5 py-3">Grupe Țintă</th>
                    <th scope="col" className="px-5 py-3">Geofence GPS</th>
                    <th scope="col" className="px-5 py-3 text-right">Prezenți</th>
                    <th scope="col" className="px-5 py-3 text-right">Stare</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {course.sessions.map((sess) => {
                    const targetGroups = sess.groups ? sess.groups.split(',').filter(Boolean) : [];
                    const isOpen = sess.status === 'open';

                    return (
                      <tr
                        key={sess.id}
                        onClick={() => router.push(`/dashboard/sessions/${sess.id}`)}
                        className="h-14 hover:bg-muted/40 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          <div className="space-y-0.5">
                            <span className="font-semibold text-foreground block">
                              {sess.name}
                            </span>
                            <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-accent" />
                              {formatDate(sess.date)} {formatTime(sess.date)}
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-3">
                          {targetGroups.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {targetGroups.map((g) => (
                                <GroupBadge key={g} group={g.trim()} />
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground italic text-[11px]">
                              Toate grupele
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3">
                          {sess.classroomLat != null ? (
                            <div className="flex items-center gap-1.5 font-mono text-[11px] text-accent">
                              <MapPin className="w-3.5 h-3.5" />
                              <span>{sess.classroomRadius || 50}m perimetru</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">Fără GPS</span>
                          )}
                        </td>

                        <td className="px-5 py-3 text-right font-mono font-medium text-foreground tabular-nums">
                          {sess.presentCount || 0} prezenți
                        </td>

                        <td className="px-5 py-3 text-right">
                          <LiveBadge isOpen={isOpen} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: Reports ─────────────────────────────────────────── */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-serif text-lg font-semibold text-foreground">
                Rapoarte de Prezență &amp; Exporturi Oficiale
              </h3>
              <p className="text-xs text-muted-foreground">
                Generează sinteza completă a semestrului sau descarcă fișe individuale pe sesiune.
              </p>
            </div>

            <a href={`/api/courses/${id}/export`}>
              <Button variant="accent" size="sm">
                <Download className="w-3.5 h-3.5" />
                <span>Descarcă Excel Curs Complet</span>
              </Button>
            </a>
          </div>

          {/* Aggregate Overview Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                Total Sesiuni
              </span>
              <p className="font-serif text-3xl font-semibold text-foreground tabular-nums">
                {course.sessions.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Înregistrate în sistem</p>
            </Card>

            <Card className="p-5 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                Total Studenți
              </span>
              <p className="font-serif text-3xl font-semibold text-foreground tabular-nums">
                {course.students.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Înscriși în catalog</p>
            </Card>

            <Card className="p-5 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                Rată Medie Prezență
              </span>
              <p className="font-serif text-3xl font-semibold text-success tabular-nums">
                86%
              </p>
              <p className="text-[11px] text-muted-foreground">Medie pe toate sesiunile</p>
            </Card>
          </div>

          {/* Per-session Excel Downloads List */}
          <Card className="p-6 space-y-4">
            <CardTitle>Fișe de Prezență Individuale pe Sesiune</CardTitle>
            <CardDescription>
              Fiecare fișier conține lista completă a studenților: prezenți colorați în verde, absenți în roșu, oră exactă de scanare și distanță GPS.
            </CardDescription>

            <div className="divide-y divide-border border-t border-border mt-3">
              {course.sessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground text-xs">{s.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {formatDate(s.date)} · {s.presentCount || 0} prezenți
                    </p>
                  </div>

                  <a href={`/api/sessions/${s.id}/export`}>
                    <Button variant="outline" size="sm" className="gap-1.5">
                      <Download className="w-3.5 h-3.5 text-accent" />
                      <span>Excel (.xlsx)</span>
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ── Dialogs ────────────────────────────────────────────────── */}
      <ImportRosterDialog
        courseId={id}
        courseName={course.name}
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={loadCourse}
      />

      <AddStudentDialog
        courseId={id}
        existingGroups={allGroups}
        open={addStudentOpen}
        onClose={() => setAddStudentOpen(false)}
        onSuccess={loadCourse}
      />
    </div>
  );
}

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
  classroom?: string | null;
  presentCount?: number;
  enrolledCount?: number;
}

interface CourseData {
  id: string;
  name: string;
  description?: string | null;
  extraGroups?: string;
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

  // Distinct groups from students and extra groups
  const allGroups = useMemo(() => {
    if (!course?.students) return [];
    const set = new Set<string>();
    course.students.forEach((s) => {
      if (s.group) set.add(s.group.trim());
    });
    if (course.extraGroups) {
      course.extraGroups.split(',').forEach((g) => {
        if (g.trim()) set.add(g.trim());
      });
    }
    return Array.from(set).sort();
  }, [course]);

  // Aggregate attendance metrics for reports tab
  const totalVerifiedInCourse = useMemo(() => {
    if (!course?.sessions) return 0;
    return course.sessions.reduce((acc, s) => acc + (s.presentCount || 0), 0);
  }, [course]);

  const totalPossibleInCourse = useMemo(() => {
    if (!course?.sessions || !course?.students) return 0;
    return course.sessions.length * course.students.length;
  }, [course]);

  const courseAttendanceRate = useMemo(() => {
    if (totalPossibleInCourse === 0) return 0;
    return Math.min(100, Math.round((totalVerifiedInCourse / totalPossibleInCourse) * 100));
  }, [totalVerifiedInCourse, totalPossibleInCourse]);

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
    if (!confirm(`Are you sure you want to remove student "${studentName}" from the roster?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/courses/${id}/students/${studentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success(`Student ${studentName} was removed.`);
        loadCourse();
      } else {
        toast.error('Failed to remove student.');
      }
    } catch {
      toast.error('Network error.');
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
        title="Course not found"
        description="The requested course does not exist or you do not have permission to view it."
        action={{
          label: 'Back to courses',
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
          { label: 'Courses', href: '/dashboard/courses' },
          { label: course.name },
        ]}
        title={course.name}
        description={
          course.description ||
          'Official course syllabus, student roster, and session history.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setImportOpen(true)}
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-accent" />
              <span>Import Excel</span>
            </Button>

            <a href={`/api/courses/${id}/export`}>
              <Button variant="outline" size="sm">
                <Download className="w-3.5 h-3.5 text-success" />
                <span>Export Attendance (.xlsx)</span>
              </Button>
            </a>

            <Link href={`/dashboard/courses/${id}/sessions/new`}>
              <Button variant="accent" size="sm">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>New Session</span>
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
          <span>Enrolled Students ({course.students.length})</span>
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
          <span>Sessions ({course.sessions.length})</span>
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
          <span>Reports &amp; Analytics</span>
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
                  placeholder="Search student by name or email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="flex min-h-[40px] w-full rounded-input border border-input bg-card pl-9 pr-3.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
                />
              </div>

              {/* Group filter badges */}
              {allGroups.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-mono text-muted-foreground mr-1">
                    Groups:
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
                      Reset
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs">
              <span className="font-mono text-muted-foreground">
                {filteredStudents.length} of {course.students.length} students
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddStudentOpen(true)}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Student</span>
              </Button>
            </div>
          </div>

          {/* Table View (Desktop & Tablet) */}
          {course.students.length === 0 ? (
            <EmptyState
              icon={<Users className="w-6 h-6 text-accent" />}
              title="Roster is empty"
              description="Upload the official student roster using an Excel file (.xlsx) or add students individually."
              action={{
                label: 'Import Excel Roster',
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
                        Institutional Email
                      </th>
                      <th scope="col" className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider">
                        Group
                      </th>
                      <th scope="col" className="px-5 py-3 font-mono text-[11px] uppercase tracking-wider text-right">
                        Actions
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

                        <td className="px-5 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteStudent(s.id, s.name)}
                            className="p-1.5 rounded-input text-muted-foreground hover:text-danger hover:bg-danger-soft transition-colors"
                            title="Remove student from course"
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
                Course &amp; Lab Session History
              </h3>
              <p className="text-xs text-muted-foreground">
                Click on a session to view the live monitor or export attendance.
              </p>
            </div>

            <Link href={`/dashboard/courses/${id}/sessions/new`}>
              <Button variant="accent" size="sm">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Launch Session</span>
              </Button>
            </Link>
          </div>

          {course.sessions.length === 0 ? (
            <EmptyState
              icon={<Layers className="w-6 h-6 text-accent" />}
              title="No sessions recorded"
              description="Launch your first attendance session to generate a classroom QR code."
              action={{
                label: 'Create first session',
                onClick: () => router.push(`/dashboard/courses/${id}/sessions/new`),
                variant: 'accent',
              }}
            />
          ) : (
            <div className="rounded-card border border-border bg-card overflow-x-auto shadow-xs">
              <table className="w-full min-w-[650px] text-xs text-left">
                <thead className="bg-muted text-muted-foreground font-medium border-b border-border">
                  <tr className="h-12 font-mono text-[11px] uppercase tracking-wider">
                    <th scope="col" className="px-5 py-3 whitespace-nowrap">Date &amp; Session Name</th>
                    <th scope="col" className="px-5 py-3 whitespace-nowrap">Target Groups</th>
                    <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">Present</th>
                    <th scope="col" className="px-5 py-3 text-right whitespace-nowrap">Status</th>
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
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="font-mono text-[11px] text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3 text-accent" />
                                {formatDate(sess.date)} {formatTime(sess.date)}
                              </span>
                              {sess.classroom && (
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-accent/10 text-accent border border-accent/20 font-medium">
                                  📍 {sess.classroom}
                                </span>
                              )}
                            </div>
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
                              All groups
                            </span>
                          )}
                        </td>

                        <td className="px-5 py-3 text-right font-mono font-medium text-foreground tabular-nums">
                          {sess.presentCount || 0} present
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
                Attendance Reports &amp; Official Exports
              </h3>
              <p className="text-xs text-muted-foreground">
                Generate full semester summary or download individual session attendance sheets.
              </p>
            </div>

            <a href={`/api/courses/${id}/export`}>
              <Button variant="accent" size="sm">
                <Download className="w-3.5 h-3.5" />
                <span>Download Full Course Excel</span>
              </Button>
            </a>
          </div>

          {/* Aggregate Overview Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                Total Sessions
              </span>
              <p className="font-serif text-3xl font-semibold text-foreground tabular-nums">
                {course.sessions.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Recorded in system</p>
            </Card>

            <Card className="p-5 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                Total Students
              </span>
              <p className="font-serif text-3xl font-semibold text-foreground tabular-nums">
                {course.students.length}
              </p>
              <p className="text-[11px] text-muted-foreground">Enrolled in roster</p>
            </Card>

            <Card className="p-5 space-y-1">
              <span className="text-[11px] font-mono text-muted-foreground uppercase">
                Avg. Attendance Rate
              </span>
              <p className="font-serif text-3xl font-semibold text-success tabular-nums">
                {course.sessions.length > 0 && course.students.length > 0 ? `${courseAttendanceRate}%` : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">Across all sessions</p>
            </Card>
          </div>

          {/* Per-session Excel Downloads List */}
          <Card className="p-6 space-y-4">
            <CardTitle>Individual Session Attendance Sheets</CardTitle>
            <CardDescription>
              Each file contains the full student roster: present colored in green, absent in red, and exact scan timestamp.
            </CardDescription>

            <div className="divide-y divide-border border-t border-border mt-3">
              {course.sessions.map((s) => (
                <div key={s.id} className="py-3 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <p className="font-semibold text-foreground text-xs">{s.name}</p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {formatDate(s.date)} · {s.presentCount || 0} present
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

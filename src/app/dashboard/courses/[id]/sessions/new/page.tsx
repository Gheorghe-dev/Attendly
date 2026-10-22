'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MultiSelectChips } from '@/components/ui/MultiSelectChips';
import {
  Radio,
  AlertTriangle,
  Calendar,
  MapPin,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PRESET_CLASSROOMS, DEFAULT_CLASSROOM, slugifyClassroom } from '@/lib/classroom';

interface CourseBasic {
  id: string;
  name: string;
  extraGroups?: string;
  students: Array<{ group: string }>;
  _count?: { sessions: number };
}

export default function CreateSessionPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseBasic | null>(null);
  const [name, setName] = useState('');
  const [classroom, setClassroom] = useState<string>(DEFAULT_CLASSROOM);
  const [date, setDate] = useState('');
  const [allGroups, setAllGroups] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Default date to now
  useEffect(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    setDate(local.toISOString().slice(0, 16));
  }, []);

  // Fetch course info
  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((c: CourseBasic) => {
        setCourse(c);
        const studentGroups = (c.students || []).map((s) => s.group);
        const extraGroups = (c.extraGroups || '').split(',').map((g: string) => g.trim()).filter(Boolean);
        const gs = Array.from(new Set([...studentGroups, ...extraGroups])).sort();
        setAllGroups(gs);
        setSelectedGroups(gs); // default to all groups
        setName(`Lecture ${(c._count?.sessions || 0) + 1}`);
      });
  }, [courseId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          name: name.trim(),
          classroom: classroom.trim() || DEFAULT_CLASSROOM,
          date,
          groups: selectedGroups,
          status: 'open',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create session.');
        return;
      }

      toast.success(`Session "${name}" created successfully!`);
      router.push(`/dashboard/sessions/${data.id}`);
    } catch {
      setError('Server connection error.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader
        title="Launch Attendance Session"
        description={`Configure QR attendance session for ${course?.name || 'course'}.`}
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Courses', href: '/dashboard/courses' },
          { label: course?.name || 'Course', href: `/dashboard/courses/${courseId}` },
          { label: 'New Session' },
        ]}
      />

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-input bg-danger-soft text-danger border border-danger/20 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-2.5 pb-3 border-b border-border">
            <div className="w-8 h-8 rounded-input bg-accent-soft text-accent flex items-center justify-center border border-accent/20">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base">Session Details</CardTitle>
              <CardDescription>
                Title, scheduled lecture time, and target student groups.
              </CardDescription>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              label="Session title / lecture"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lecture 1: Introduction & Architecture"
              helperText="Descriptive title displayed on the projection screen and student devices."
            />

            {/* Classroom / Lecture Hall Selection */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-medium text-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-accent" />
                  <span>Classroom / Lecture Hall</span>
                </label>
                <span className="text-[11px] font-mono text-muted-foreground">
                  Bound to predefined room URL
                </span>
              </div>

              <Input
                value={classroom}
                onChange={(e) => setClassroom(e.target.value)}
                placeholder="e.g. Room 101, Auditorium A1, Lab 204"
                required
              />

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] font-mono text-muted-foreground mr-1">
                  Presets:
                </span>
                {PRESET_CLASSROOMS.map((preset) => {
                  const isActive = classroom.trim().toLowerCase() === preset.toLowerCase();
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setClassroom(preset)}
                      className={`text-xs px-2.5 py-1 rounded-full font-mono transition-all border ${
                        isActive
                          ? 'bg-accent text-accent-foreground border-accent font-semibold shadow-xs'
                          : 'bg-card text-muted-foreground border-border hover:border-accent/40 hover:text-foreground'
                      }`}
                    >
                      {preset}
                    </button>
                  );
                })}
              </div>

              {/* Predefined Room Link Live Preview */}
              <div className="p-3 rounded-input bg-accent/5 border border-accent/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Link2 className="w-4 h-4 text-accent flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] font-mono text-muted-foreground">
                      Predefined Student Attendance URL:
                    </p>
                    <p className="text-xs font-mono font-semibold text-accent truncate">
                      /attend/{slugifyClassroom(classroom)}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center self-start sm:self-auto px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-accent/15 text-accent border border-accent/30 whitespace-nowrap">
                  Room-bound URL
                </span>
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-medium text-foreground">
                Date and time
              </label>
              <input
                type="datetime-local"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
              />
            </div>

            {allGroups.length > 0 && (
              <div className="space-y-2 pt-1">
                <MultiSelectChips
                  label="Target student groups"
                  options={allGroups}
                  selected={selectedGroups}
                  onChange={setSelectedGroups}
                  helperText="Only students belonging to these groups will be permitted to confirm attendance."
                />
              </div>
            )}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/dashboard/courses/${courseId}`}>
            <Button variant="outline" size="md">
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            variant="accent"
            size="md"
            loading={loading}
            className="shadow-md"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Create Session</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

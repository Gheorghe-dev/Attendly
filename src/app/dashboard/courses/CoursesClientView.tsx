'use client';

import React, { useState, useMemo } from 'react';
import { CourseCard, CourseCardProps } from '@/components/dashboard/CourseCard';
import { CreateCourseDialog } from '@/components/dashboard/CreateCourseDialog';
import { Input } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { BookOpen, Search, Users, Layers, GraduationCap, X } from 'lucide-react';

interface CoursesClientViewProps {
  initialCourses: CourseCardProps[];
}

export function CoursesClientView({ initialCourses }: CoursesClientViewProps) {
  const [search, setSearch] = useState('');

  const filteredCourses = useMemo(() => {
    if (!search.trim()) return initialCourses;
    const q = search.toLowerCase();
    return initialCourses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [initialCourses, search]);

  const totalStudents = useMemo(
    () => initialCourses.reduce((sum, c) => sum + c.studentCount, 0),
    [initialCourses]
  );

  const totalSessions = useMemo(
    () => initialCourses.reduce((sum, c) => sum + c.sessionCount, 0),
    [initialCourses]
  );

  if (initialCourses.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen className="w-6 h-6" />}
        title="No courses configured"
        description="Create your first course to import student rosters from Excel and launch QR attendance sessions."
        action={<CreateCourseDialog />}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Metrics Row & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Search by course title..."
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

        {/* Quick summary pills */}
        <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground overflow-x-auto pb-1 md:pb-0">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-card border border-border">
            <GraduationCap className="w-3.5 h-3.5 text-accent" />
            <span className="font-semibold text-foreground tabular-nums">
              {initialCourses.length}
            </span>
            <span>courses</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-card border border-border">
            <Users className="w-3.5 h-3.5 text-info" />
            <span className="font-semibold text-foreground tabular-nums">
              {totalStudents}
            </span>
            <span>total students</span>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-input bg-card border border-border">
            <Layers className="w-3.5 h-3.5 text-success" />
            <span className="font-semibold text-foreground tabular-nums">
              {totalSessions}
            </span>
            <span>sessions conducted</span>
          </div>
        </div>
      </div>

      {/* Grid or Empty Search */}
      {filteredCourses.length === 0 ? (
        <div className="text-center py-12 px-4 rounded-card border border-dashed border-border bg-card/40">
          <BookOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
          <p className="font-serif text-base font-semibold text-foreground">
            No courses found
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            No courses match your search &ldquo;{search}&rdquo;. Try different keywords or clear the filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} {...course} />
          ))}
        </div>
      )}
    </div>
  );
}

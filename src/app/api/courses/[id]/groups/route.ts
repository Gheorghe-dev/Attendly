import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const clean = (s: string) => (typeof s === 'string' ? s.trim() : '');
const isValidGroupName = (s: string) =>
  s.length > 0 && s.length <= 100 && !s.includes(',') && !s.includes('\n');

async function getExtras(courseId: string): Promise<string[]> {
  const c = await prisma.course.findUnique({
    where: { id: courseId },
    select: { extraGroups: true },
  });
  return (c?.extraGroups || '').split(',').map(clean).filter(Boolean);
}

async function setExtras(courseId: string, groups: string[]) {
  const uniq = Array.from(new Set(groups.map(clean).filter(isValidGroupName)));
  await prisma.course.update({
    where: { id: courseId },
    data: { extraGroups: uniq.join(',') },
  });
}

async function rewriteSessionGroups(courseId: string, from: string, to: string) {
  const sessions = await prisma.session.findMany({
    where: { courseId },
    select: { id: true, groups: true },
  });
  for (const s of sessions) {
    const groups = s.groups.split(',').map((g) => clean(g));
    if (groups.includes(from)) {
      const merged: string[] = [];
      const seen = new Set<string>();
      for (const g of groups) {
        const repl = g === from ? to : g;
        if (!seen.has(repl)) {
          merged.push(repl);
          seen.add(repl);
        }
      }
      const updated = merged.join(',');
      if (updated !== s.groups) {
        await prisma.session.update({ where: { id: s.id }, data: { groups: updated } });
      }
    }
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const course = await prisma.course.findFirst({
    where: { id: params.id, professorId: session.user.id },
  });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const [studentGroups, counts, extras] = await Promise.all([
    prisma.student.findMany({
      where: { courseId: params.id },
      select: { group: true },
      distinct: ['group'],
    }),
    prisma.student.groupBy({
      by: ['group'],
      where: { courseId: params.id },
      _count: { _all: true },
    }),
    getExtras(params.id),
  ]);

  const studentGroupSet = new Set(studentGroups.map((r) => r.group));
  const countMap = new Map(counts.map((c) => [c.group, c._count._all]));
  const all = Array.from(new Set([...studentGroupSet, ...extras])).sort();

  return NextResponse.json({
    groups: all.map((name) => ({
      name,
      studentCount: countMap.get(name) || 0,
      isExtra: !studentGroupSet.has(name),
    })),
  });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const course = await prisma.course.findFirst({
    where: { id: params.id, professorId: session.user.id },
  });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { action?: string };
  const action = body.action;

  if (action === 'rename') {
    const from = clean((body as { from?: string }).from || '');
    const to = clean((body as { to?: string }).to || '');
    if (!isValidGroupName(to)) {
      return NextResponse.json(
        { error: 'Invalid name (cannot be empty, longer than 100 chars, or contain commas)' },
        { status: 400 }
      );
    }
    if (from === to) return NextResponse.json({ success: true, noChange: true });

    const studentGroups = await prisma.student.findMany({
      where: { courseId: params.id },
      select: { group: true },
      distinct: ['group'],
    });
    const extras = await getExtras(params.id);
    const all = new Set([...studentGroups.map((r) => r.group), ...extras]);
    if (!all.has(from)) return NextResponse.json({ error: `Group "${from}" not found` }, { status: 404 });
    if (all.has(to)) return NextResponse.json({ error: `Group "${to}" already exists` }, { status: 409 });

    const updated = await prisma.student.updateMany({
      where: { courseId: params.id, group: from },
      data: { group: to },
    });

    await rewriteSessionGroups(params.id, from, to);

    if (extras.includes(from)) {
      await setExtras(params.id, extras.filter((g) => g !== from));
    }

    return NextResponse.json({ success: true, studentsRenamed: updated.count });
  }

  if (action === 'add') {
    const g = clean((body as { group?: string }).group || '');
    if (!isValidGroupName(g)) {
      return NextResponse.json(
        { error: 'Invalid name (cannot be empty, longer than 100 chars, or contain commas)' },
        { status: 400 }
      );
    }
    const studentGroups = await prisma.student.findMany({
      where: { courseId: params.id },
      select: { group: true },
      distinct: ['group'],
    });
    const extras = await getExtras(params.id);
    const all = new Set([...studentGroups.map((r) => r.group), ...extras]);
    if (all.has(g)) return NextResponse.json({ error: `Group "${g}" already exists` }, { status: 409 });

    await setExtras(params.id, [...extras, g]);
    return NextResponse.json({ success: true });
  }

  if (action === 'remove') {
    const g = clean((body as { group?: string }).group || '');
    if (!g) return NextResponse.json({ error: 'Missing group' }, { status: 400 });

    const studentCount = await prisma.student.count({
      where: { courseId: params.id, group: g },
    });
    if (studentCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot remove "${g}" - ${studentCount} student(s) still assigned. Use Merge to move them first.`,
        },
        { status: 409 }
      );
    }
    const extras = await getExtras(params.id);
    if (!extras.includes(g)) {
      return NextResponse.json({ error: `Group "${g}" not found` }, { status: 404 });
    }
    await setExtras(params.id, extras.filter((x) => x !== g));
    return NextResponse.json({ success: true });
  }

  if (action === 'merge') {
    const from = clean((body as { from?: string }).from || '');
    const to = clean((body as { to?: string }).to || '');
    if (!from || !to) return NextResponse.json({ error: 'Source and target required' }, { status: 400 });
    if (from === to) return NextResponse.json({ error: 'Source and target cannot be identical' }, { status: 400 });
    if (!isValidGroupName(to)) {
      return NextResponse.json(
        { error: 'Invalid target name (cannot be empty, longer than 100 chars, or contain commas)' },
        { status: 400 }
      );
    }

    const studentGroups = await prisma.student.findMany({
      where: { courseId: params.id },
      select: { group: true },
      distinct: ['group'],
    });
    const extras = await getExtras(params.id);
    const all = new Set([...studentGroups.map((r) => r.group), ...extras]);
    if (!all.has(from)) return NextResponse.json({ error: `Group "${from}" not found` }, { status: 404 });

    const moved = await prisma.student.updateMany({
      where: { courseId: params.id, group: from },
      data: { group: to },
    });

    await rewriteSessionGroups(params.id, from, to);

    let nextExtras = extras;
    if (extras.includes(from)) nextExtras = nextExtras.filter((g) => g !== from);
    if (extras.includes(to)) nextExtras = nextExtras.filter((g) => g !== to);
    await setExtras(params.id, nextExtras);

    return NextResponse.json({ success: true, studentsMoved: moved.count });
  }

  return NextResponse.json({ error: `Unknown action "${action}"` }, { status: 400 });
}

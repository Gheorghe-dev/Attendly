import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { parseStudentExcel } from '@/lib/excel';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const course = await prisma.course.findFirst({ where: { id: params.id, professorId: session.user.id } });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const students = await prisma.student.findMany({
    where: { courseId: params.id },
    orderBy: [{ group: 'asc' }, { name: 'asc' }],
  });
  return NextResponse.json(students);
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const course = await prisma.course.findFirst({ where: { id: params.id, professorId: session.user.id } });
  if (!course) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File;
  const replace = formData.get('replace') === 'true';

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!file.name.endsWith('.xlsx')) return NextResponse.json({ error: 'Only .xlsx files are supported' }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseStudentExcel(buffer);
    const preview = formData.get('preview') === 'true';
    if (preview) {
      return NextResponse.json({ validation: parsed });
    }
    // Commit
    if (replace) {
      await prisma.student.deleteMany({ where: { courseId: params.id } });
    }
    let imported = 0;
    let skipped = 0;
    for (const s of parsed.valid) {
      try {
        await prisma.student.upsert({
          where: { email_courseId: { email: s.email, courseId: params.id } },
          update: { name: s.name, group: s.group },
          create: { name: s.name, email: s.email, group: s.group, courseId: params.id },
        });
        imported++;
      } catch {
        skipped++;
      }
    }
    return NextResponse.json({
      imported,
      skipped,
      errors: parsed.errors,
      duplicates: parsed.duplicates,
      total: parsed.valid.length,
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

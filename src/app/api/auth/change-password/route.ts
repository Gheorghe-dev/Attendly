import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    currentPassword?: string;
    newPassword?: string;
  };
  const currentPassword = body.currentPassword ?? '';
  const newPassword = body.newPassword ?? '';

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'New password must be at least 8 characters.' }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'New password must differ from the current one.' }, { status: 400 });
  }

  const professor = await prisma.professor.findUnique({ where: { id: session.user.id } });
  if (!professor) return NextResponse.json({ error: 'Account not found.' }, { status: 404 });

  const matches = await bcrypt.compare(currentPassword, professor.passwordHash);
  if (!matches) return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 403 });

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.professor.update({
    where: { id: professor.id },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isSmtpConfigured } from '@/lib/email';

export const dynamic = 'force-dynamic';

export async function GET() {
  const startedAt = Date.now();
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }
  return NextResponse.json(
    {
      ok: dbOk,
      service: 'qr-attendance',
      db: dbOk ? 'ok' : 'down',
      email: isSmtpConfigured() ? 'smtp' : 'dev-mode',
      uptimeMs: Date.now() - startedAt,
    },
    { status: dbOk ? 200 : 503 }
  );
}

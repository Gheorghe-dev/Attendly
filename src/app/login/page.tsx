import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureDatabaseSchema } from '@/lib/db-init';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  const session = await auth().catch(() => null);

  if (session?.user) {
    redirect('/dashboard');
  }

  try {
    await ensureDatabaseSchema(prisma);
  } catch {}

  const count = await prisma.professor.count().catch(() => 0);
  if (count === 0) {
    redirect('/setup');
  }

  return <LoginForm />;
}

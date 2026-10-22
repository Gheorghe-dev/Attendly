import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/dashboard');
  }

  const count = await prisma.professor.count();
  if (count === 0) {
    redirect('/setup');
  }

  redirect('/login');
}

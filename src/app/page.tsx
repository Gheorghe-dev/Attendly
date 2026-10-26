import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureDatabaseSchema } from '@/lib/db-init';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function RootPage() {
  try {
    const session = await auth();
    if (session?.user) {
      redirect('/dashboard');
    }
  } catch (e) {
    // Allow Next.js internal redirects to pass through
    if ((e as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) {
      throw e;
    }
  }

  try {
    await ensureDatabaseSchema(prisma);
    const count = await prisma.professor.count();
    if (count === 0) {
      redirect('/setup');
    }
  } catch (error) {
    if ((error as { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) {
      throw error;
    }
    console.warn('[RootPage] Database initialization notice, redirecting to /setup:', (error as Error).message);
    redirect('/setup');
  }

  redirect('/login');
}

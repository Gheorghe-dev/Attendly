import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import Link from 'next/link';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { SessionsClientView, SessionItem } from './SessionsClientView';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SessionsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const sessions = await prisma.session.findMany({
    where: { course: { professorId: session.user.id } },
    include: {
      course: { select: { id: true, name: true } },
      attendance: { where: { status: 'verified' }, select: { id: true } },
    },
    orderBy: { date: 'desc' },
  });

  const formattedSessions: SessionItem[] = sessions.map((s) => ({
    id: s.id,
    name: s.name,
    date: s.date.toISOString(),
    status: s.status,
    groups: s.groups,
    course: {
      id: s.course.id,
      name: s.course.name,
    },
    verifiedCount: s.attendance.length,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sesiuni de Prezență"
        description="Istoric complet al transmisiilor QR, prezențelor validate în timp real și rapoartelor descărcabile."
        breadcrumbs={[
          { label: 'Panou principal', href: '/dashboard' },
          { label: 'Sesiuni' },
        ]}
        action={
          <Link href="/dashboard/courses">
            <Button variant="accent" size="sm">
              <Plus className="w-3.5 h-3.5" />
              <span>Sesiune nouă</span>
            </Button>
          </Link>
        }
      />

      <SessionsClientView initialSessions={formattedSessions} />
    </div>
  );
}

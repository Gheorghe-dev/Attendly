import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect('/login');
  return (
    <div className="min-h-screen bg-gray-50">
      <DashboardNav professorName={session.user?.name || ''} />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

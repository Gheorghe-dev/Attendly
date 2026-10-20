import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { SettingsForm } from './SettingsForm';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const professor = await prisma.professor.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      createdAt: true,
      _count: { select: { courses: true } },
    },
  });
  if (!professor) redirect('/login');

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <nav className="flex items-center gap-2 text-sm text-gray-400">
        <Link href="/dashboard" className="hover:text-gray-600">Dashboard</Link>
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
        <span className="text-gray-700 font-medium">Settings</span>
      </nav>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account security</p>
      </div>

      {/* Profile */}
      <div className="card p-6">
        <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Profile
        </h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Name</dt>
            <dd className="font-medium text-gray-900 mt-1">{professor.name}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Email</dt>
            <dd className="font-mono text-gray-900 mt-1 break-all">{professor.email}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Courses</dt>
            <dd className="font-medium text-gray-900 mt-1">{professor._count.courses}</dd>
          </div>
          <div>
            <dt className="text-gray-400 text-xs uppercase tracking-wider font-semibold">Member since</dt>
            <dd className="font-medium text-gray-900 mt-1">
              {new Date(professor.createdAt).toLocaleDateString('en-GB', {
                year: 'numeric', month: 'long', day: 'numeric',
              })}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-gray-400 mt-4">
          To change your name or email, edit the professor record directly in the database for now.
        </p>
      </div>

      {/* Change password */}
      <SettingsForm />
    </div>
  );
}

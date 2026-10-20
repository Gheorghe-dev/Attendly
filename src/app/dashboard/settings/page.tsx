import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { SettingsForm } from './SettingsForm';
import { formatDate } from '@/lib/utils';
import {
  GraduationCap,
  Mail,
  Calendar,
  Server,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const professor = await prisma.professor.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          courses: true,
        },
      },
    },
  });

  if (!professor) redirect('/login');

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="Setări & Securitate"
        description="Gestionați profilul de cadru didactic, securitatea acreditărilor și starea instanței locale."
        breadcrumbs={[
          { label: 'Panou principal', href: '/dashboard' },
          { label: 'Setări' },
        ]}
      />

      {/* Professor Profile Card */}
      <Card className="p-6 sm:p-7 shadow-xs border-border space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-border">
          <div className="w-10 h-10 rounded-input bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold text-base border border-accent/20">
            {professor.name?.charAt(0) || 'P'}
          </div>
          <div>
            <CardTitle className="text-base font-serif">
              {professor.name || 'Cadru Didactic'}
            </CardTitle>
            <CardDescription>
              Profil de utilizator autorizat pe instanța locală QR Attendance.
            </CardDescription>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-3.5 rounded-input bg-muted/40 border border-border/50 flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Adresă de e-mail
              </div>
              <div className="font-semibold text-foreground truncate mt-0.5">
                {professor.email}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-input bg-muted/40 border border-border/50 flex items-center gap-3">
            <GraduationCap className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Discipline alocate
              </div>
              <div className="font-semibold text-foreground mt-0.5 tabular-nums">
                {professor._count.courses} cursuri active
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-input bg-muted/40 border border-border/50 flex items-center gap-3">
            <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Data înregistrării
              </div>
              <div className="font-semibold text-foreground mt-0.5">
                {formatDate(professor.createdAt)}
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-input bg-muted/40 border border-border/50 flex items-center gap-3">
            <Server className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Mod găzduire
              </div>
              <div className="font-semibold text-foreground mt-0.5 flex items-center gap-1.5">
                <span>Self-hosted (SQLite)</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Password Change Form */}
      <SettingsForm />
    </div>
  );
}

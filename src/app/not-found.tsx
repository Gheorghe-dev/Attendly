import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { GraduationCap, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Subtle academic background watermark */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.03] select-none">
        <GraduationCap className="w-[600px] h-[600px] text-foreground" />
      </div>

      <Card className="max-w-md w-full p-8 text-center relative z-10 shadow-lg border-border space-y-6">
        <div className="w-16 h-16 rounded-full bg-accent-soft text-accent mx-auto flex items-center justify-center border border-accent/20">
          <GraduationCap className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="font-mono text-xs uppercase tracking-widest text-accent font-semibold">
            Cod 404 · Resursă inexistentă
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            Pagina nu a fost găsită
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Resursa academică sau pagina pe care încercați să o accesați nu există, a fost mutată sau sesiunea respectivă a fost ștearsă.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard" className="w-full sm:w-auto">
            <Button variant="accent" size="md" className="w-full gap-2">
              <Home className="w-4 h-4" />
              <span>Panoul Principal</span>
            </Button>
          </Link>
          <Link href="/login" className="w-full sm:w-auto">
            <Button variant="outline" size="md" className="w-full gap-2">
              <ArrowLeft className="w-4 h-4" />
              <span>Autentificare</span>
            </Button>
          </Link>
        </div>
      </Card>

      <footer className="mt-8 text-center text-xs font-mono text-muted-foreground">
        QR Attendance System · Universitatea Tehnică
      </footer>
    </div>
  );
}

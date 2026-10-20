'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { UserPlus, X, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function AddStudentDialog({
  courseId,
  existingGroups = [],
  open,
  onClose,
  onSuccess,
}: {
  courseId: string;
  existingGroups?: string[];
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [group, setGroup] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !group.trim()) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`/api/courses/${courseId}/students/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          group: group.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Nu s-a putut adăuga studentul.');
        return;
      }

      toast.success(`Studentul ${name} a fost adăugat.`);
      setName('');
      setEmail('');
      setGroup('');
      onSuccess?.();
      onClose();
      router.refresh();
    } catch {
      setError('Eroare de rețea.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={() => !loading && onClose()}
      />

      <Card className="relative z-50 w-full max-w-md p-6 sm:p-7 shadow-lg border-border space-y-5 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-input bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 border border-accent/20">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Adaugă Student Manual</CardTitle>
              <CardDescription>Înregistrează un student în catalogul acestui curs.</CardDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !loading && onClose()}
            className="p-1.5 rounded-input text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-input bg-danger-soft text-danger border border-danger/20 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nume complet student"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex. Popescu Andrei"
          />

          <Input
            label="Email universitar"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ex. andrei.popescu@student.univ.ro"
          />

          <div className="space-y-1.5 text-left">
            <label className="block text-xs font-medium text-foreground">
              Grupă sau subgrupă
            </label>
            <input
              type="text"
              required
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              placeholder="ex. AIA 3.3A sau ELA 2.2 A"
              className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all font-mono"
            />
            {existingGroups.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                <span className="text-[10px] text-muted-foreground mr-1">Sugestii:</span>
                {existingGroups.slice(0, 5).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGroup(g)}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground hover:text-foreground hover:bg-accent-soft hover:text-accent border border-border"
                  >
                    {g}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={loading}
              onClick={onClose}
            >
              Anulează
            </Button>
            <Button
              type="submit"
              variant="accent"
              size="sm"
              loading={loading}
            >
              Salvează Studentul
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

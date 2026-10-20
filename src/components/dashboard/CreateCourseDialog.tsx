'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Plus, X, BookOpen, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export function CreateCourseDialog({
  trigger,
}: {
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Nu s-a putut crea cursul.');
        return;
      }

      toast.success(`Cursul "${name}" a fost creat.`);
      setOpen(false);
      setName('');
      setDescription('');
      router.refresh();
      router.push(`/dashboard/courses/${data.id}`);
    } catch {
      setError('A apărut o eroare la salvare.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {trigger ? (
        <div onClick={() => setOpen(true)}>{trigger}</div>
      ) : (
        <Button variant="accent" size="sm" onClick={() => setOpen(true)}>
          <Plus className="w-3.5 h-3.5" />
          <span>Curs nou</span>
        </Button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
            onClick={() => !loading && setOpen(false)}
          />

          <Card className="relative z-50 w-full max-w-md p-6 sm:p-7 shadow-lg border-border space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-input bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 border border-accent/20">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle>Creează Curs Nou</CardTitle>
                  <CardDescription>
                    Definește o materie sau un modul universitar pentru acest semestru.
                  </CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => !loading && setOpen(false)}
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

            <form onSubmit={handleCreate} className="space-y-4">
              <Input
                label="Nume curs / disciplină"
                required
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex. Sisteme Distribuite (CS 301)"
                helperText="Numele oficial al materiei sau acronimul din planul de învățământ."
              />

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-medium text-foreground">
                  Descriere sau detalii (opțional)
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="ex. Curs de an III, semestrul 2. Include 14 cursuri și 7 laboratoare practice."
                  className="flex w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                >
                  Anulează
                </Button>
                <Button
                  type="submit"
                  variant="accent"
                  size="sm"
                  loading={loading}
                >
                  Creează Cursul
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </>
  );
}

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { toast } from 'sonner';

interface Props {
  id: string;
  name: string;
}

export function SessionRowActions({ id, name }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function doDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/sessions/${id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? 'Ștergerea sesiunii a eșuat.');
        setDeleting(false);
        setConfirming(false);
        return;
      }
      toast.success(`Sesiunea "${name}" a fost ștearsă.`);
      setConfirming(false);
      router.refresh();
    } catch {
      toast.error('Eroare de rețea.');
      setDeleting(false);
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirming(true)}
        disabled={deleting}
        className="text-muted-foreground hover:text-danger hover:bg-danger-soft h-8 px-2"
        title="Șterge definitiv această sesiune"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </Button>

      {confirming && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <Card className="max-w-md w-full p-6 shadow-xl border-border space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-input bg-danger-soft text-danger flex items-center justify-center flex-shrink-0 border border-danger/20">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Ștergi această sesiune?</CardTitle>
                  <CardDescription>
                    Acțiune ireversibilă de eliminare a datelor.
                  </CardDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={deleting}
                className="p-1 rounded-input text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              Sesiunea <strong className="text-foreground">{name}</strong> și toate prezențele înregistrate sau jurnalele de verificare asociate vor fi șterse definitiv.
            </p>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirming(false)}
                disabled={deleting}
              >
                Anulează
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={doDelete}
                loading={deleting}
              >
                Confirmă Ștergerea
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

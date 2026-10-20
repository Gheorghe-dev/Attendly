'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Stepper } from '@/components/ui/Stepper';
import { Dropzone } from '@/components/ui/Dropzone';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import {
  FileSpreadsheet,
  Download,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

interface ValidationResult {
  valid: Array<{ name: string; email: string; group: string }>;
  errors: Array<{ row: number; reason: string }>;
  duplicates: Array<{ row: number; email: string }>;
}

export function ImportRosterDialog({
  courseId,
  courseName,
  open,
  onClose,
  onSuccess,
}: {
  courseId: string;
  courseName: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [preview, setPreview] = useState<ValidationResult | null>(null);
  const [error, setError] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);

  const steps = [
    { title: 'Încărcare', description: 'Selectează fișierul' },
    { title: 'Validare', description: 'Verifică datele' },
    { title: 'Confirmare', description: 'Scrie în baza de date' },
  ];

  async function handleFileSelect(selectedFile: File) {
    setFile(selectedFile);
    setError('');
    setUploading(true);

    const fd = new FormData();
    fd.append('file', selectedFile);
    fd.append('preview', 'true');

    try {
      const res = await fetch(`/api/courses/${courseId}/students`, {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Fișierul nu a putut fi procesat.');
        return;
      }

      setPreview(data.validation);
      setCurrentStep(1); // Advance to Validate step
    } catch {
      setError('Eroare la comunicarea cu serverul.');
    } finally {
      setUploading(false);
    }
  }

  async function handleCommit() {
    if (!file) return;
    setCommitting(true);
    setError('');

    const fd = new FormData();
    fd.append('file', file);
    if (replaceExisting) fd.append('replace', 'true');

    try {
      const res = await fetch(`/api/courses/${courseId}/students`, {
        method: 'POST',
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Nu s-au putut salva datele.');
        return;
      }

      toast.success(
        `Au fost importați ${data.importedCount} studenți în cursul "${courseName}".`
      );
      onSuccess?.();
      onClose();
      router.refresh();
    } catch {
      setError('Eroare la scrierea datelor.');
    } finally {
      setCommitting(false);
    }
  }

  const reset = () => {
    setCurrentStep(0);
    setFile(null);
    setPreview(null);
    setError('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={() => !committing && onClose()}
      />

      <Card className="relative z-50 w-full max-w-2xl p-6 sm:p-8 shadow-xl border-border space-y-6 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-input bg-accent-soft text-accent flex items-center justify-center flex-shrink-0 border border-accent/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle>Import Catalog Studenți din Excel</CardTitle>
              <CardDescription>
                Încarcă lista oficială a studenților pentru cursul {courseName}.
              </CardDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => !committing && onClose()}
            className="p-1.5 rounded-input text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Stepper */}
        <Stepper steps={steps} currentStep={currentStep} className="py-2" />

        {error && (
          <div className="flex items-start gap-2.5 p-3 rounded-input bg-danger-soft text-danger border border-danger/20 text-xs">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STEP 0: Upload ─────────────────────────────────────────── */}
        {currentStep === 0 && (
          <div className="space-y-5">
            <Dropzone
              onFileSelect={handleFileSelect}
              selectedFile={file}
              onClear={reset}
              helper="Trage fișierul de catalog (.xlsx) aici sau fă clic pentru a selecta"
            />

            {uploading && (
              <div className="flex items-center justify-center gap-2 p-3 rounded-input bg-accent-soft text-accent text-xs font-mono animate-pulse">
                <span>Se analizează structura tabelului Excel…</span>
              </div>
            )}

            {/* Template Download & Column Structure Guidance */}
            <div className="p-4 rounded-card bg-muted/40 border border-border space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <Info className="w-4 h-4 text-accent" />
                  Structură recomandată tabel Excel (.xlsx)
                </span>
                <a
                  href="/api/courses/template"
                  className="inline-flex items-center gap-1.5 font-mono text-[11px] text-accent hover:underline font-medium"
                  download="sablon-catalog-studenti.xlsx"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Descarcă Șablon (.xlsx)</span>
                </a>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[11px] font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-border/80 text-muted-foreground">
                      <th className="text-left py-1 px-2">Col 1: Student Name</th>
                      <th className="text-left py-1 px-2">Col 2: University Email</th>
                      <th className="text-left py-1 px-2">Col 3: Group</th>
                    </tr>
                  </thead>
                  <tbody className="text-foreground">
                    <tr className="border-b border-border/40">
                      <td className="py-1 px-2">Popescu Andrei</td>
                      <td className="py-1 px-2 text-muted-foreground">andrei.popescu@student.univ.ro</td>
                      <td className="py-1 px-2 text-accent">AIA 3.3A</td>
                    </tr>
                    <tr>
                      <td className="py-1 px-2">Ionescu Maria</td>
                      <td className="py-1 px-2 text-muted-foreground">maria.ionescu@student.univ.ro</td>
                      <td className="py-1 px-2 text-accent">ELA 2.2 A</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Algoritmul este tolerant la antete non-standard (ex. Nume, Email, Grupa), detectează tabele inversate pe orizontală și grupe cu puncte și spații.
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 1: Validate ───────────────────────────────────────── */}
        {currentStep === 1 && preview && (
          <div className="space-y-5">
            {/* Summary Statistics */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 rounded-card bg-success-soft border border-success/20 text-success">
                <span className="text-[10px] font-mono uppercase block font-semibold">
                  Rânduri Valide
                </span>
                <span className="text-2xl font-serif font-bold tabular-nums">
                  {preview.valid.length}
                </span>
              </div>

              <div className="p-3.5 rounded-card bg-danger-soft border border-danger/20 text-danger">
                <span className="text-[10px] font-mono uppercase block font-semibold">
                  Erori de Format
                </span>
                <span className="text-2xl font-serif font-bold tabular-nums">
                  {preview.errors.length}
                </span>
              </div>

              <div className="p-3.5 rounded-card bg-warning-soft border border-warning/20 text-warning">
                <span className="text-[10px] font-mono uppercase block font-semibold">
                  Duplicate
                </span>
                <span className="text-2xl font-serif font-bold tabular-nums">
                  {preview.duplicates.length}
                </span>
              </div>
            </div>

            {/* Error Table if any */}
            {preview.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-danger">
                  Rânduri cu erori (vor fi ignorate la import):
                </p>
                <div className="max-h-36 overflow-y-auto rounded-card border border-danger/20 p-2 bg-danger-soft/30 text-xs font-mono space-y-1">
                  {preview.errors.map((err, i) => (
                    <div key={i} className="flex items-center justify-between text-danger">
                      <span>Rândul {err.row}:</span>
                      <span className="font-normal">{err.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Valid Sample Preview */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground">
                Previzualizare primele înregistrări valide:
              </p>
              <div className="max-h-48 overflow-y-auto rounded-card border border-border">
                <table className="w-full text-xs font-mono">
                  <thead className="bg-muted text-muted-foreground sticky top-0 border-b border-border">
                    <tr>
                      <th className="text-left py-2 px-3 font-medium">Nume</th>
                      <th className="text-left py-2 px-3 font-medium">Email</th>
                      <th className="text-left py-2 px-3 font-medium">Grupă</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {preview.valid.slice(0, 10).map((s, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="py-1.5 px-3 font-medium text-foreground">{s.name}</td>
                        <td className="py-1.5 px-3 text-muted-foreground">{s.email}</td>
                        <td className="py-1.5 px-3 text-accent font-semibold">{s.group}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.valid.length > 10 && (
                <p className="text-[11px] font-mono text-muted-foreground text-center">
                  + alte {preview.valid.length - 10} înregistrări valide pregătite
                </p>
              )}
            </div>

            {/* Replace Checkbox */}
            <label className="flex items-center gap-2.5 text-xs text-muted-foreground cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="rounded border-input text-accent focus:ring-accent"
              />
              <span>
                Înlocuiește complet studenții existenți (șterge studenții anteriori din acest curs)
              </span>
            </label>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <Button variant="outline" size="sm" onClick={reset}>
                Alege alt fișier
              </Button>
              <Button
                variant="accent"
                size="sm"
                disabled={preview.valid.length === 0}
                onClick={() => setCurrentStep(2)}
              >
                <span>Continuă spre Confirmare</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Confirm ────────────────────────────────────────── */}
        {currentStep === 2 && preview && (
          <div className="space-y-6 text-center py-4">
            <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mx-auto border border-accent/25 shadow-sm">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="font-serif text-xl font-semibold text-foreground">
                Gata de import
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Ești pe cale să adaugi{' '}
                <span className="font-bold text-foreground font-mono">
                  {preview.valid.length} studenți
                </span>{' '}
                în catalogul oficial al cursului{' '}
                <span className="font-semibold text-foreground">{courseName}</span>.
              </p>
              {replaceExisting && (
                <p className="text-xs text-danger font-medium">
                  Atenție: Opțiunea de înlocuire completă este activată.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-4 border-t border-border">
              <Button
                variant="outline"
                size="sm"
                disabled={committing}
                onClick={() => setCurrentStep(1)}
              >
                Înapoi la Validare
              </Button>
              <Button
                variant="accent"
                size="lg"
                loading={committing}
                onClick={handleCommit}
              >
                <span>Confirmă și Importă {preview.valid.length} Studenți</span>
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

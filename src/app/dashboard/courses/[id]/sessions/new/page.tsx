'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MultiSelectChips } from '@/components/ui/MultiSelectChips';
import {
  MapPin,
  Compass,
  Radio,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

// Dynamically import Leaflet map with SSR disabled
const LocationPickerMap = dynamic(
  () =>
    import('@/components/maps/LocationPickerMap').then(
      (mod) => mod.LocationPickerMap
    ),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[320px] rounded-card border border-border bg-card/60 flex items-center justify-center text-muted-foreground text-xs font-mono">
        <Loader2 className="w-5 h-5 animate-spin text-accent mr-2" />
        <span>Se încarcă harta satelitară…</span>
      </div>
    ),
  }
);

interface CourseBasic {
  id: string;
  name: string;
  students: Array<{ group: string }>;
  _count?: { sessions: number };
}

export default function CreateSessionPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;

  const [course, setCourse] = useState<CourseBasic | null>(null);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [allGroups, setAllGroups] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);

  // Geofence states
  const [enableGeofence, setEnableGeofence] = useState(true);
  const [classroomLat, setClassroomLat] = useState<number | null>(null);
  const [classroomLng, setClassroomLng] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [classroomRadius, setClassroomRadius] = useState(50);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'detecting' | 'success' | 'error'>('idle');
  const [geoError, setGeoError] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Default date to now
  useEffect(() => {
    const now = new Date();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    setDate(local.toISOString().slice(0, 16));
  }, []);

  // Fetch course info
  useEffect(() => {
    fetch(`/api/courses/${courseId}`)
      .then((r) => r.json())
      .then((c: CourseBasic) => {
        setCourse(c);
        const gs = Array.from(new Set((c.students || []).map((s) => s.group))).sort();
        setAllGroups(gs);
        setSelectedGroups(gs); // default to all groups
        setName(`Curs ${(c._count?.sessions || 0) + 1}`);
      });
  }, [courseId]);

  function detectClassroomLocation() {
    if (!navigator.geolocation) {
      setGeoError('Geolocația nu este suportată de acest browser.');
      setGeoStatus('error');
      return;
    }

    setGeoStatus('detecting');
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setClassroomLat(pos.coords.latitude);
        setClassroomLng(pos.coords.longitude);
        setAccuracy(pos.coords.accuracy);
        setGeoStatus('success');
        toast.success(
          `Locația sălii a fost detectată (precizie: ±${Math.round(pos.coords.accuracy)}m).`
        );
      },
      (err) => {
        setGeoStatus('error');
        if (err.code === 1) {
          setGeoError(
            'Permisiunea de localizare a fost refuzată. Activează permisiunea din setările browserului pentru a captura perimetrul.'
          );
        } else {
          setGeoError('Semnal GPS indisponibil. Te rugăm să reîncerci.');
        }
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId,
          name: name.trim(),
          date,
          groups: selectedGroups,
          status: 'open',
          classroomLat: enableGeofence ? classroomLat : null,
          classroomLng: enableGeofence ? classroomLng : null,
          classroomRadius: enableGeofence ? classroomRadius : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Nu s-a putut inițializa sesiunea.');
        return;
      }

      toast.success('Sesiunea a fost creată. Se generează codul QR…');
      router.push(`/dashboard/sessions/${data.id}`);
    } catch {
      setError('Eroare de rețea.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-300 pb-20 md:pb-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <PageHeader
        breadcrumbs={[
          { label: 'Cursuri', href: '/dashboard/courses' },
          { label: course?.name || 'Curs', href: `/dashboard/courses/${courseId}` },
          { label: 'Sesiune nouă' },
        ]}
        title="Lansează Sesiune de Prezență"
        description="Configurează titlul sesiunii, grupele eligibile și perimetrul fizic de securitate prin geolocație."
      />

      {error && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-card bg-danger-soft text-danger border border-danger/20 text-xs">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* ── Two Column Layout (Desktop) ─────────────────────────────── */}
      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ── Left Column: Form Controls (Span 7) ────────────────────── */}
          <div className="lg:col-span-7 space-y-6">
            {/* Section 1: Detalii sesiune */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <span className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center font-mono text-xs font-bold">
                  1
                </span>
                <CardTitle className="text-base">Detalii Sesiune</CardTitle>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Titlu sesiune / tematică"
                  required
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ex. Curs 01 — Arhitecturi Distribuite"
                />

                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-medium text-foreground tracking-tight">
                    Data și ora de începere
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="flex min-h-[44px] w-full rounded-input border border-input bg-card px-3.5 py-2 text-xs text-foreground hover:border-accent/50 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:outline-none transition-all font-mono"
                  />
                </div>
              </div>
            </Card>

            {/* Section 2: Grupuri țintă */}
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <span className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center font-mono text-xs font-bold">
                  2
                </span>
                <div>
                  <CardTitle className="text-base">Grupuri Țintă</CardTitle>
                  <CardDescription>
                    Selectează grupele sau subgrupele care au voie să confirme prezența.
                  </CardDescription>
                </div>
              </div>

              {allGroups.length > 0 ? (
                <MultiSelectChips
                  options={allGroups}
                  selected={selectedGroups}
                  onChange={setSelectedGroups}
                  helperText="Studenții din alte grupe vor fi respinși automat cu un mesaj informativ."
                />
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Catalogul nu conține grupe definite încă. Toți studenții din curs vor putea scana.
                </p>
              )}
            </Card>

            {/* Section 3: Geofence GPS */}
            <Card className="p-6 space-y-5">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="w-6 h-6 rounded-full bg-accent-soft text-accent flex items-center justify-center font-mono text-xs font-bold">
                    3
                  </span>
                  <div>
                    <CardTitle className="text-base">Perimetru GPS Anti-Proxy</CardTitle>
                    <CardDescription>
                      Asigură prezența fizică a studenților în sala de curs.
                    </CardDescription>
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={enableGeofence}
                    onChange={(e) => setEnableGeofence(e.target.checked)}
                    className="rounded border-input text-accent focus:ring-accent"
                  />
                  <span className="text-xs font-semibold text-foreground">
                    {enableGeofence ? 'Activat' : 'Dezactivat'}
                  </span>
                </label>
              </div>

              {enableGeofence && (
                <div className="space-y-4 pt-1">
                  {/* Capture Button & Status */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-card bg-muted/40 border border-border">
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-accent" />
                        <span>Coordonate Sală Amfiteatru</span>
                      </p>
                      {classroomLat != null && classroomLng != null ? (
                        <p className="font-mono text-[11px] text-accent font-medium">
                          {classroomLat.toFixed(5)}° N, {classroomLng.toFixed(5)}° E
                          {accuracy && (
                            <span className="text-muted-foreground ml-1">
                              (precizie: ±{Math.round(accuracy)}m)
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">
                          Locația sălii nu a fost încă detectată.
                        </p>
                      )}
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      loading={geoStatus === 'detecting'}
                      onClick={detectClassroomLocation}
                      className="flex-shrink-0"
                    >
                      <Compass className="w-3.5 h-3.5 text-accent" />
                      <span>
                        {classroomLat != null ? 'Re-detectează Sală' : 'Detectează Locația Sălii'}
                      </span>
                    </Button>
                  </div>

                  {geoError && (
                    <div className="p-3 rounded-card bg-danger-soft text-danger border border-danger/20 text-xs">
                      {geoError}
                    </div>
                  )}

                  {/* Radius Slider with large live badge */}
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-foreground">
                        Raza Perimetrului Admis (10m – 200m)
                      </label>
                      <span className="font-mono text-xs font-bold text-accent px-2 py-0.5 rounded bg-accent-soft border border-accent/20 tabular-nums">
                        {classroomRadius} m
                      </span>
                    </div>

                    <input
                      type="range"
                      min={10}
                      max={200}
                      step={5}
                      value={classroomRadius}
                      onChange={(e) => setClassroomRadius(Number(e.target.value))}
                      className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-accent"
                    />

                    <div className="flex justify-between text-[10px] font-mono text-muted-foreground pt-1">
                      <span>10 m (laborator mic)</span>
                      <span>50 m (amfiteatru standard)</span>
                      <span>200 m (corp universitar)</span>
                    </div>
                  </div>

                  {/* Info Banner */}
                  <div className="flex items-start gap-2.5 p-3 rounded-card bg-info-soft text-info border border-info/20 text-xs">
                    <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      GPS-ul în interiorul clădirilor din beton armat poate avea o eroare de 10–25m. Se recomandă o rază de 50–100m pentru săli mari de curs.
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          {/* ── Right Column: Map Preview & Summary (Span 5) ────────────── */}
          <div className="lg:col-span-5 space-y-6">
            <Card className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Previzualizare Perimetru GPS</CardTitle>
                {classroomLat != null && (
                  <span className="text-[10px] font-mono text-success flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-3 h-3" />
                    Semnal Captat
                  </span>
                )}
              </div>

              {/* Interactive Leaflet Map with translucent gold circle */}
              <LocationPickerMap
                lat={enableGeofence ? classroomLat : null}
                lng={enableGeofence ? classroomLng : null}
                radius={classroomRadius}
                accuracy={accuracy}
                onLocationChange={(newLat, newLng) => {
                  setClassroomLat(newLat);
                  setClassroomLng(newLng);
                  setGeoStatus('success');
                }}
              />

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Cercul auriu reprezintă zona în care telefoanele studenților vor putea trimite confirmarea de prezență.
              </p>
            </Card>

            {/* Security Guarantee Card */}
            <Card className="p-5 bg-card/60 space-y-3 text-xs">
              <div className="flex items-center gap-2 text-foreground font-semibold">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span>Garanție Anti-Proxy Criptografică</span>
              </div>
              <ul className="space-y-1.5 text-muted-foreground text-[11px] leading-relaxed">
                <li>• Tokenul QR este unic și efemer (CUID securizat).</li>
                <li>• Distanța sferică este calculată prin formula matematică Haversine.</li>
                <li>• Înregistrările duplicate sunt blocate automat.</li>
              </ul>
            </Card>

            {/* Desktop Action Buttons */}
            <div className="hidden md:flex items-center justify-end gap-3 pt-2">
              <Link href={`/dashboard/courses/${courseId}`}>
                <Button variant="outline" size="md">
                  Anulează
                </Button>
              </Link>
              <Button
                type="submit"
                variant="accent"
                size="md"
                loading={loading}
                className="shadow-md"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>Creează Sesiunea</span>
              </Button>
            </div>
          </div>
        </div>

        {/* ── Mobile Sticky Footer (<768px) ─────────────────────────── */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card border-t border-border p-3 px-4 flex items-center justify-between gap-3 shadow-lg">
          <Link href={`/dashboard/courses/${courseId}`}>
            <Button variant="outline" size="sm">
              Anulează
            </Button>
          </Link>
          <Button
            type="submit"
            variant="accent"
            size="sm"
            loading={loading}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>Creează Sesiunea</span>
          </Button>
        </div>
      </form>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Badge, GroupBadge } from '@/components/ui/Badge';
import { LiveBadge } from '@/components/ui/LiveBadge';
import { ProgressRing } from '@/components/ui/ProgressRing';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Stepper } from '@/components/ui/Stepper';
import { Dropzone } from '@/components/ui/Dropzone';
import { MultiSelectChips } from '@/components/ui/MultiSelectChips';
import { Avatar } from '@/components/ui/Avatar';
import { PageHeader } from '@/components/ui/PageHeader';
import { Logo } from '@/components/branding/Logo';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import {
  Users,
  CheckCircle,
  FileSpreadsheet,
  QrCode,
} from 'lucide-react';

export default function DevUiKitPage() {
  const [selectedGroups, setSelectedGroups] = useState(['AIA 3.3A', 'ELA 2.2 A']);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const steps = [
    { title: 'Încărcare', description: 'Selectează fișierul' },
    { title: 'Validare', description: 'Verifică erorile' },
    { title: 'Confirmare', description: 'Importă studenții' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground p-6 sm:p-12 max-w-[1200px] mx-auto space-y-12">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div className="flex items-center gap-4">
          <Logo size="lg" showTagline />
          <Badge variant="accent">Design System v1.0</Badge>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </div>

      <PageHeader
        breadcrumbs={[
          { label: 'Dezvoltare', href: '#' },
          { label: 'UI Kit & Componente' },
        ]}
        title="Modern Academic Elegance UI Kit"
        description="Biblioteca de componente standardizate pentru sistemul universitar de prezență. Fiecare componentă respectă paleta ivory/navy/gold și criteriile de contrast WCAG AA."
      />

      {/* 1. Buttons */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-semibold border-b border-border pb-2">
          1. Butoane (Toate stările și dimensiunile)
        </h3>
        <div className="flex flex-wrap gap-3 items-center">
          <Button variant="primary">Primary Navy</Button>
          <Button variant="accent">Accent Gold CTA</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" loading>Loading State</Button>
          <Button variant="outline" disabled>Disabled State</Button>
        </div>
        <div className="flex flex-wrap gap-3 items-center pt-2">
          <Button size="sm" variant="accent">Small Button</Button>
          <Button size="md" variant="primary">Medium Button</Button>
          <Button size="lg" variant="outline">Large Button</Button>
        </div>
      </section>

      {/* 2. Badges & Group Badges */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-semibold border-b border-border pb-2">
          2. Badge-uri academice &amp; Indicatoare de stare
        </h3>
        <div className="flex flex-wrap gap-3 items-center">
          <Badge variant="default">Implicit</Badge>
          <Badge variant="accent">Accent Gold</Badge>
          <Badge variant="success">Prezent (Confirmat)</Badge>
          <Badge variant="danger">Absent</Badge>
          <Badge variant="warning">Avertisment GPS</Badge>
          <Badge variant="info">Informație</Badge>
          <LiveBadge isOpen={true} />
          <LiveBadge isOpen={false} />
        </div>
        <div className="flex flex-wrap gap-2 items-center pt-2">
          <span className="text-xs text-muted-foreground mr-2">Grupe inginerie:</span>
          <GroupBadge group="AIA 3.3A" />
          <GroupBadge group="AIA 3.1 B" />
          <GroupBadge group="ELA 2.2 A" />
          <GroupBadge group="ELA 2.1 B" />
        </div>
      </section>

      {/* 3. Inputs & Form Fields */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-semibold border-b border-border pb-2">
          3. Câmpuri de formular (Înălțime tactilă ≥44px)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <Input
            label="Email universitar"
            placeholder="student@univ.ro"
            helperText="Folosește adresa instituțională @student.univ.ro"
          />
          <Input
            label="Nume complet"
            placeholder="Popescu Andrei"
            defaultValue="Alexandru Ioan"
          />
          <Input
            label="Câmp cu eroare"
            placeholder="adresa-invalida"
            error="Adresa de email nu are un format valid"
          />
        </div>
      </section>

      {/* 4. StatCards & ProgressRing */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-semibold border-b border-border pb-2">
          4. StatCards cu cifre mari Fraunces &amp; Sparkline SVG
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Studenți înscriși"
            value="148"
            context="Total pe 3 cursuri active"
            icon={<Users className="w-4 h-4" />}
            sparklineData={[120, 130, 138, 142, 145, 148]}
          />
          <StatCard
            label="Rată medie prezență"
            value="86%"
            context="Față de 78% semestrul trecut"
            trend={{ positive: true, text: '+8%' }}
            icon={<CheckCircle className="w-4 h-4" />}
            sparklineData={[70, 75, 82, 80, 85, 86]}
          />
          <StatCard
            label="Sesiuni finalizate"
            value="24"
            context="12 cursuri, 12 laboratoare"
            icon={<FileSpreadsheet className="w-4 h-4" />}
          />
          <Card className="p-5 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-mono uppercase text-muted-foreground">Prezență live</p>
              <h4 className="font-serif text-2xl font-semibold mt-1">Sesiune activă</h4>
              <p className="text-xs text-muted-foreground mt-0.5">24 din 30 prezenți</p>
            </div>
            <ProgressRing percentage={80} size={58} strokeWidth={5} />
          </Card>
        </div>
      </section>

      {/* 5. Stepper & Dropzone */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-semibold border-b border-border pb-2">
          5. Stepper &amp; Dropzone încărcare catalog Excel
        </h3>
        <Card className="p-6 space-y-6">
          <Stepper
            steps={steps}
            currentStep={currentStep}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}>
              Pasul anterior
            </Button>
            <Button size="sm" variant="accent" onClick={() => setCurrentStep(Math.min(2, currentStep + 1))}>
              Pasul următor
            </Button>
          </div>

          <Dropzone
            onFileSelect={(f) => setSelectedFile(f)}
            selectedFile={selectedFile}
            onClear={() => setSelectedFile(null)}
          />
        </Card>
      </section>

      {/* 6. MultiSelectChips */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-semibold border-b border-border pb-2">
          6. Selectare multiplă a grupelor țintă
        </h3>
        <Card className="p-6">
          <MultiSelectChips
            label="Selectează grupele participante la laborator"
            options={['AIA 3.3A', 'AIA 3.1 B', 'ELA 2.2 A', 'ELA 2.1 B']}
            selected={selectedGroups}
            onChange={setSelectedGroups}
            helperText="Dacă nu este selectată nicio grupă, toți studenții din curs pot confirma prezența."
          />
        </Card>
      </section>

      {/* 7. EmptyState & Avatars */}
      <section className="space-y-4">
        <h3 className="font-serif text-lg font-semibold border-b border-border pb-2">
          7. Stări goale (EmptyState) &amp; Monograme Avatar
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <EmptyState
            icon={<QrCode className="w-6 h-6 text-accent" />}
            title="Nicio sesiune deschisă"
            description="Lansează o nouă sesiune de prezență pentru a genera codul QR de proiecție."
            action={{
              label: 'Creează prima sesiune',
              onClick: () => {},
              variant: 'accent',
            }}
          />

          <Card className="p-6 space-y-4">
            <CardTitle>Monograme studenți</CardTitle>
            <CardDescription>Generare automată a inițialelor cu fundal academic temperat.</CardDescription>
            <div className="flex items-center gap-3">
              <Avatar name="Alan Turing" size="lg" />
              <Avatar name="Popescu Andrei" size="md" />
              <Avatar name="Maria Ionescu" size="sm" />
              <Avatar name="Cristian Radu" size="sm" />
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

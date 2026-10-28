'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Monitor,
  Apple,
  Terminal,
  ArrowRight,
  HardDrive,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Laptop,
} from 'lucide-react';
import { Logo } from '@/components/branding/Logo';
import { ThemeToggle } from '@/components/shell/ThemeToggle';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface InstallerItem {
  name: string;
  category: 'windows' | 'mac-arm64' | 'mac-intel' | 'linux-appimage' | 'linux-deb' | 'script' | 'other';
  label: string;
  sizeBytes: number;
  sizeFormatted: string;
  downloadUrl: string;
  updatedAt: string;
}

export default function DownloadsPage() {
  const [installers, setInstallers] = useState<InstallerItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/downloads')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.installers)) {
          setInstallers(data.installers);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const winInstaller = installers.find((i) => i.category === 'windows');
  const macArmInstaller = installers.find((i) => i.category === 'mac-arm64');
  const macIntelInstaller = installers.find((i) => i.category === 'mac-intel');
  const linuxAppImage = installers.find((i) => i.category === 'linux-appimage');
  const linuxDeb = installers.find((i) => i.category === 'linux-deb');

  return (
    <div className="min-h-screen w-full flex flex-col justify-between items-center p-6 bg-background text-foreground selection:bg-accent/20">
      {/* Top Header */}
      <header className="flex items-center justify-between w-full max-w-5xl py-4 border-b border-border/40">
        <Link href="/" className="flex items-center gap-2">
          <Logo size="md" />
        </Link>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <span>Instructor Sign In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-5xl my-8 space-y-10">
        {/* Hero Section */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-accent-soft text-accent border border-accent/20">
            <Laptop className="w-3.5 h-3.5" />
            <span>Standalone Desktop Applications &bull; Version 1.1.2</span>
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Download Attendly Desktop
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Run Attendly with a dedicated local SQLite database, automatic worldwide Cloudflare tunnel for mobile check-ins, and zero configuration needed.
          </p>
        </div>

        {/* Platform Download Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Windows Card */}
          <Card className="p-6 flex flex-col justify-between space-y-6 border-border hover:border-accent/40 transition-all shadow-sm">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center border border-blue-500/20">
                <Monitor className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Windows</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Windows 10 & 11 (64-bit). 1-Click standalone installer with bundled database & tunnel.
                </p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2 pt-2 border-t border-border">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span>No Node.js or Python required</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span>Configures firewall automatically</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span>Desktop & Start menu shortcuts</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2 pt-4">
              <a
                href={winInstaller?.downloadUrl || '/download/windows'}
                className="w-full inline-block"
              >
                <Button className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  <Download className="w-4 h-4" />
                  <span>Download .exe {winInstaller ? `(${winInstaller.sizeFormatted})` : ''}</span>
                </Button>
              </a>
              <a
                href="/downloads/Install-Attendly-Windows.bat"
                className="w-full inline-block text-center"
              >
                <span className="text-[11px] text-muted-foreground hover:text-foreground underline">
                  Download 1-Click Installer Script (.bat)
                </span>
              </a>
            </div>
          </Card>

          {/* macOS Card */}
          <Card className="p-6 flex flex-col justify-between space-y-6 border-border hover:border-accent/40 transition-all shadow-sm">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center border border-purple-500/20">
                <Apple className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">macOS</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  macOS Monterey, Ventura, Sonoma, Sequoia. Drag to /Applications folder.
                </p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2 pt-2 border-t border-border">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span>Apple Silicon (M1/M2/M3/M4) native</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span>Intel Macs supported (x64)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span>Self-healing tunnel binary</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2 pt-4">
              <a
                href={macArmInstaller?.downloadUrl || '/download/mac-arm64'}
                className="w-full inline-block"
              >
                <Button className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  <Download className="w-4 h-4" />
                  <span>Apple Silicon .dmg {macArmInstaller ? `(${macArmInstaller.sizeFormatted})` : ''}</span>
                </Button>
              </a>
              <a
                href={macIntelInstaller?.downloadUrl || '/download/mac-intel'}
                className="w-full inline-block"
              >
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  <span>Intel Mac .dmg {macIntelInstaller ? `(${macIntelInstaller.sizeFormatted})` : ''}</span>
                </Button>
              </a>
              <a
                href="/downloads/Install-Attendly-Mac.command"
                className="w-full inline-block text-center"
              >
                <span className="text-[11px] text-muted-foreground hover:text-foreground underline">
                  Download 1-Click Script (.command)
                </span>
              </a>
            </div>
          </Card>

          {/* Linux Card */}
          <Card className="p-6 flex flex-col justify-between space-y-6 border-border hover:border-accent/40 transition-all shadow-sm">
            <div className="space-y-4">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-foreground">Linux</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  Universal AppImage & Debian/Ubuntu packages for standalone desktop use.
                </p>
              </div>
              <ul className="text-xs text-muted-foreground space-y-2 pt-2 border-t border-border">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span>Universal standalone AppImage</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span>Ubuntu, Debian & Mint package (.deb)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-accent" />
                  <span>Docker hosting option with Nginx proxy</span>
                </li>
              </ul>
            </div>

            <div className="space-y-2 pt-4">
              <a
                href={linuxAppImage?.downloadUrl || '/download/linux'}
                className="w-full inline-block"
              >
                <Button className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                  <Download className="w-4 h-4" />
                  <span>Download .AppImage {linuxAppImage ? `(${linuxAppImage.sizeFormatted})` : ''}</span>
                </Button>
              </a>
              <a
                href={linuxDeb?.downloadUrl || '/download/deb'}
                className="w-full inline-block"
              >
                <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .deb {linuxDeb ? `(${linuxDeb.sizeFormatted})` : ''}</span>
                </Button>
              </a>
            </div>
          </Card>
        </div>

        {/* Available Hosted Files Table */}
        <Card className="p-6 border-border space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-foreground text-sm">Hosted Installer Files</h3>
            </div>
            <a
              href="https://github.com/Gheorghe-dev/Attendly/releases/tag/v1.1.2"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline flex items-center gap-1"
            >
              <span>GitHub Release v1.1.2</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-xs text-muted-foreground">
            All files below are hosted directly on this server through the high-performance Nginx reverse proxy. Resumable downloads are supported.
          </p>

          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden text-xs">
            {installers.map((inst) => (
              <div
                key={inst.name}
                className="p-3 flex items-center justify-between hover:bg-accent-soft/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileCode className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <span className="font-mono font-medium text-foreground block">{inst.name}</span>
                    <span className="text-[10px] text-muted-foreground">{inst.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground">{inst.sizeFormatted}</span>
                  <a href={inst.downloadUrl} download>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </Button>
                  </a>
                </div>
              </div>
            ))}
            {installers.length === 0 && !loading && (
              <div className="p-4 text-center text-muted-foreground">
                No local installer files found in ./release directory. Mount your release folder or download from GitHub.
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl py-4 border-t border-border/40 text-center text-xs text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-accent" />
          <span>Self-hosted academic attendance system. All data remains on your infrastructure.</span>
        </div>
        <div>
          <Link href="/login" className="text-accent hover:underline">
            Instructor Web Login &rarr;
          </Link>
        </div>
      </footer>
    </div>
  );
}

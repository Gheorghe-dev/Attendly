'use client';

import * as React from 'react';
import { Globe, Wifi, Copy, Check, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface TunnelStatus {
  tunnelUrl: string | null;
  lanUrl: string | null;
  localUrl: string;
  bestUrl: string;
  isWorldwide: boolean;
  mode: 'worldwide' | 'lan' | 'local';
}

export function NetworkStatusPill() {
  const [status, setStatus] = React.useState<TunnelStatus | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [loading, setLoading] = React.useState(true);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/tunnel', { cache: 'no-store' });
      if (res.ok) {
        const data: TunnelStatus = await res.json();
        setStatus(data);
      }
    } catch {
      // Ignore network errors in local dashboard
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
    // Poll every 3 seconds for the first 15 seconds to catch tunnel startup
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const copyUrl = (urlToCopy: string) => {
    if (!urlToCopy) return;
    navigator.clipboard.writeText(urlToCopy);
    setCopied(true);
    toast.success('Public access URL copied to clipboard!', {
      description: 'Students on ANY Wi-Fi or mobile 4G/5G can open this link.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading && !status) {
    return (
      <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono bg-muted/60 text-muted-foreground border border-border">
        <RefreshCw className="w-3 h-3 animate-spin text-accent" />
        <span>Connecting worldwide access…</span>
      </div>
    );
  }

  const activeUrl = status?.bestUrl || 'http://localhost:3000';
  const isWorldwide = status?.isWorldwide;

  return (
    <div className="flex items-center gap-1.5">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors ${
          isWorldwide
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            : status?.lanUrl
            ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20'
            : 'bg-muted/80 text-muted-foreground border-border'
        }`}
        title={
          isWorldwide
            ? 'Worldwide Tunnel Active: Works on ANY Wi-Fi and mobile network worldwide.'
            : 'Local Wi-Fi: Devices must be connected to your local network.'
        }
      >
        {isWorldwide ? (
          <Globe className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
        ) : (
          <Wifi className="w-3.5 h-3.5 text-sky-500" />
        )}
        <span className="hidden md:inline font-semibold">
          {isWorldwide ? 'Any Wi-Fi Access' : 'Local Wi-Fi'}
        </span>
        <span className="hidden lg:inline text-[11px] opacity-80">
          ({new URL(activeUrl).hostname})
        </span>
      </div>

      {/* 1-Click Copy Public Access Link */}
      <button
        type="button"
        onClick={() => copyUrl(activeUrl)}
        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-mono bg-card hover:bg-muted border border-border text-foreground transition-colors shadow-xs"
        title="Copy Public Access URL for students"
      >
        {copied ? (
          <>
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[11px] font-medium text-emerald-500">Copied</span>
          </>
        ) : (
          <>
            <Copy className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium hidden sm:inline">Copy Link</span>
          </>
        )}
      </button>

      {/* Open Public URL in new tab / browser */}
      <a
        href={activeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors"
        title="Open public access link in external browser"
      >
        <ExternalLink className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

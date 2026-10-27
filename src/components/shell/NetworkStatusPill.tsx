'use client';

import * as React from 'react';
import { Globe, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface TunnelStatus {
  tunnelUrl: string | null;
  lanUrl: string | null;
  localUrl: string;
  bestUrl: string | null;
  isWorldwide: boolean;
  connecting?: boolean;
  mode: 'worldwide' | 'connecting';
}

export function NetworkStatusPill() {
  const [status, setStatus] = React.useState<TunnelStatus | null>(null);
  const [copied, setCopied] = React.useState(false);

  const fetchStatus = React.useCallback(async () => {
    try {
      const res = await fetch('/api/tunnel', { cache: 'no-store' });
      if (res.ok) {
        const data: TunnelStatus = await res.json();
        setStatus(data);
      }
    } catch {
      // Ignore network errors in local dashboard
    }
  }, []);

  React.useEffect(() => {
    fetchStatus();
    // Poll fast (1.5s) if not worldwide yet, or every 5s once active
    const pollInterval = status?.isWorldwide ? 5000 : 1500;
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, status?.isWorldwide]);

  const isWorldwide = Boolean(status?.isWorldwide && status?.tunnelUrl);
  const activeUrl = status?.tunnelUrl || '';

  const copyUrl = (urlToCopy: string) => {
    if (!urlToCopy) {
      toast.info('Connecting Any Wi-Fi worldwide access...', {
        description: 'Please wait a moment while the tunnel finishes handshaking.',
      });
      return;
    }
    navigator.clipboard.writeText(urlToCopy);
    setCopied(true);
    toast.success('Public access URL copied to clipboard!', {
      description: 'Students on ANY Wi-Fi or mobile 4G/5G can open this link.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  let hostname = '';
  if (isWorldwide && activeUrl) {
    try {
      hostname = new URL(activeUrl).hostname;
    } catch {}
  }

  return (
    <div className="flex items-center gap-1.5">
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
        title={
          isWorldwide
            ? `Any Wi-Fi Access: ${activeUrl}`
            : 'Establishing worldwide Any Wi-Fi access tunnel for students…'
        }
      >
        <Globe
          className={`w-3.5 h-3.5 text-emerald-500 ${
            isWorldwide ? 'animate-pulse' : 'animate-spin'
          }`}
        />
        <span className="font-semibold">
          {isWorldwide ? 'Any Wi-Fi Access' : 'Connecting Any Wi-Fi…'}
        </span>
        {hostname && (
          <span className="hidden lg:inline text-[11px] opacity-80">
            ({hostname})
          </span>
        )}
      </div>

      {/* 1-Click Copy Public Access Link */}
      {isWorldwide && activeUrl && (
        <>
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
        </>
      )}
    </div>
  );
}

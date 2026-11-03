import React from 'react';
import { Card, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Loader2, Maximize2, Copy, Check, ShieldCheck } from 'lucide-react';

interface SessionQRCodeCardProps {
  qrData: {
    qr: string;
    url: string;
    baseUrl?: string;
  } | null;
  onPresentFullscreen: () => void;
  onCopyLink: () => void;
  copiedLink: boolean;
  onReloadQr: () => void;
  sessionStatus: string;
  targetGroups: string[];
  enrolledCount: number;
}

export function SessionQRCodeCard({
  qrData,
  onPresentFullscreen,
  onCopyLink,
  copiedLink,
  onReloadQr,
  sessionStatus,
  targetGroups,
  enrolledCount,
}: SessionQRCodeCardProps) {
  return (
    <div className="space-y-6">
      <Card className="p-6 text-center space-y-4 border-accent/20">
        <div className="space-y-1">
          <span className="text-xs font-mono text-accent font-semibold uppercase tracking-wider">
            Live Dynamic QR
          </span>
          <CardTitle className="text-base">Scan to Register</CardTitle>
          <CardDescription>
            Tokens cycle automatically every few seconds to prevent proxy attendance.
          </CardDescription>
        </div>

        <div className="p-3 bg-white rounded-card shadow-inner border border-border inline-block mx-auto max-w-[220px]">
          {qrData?.qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrData.qr}
              alt="Session Attendance QR"
              className="w-full h-auto rounded"
            />
          ) : (
            <div className="w-[196px] h-[196px] bg-muted/30 flex flex-col items-center justify-center text-muted-foreground p-3 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
              <span className="text-[11px] font-mono">Generating QR…</span>
              <button
                type="button"
                onClick={onReloadQr}
                className="text-[10px] text-accent hover:underline font-mono"
              >
                Click to reload
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-1">
          <Button
            variant="accent"
            size="md"
            onClick={onPresentFullscreen}
            className="w-full shadow-sm"
          >
            <Maximize2 className="w-4 h-4" />
            <span>Present Full Screen</span>
          </Button>

          <button
            type="button"
            onClick={onCopyLink}
            className="text-xs text-muted-foreground hover:text-foreground font-mono flex items-center justify-center gap-1.5 mx-auto py-1"
          >
            {copiedLink ? (
              <Check className="w-3 h-3 text-success" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span>{copiedLink ? 'Copied URL' : 'Copy student direct URL'}</span>
          </button>

          {qrData?.url && (
            <div className="pt-1.5 border-t border-border/50">
              <span className="text-[11px] font-mono flex items-center justify-center gap-1">
                {qrData.url.includes('trycloudflare.com') ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    🌍 Accessible from ANY Wi-Fi & 4G/5G
                  </span>
                ) : !qrData.url.includes('localhost') && !qrData.url.includes('127.0.0.1') ? (
                  <span className="text-sky-600 dark:text-sky-400 font-medium">
                    📶 Accessible on local Wi-Fi
                  </span>
                ) : (
                  <span className="text-amber-500 font-medium">
                    ⚠️ Connecting tunnel for worldwide Wi-Fi access…
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Session Overview Card */}
      <Card className="p-5 space-y-3 text-xs">
        <CardTitle className="text-sm">Session Overview</CardTitle>
        <div className="space-y-2.5 text-muted-foreground pt-1 border-t border-border">
          <div className="flex justify-between items-center">
            <span>Status:</span>
            <span className="font-mono text-foreground font-medium capitalize">
              {sessionStatus}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Device Protection:</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              1 student / device
            </span>
          </div>
          <div className="flex justify-between">
            <span>Target groups:</span>
            <span className="font-mono text-foreground font-medium">
              {targetGroups.length > 0 ? targetGroups.join(', ') : 'All groups'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Enrolled students:</span>
            <span className="font-mono text-foreground font-medium tabular-nums">
              {enrolledCount}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}

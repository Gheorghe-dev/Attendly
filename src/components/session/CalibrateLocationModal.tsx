'use client';

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Navigation,
  X,
  Smartphone,
  Laptop,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface CalibrateModalProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  hostLat?: number | null;
  hostLng?: number | null;
  publicBaseUrl?: string;
  onCalibrated: () => void;
}

export function CalibrateLocationModal({
  open,
  onClose,
  sessionId,
  hostLat,
  hostLng,
  publicBaseUrl,
  onCalibrated,
}: CalibrateModalProps) {
  const [activeTab, setActiveTab] = useState<'phone' | 'pc'>('phone');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const calibrateUrl = `${(publicBaseUrl || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '')}/dashboard/sessions/${sessionId}/calibrate`;

  useEffect(() => {
    if (open && calibrateUrl) {
      QRCode.toDataURL(calibrateUrl, {
        width: 240,
        margin: 1,
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => setQrCodeUrl(url))
        .catch(() => {});
    }
  }, [open, calibrateUrl]);

  if (!open) return null;

  async function handleBrowserCalibrate() {
    if (!navigator.geolocation) {
      setError('Geolocation not supported in this browser.');
      return;
    }
    setError(null);
    setLoading(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const res = await fetch(`/api/sessions/${sessionId}/calibrate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng }),
          });
          const d = await res.json();
          if (res.ok) {
            setSuccess(`Host location calibrated to ${lat.toFixed(6)}, ${lng.toFixed(6)}!`);
            onCalibrated();
          } else {
            setError(d.error || 'Failed to save location.');
          }
        } catch {
          setError('Failed to calibrate location.');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        setError(`Location error: ${err.message}. If using Electron without GPS, please use the Phone QR option.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs select-none">
      <div className="bg-card border border-border rounded-card shadow-2xl max-w-md w-full p-6 space-y-5 text-foreground">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent/15 text-accent flex items-center justify-center">
              <Navigation className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold text-foreground">
                Classroom GPS Calibration
              </h3>
              <p className="text-[11px] text-muted-foreground font-mono">
                High-precision WGS-84 room proximity
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {hostLat != null && hostLng != null && (
          <div className="p-2.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs font-mono text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Calibrated Anchor</span>
            </span>
            <span className="text-[11px] text-muted-foreground">
              {hostLat.toFixed(5)}, {hostLng.toFixed(5)}
            </span>
          </div>
        )}

        <div className="flex rounded-input border border-border p-0.5 bg-muted/40 text-xs font-mono">
          <button
            type="button"
            onClick={() => setActiveTab('phone')}
            className={`flex-1 py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'phone'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Phone GPS (Recommended)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pc')}
            className={`flex-1 py-1.5 px-3 rounded flex items-center justify-center gap-1.5 transition-colors ${
              activeTab === 'pc'
                ? 'bg-card text-foreground font-semibold shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>This PC</span>
          </button>
        </div>

        {activeTab === 'phone' && (
          <div className="text-center space-y-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Laptops lack satellite GPS chips. Scan this QR with your phone to use its real hardware GPS as the classroom anchor:
            </p>
            {qrCodeUrl ? (
              <div className="p-3 bg-white rounded-card shadow-inner border border-border inline-block mx-auto">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrCodeUrl} alt="Calibration QR" className="w-48 h-48 mx-auto" />
              </div>
            ) : (
              <div className="w-48 h-48 bg-muted/40 flex items-center justify-center mx-auto rounded-card">
                <Loader2 className="w-6 h-6 animate-spin text-accent" />
              </div>
            )}
            <p className="text-[11px] font-mono text-muted-foreground break-all">
              {calibrateUrl}
            </p>
          </div>
        )}

        {activeTab === 'pc' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Acquires coordinates from this machine&apos;s browser geolocation service.
            </p>
            {error && (
              <div className="p-3 rounded bg-rose-500/10 border border-rose-500/20 text-xs text-rose-600 dark:text-rose-400 font-mono flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 rounded bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{success}</span>
              </div>
            )}
            <Button
              variant="accent"
              size="md"
              className="w-full font-mono text-xs"
              onClick={handleBrowserCalibrate}
              loading={loading}
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>Calibrate with This Browser</span>
            </Button>
          </div>
        )}

        <div className="pt-2 border-t border-border flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}

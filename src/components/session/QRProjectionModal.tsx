'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, X, Maximize2, Minimize2, Lock, MapPin } from 'lucide-react';
import { GroupBadge } from '@/components/ui/Badge';

export interface QRProjectionModalProps {
  open: boolean;
  onClose: () => void;
  qrDataUrl: string;
  publicUrl: string;
  courseName: string;
  sessionName: string;
  classroom?: string | null;
  targetGroups: string[];
  presentCount: number;
  enrolledCount: number;
  isOpen: boolean;
}

export function QRProjectionModal({
  open,
  onClose,
  qrDataUrl,
  publicUrl,
  courseName,
  sessionName,
  classroom,
  targetGroups,
  presentCount,
  enrolledCount,
  isOpen,
}: QRProjectionModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimerRef = useRef<NodeJS.Timeout>();

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      if (containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    } else {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    }
  };

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        onClose();
      }
    };
    if (open) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Discreet controls auto-fade after 3 seconds on mouse idle
  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimerRef.current) clearTimeout(hideControlsTimerRef.current);
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  };

  if (!open) return null;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 bg-[#0B1220] text-[#EDE9E0] flex flex-col justify-between p-6 sm:p-10 select-none overflow-hidden"
      style={{
        backgroundImage: 'radial-gradient(ellipse at center, #111A2B 0%, #0B1220 85%)',
      }}
    >
      {/* ── Discreet Top Controls Bar (Fades after 3s) ──────────────── */}
      <div
        className={`flex items-center justify-between transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center gap-3">
          <span className="font-serif text-lg sm:text-xl font-semibold text-[#EDE9E0] tracking-tight">
            {courseName}
          </span>
          <span className="text-sm text-[#9AA4B5]">·</span>
          <span className="text-sm font-medium text-[#C9A56B]">{sessionName}</span>
          {classroom && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#C9A56B]/20 text-[#C9A56B] border border-[#C9A56B]/30 font-mono">
              <MapPin className="w-3 h-3 text-[#C9A56B]" />
              <span>{classroom}</span>
            </span>
          )}
          {targetGroups.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 ml-2">
              {targetGroups.map((g) => (
                <GroupBadge key={g} group={g} />
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-input bg-white/10 hover:bg-white/20 text-[#EDE9E0] transition-colors"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-input bg-white/10 hover:bg-white/20 text-[#EDE9E0] transition-colors"
            title="Close Projection (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ── Central Stage: Pure White QR Tile + Giant Fraunces Counter ─ */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-16 my-auto max-w-7xl mx-auto w-full">
        {/* Pure White Tile for QR */}
        <div className="relative flex-shrink-0">
          <div
            className="bg-[#FFFFFF] p-8 sm:p-10 rounded-[24px] shadow-2xl flex items-center justify-center transition-all duration-300"
            style={{
              width: 'min(64vh, 64vw)',
              height: 'min(64vh, 64vw)',
              maxWidth: '540px',
              maxHeight: '540px',
            }}
          >
            {/* Pure black on white QR image */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qrDataUrl}
              alt="Attendance QR Code"
              className={`w-full h-full object-contain transition-opacity duration-300 ${
                !isOpen ? 'opacity-15 blur-[1px]' : 'opacity-100'
              }`}
              style={{ imageRendering: 'pixelated' }}
            />

            {/* Overlay when registration is closed */}
            {!isOpen && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 rounded-[24px] backdrop-blur-[2px] p-6 text-center text-white space-y-2">
                <Lock className="w-10 h-10 text-[#C9A56B] mb-2 animate-bounce" />
                <h3 className="font-serif text-2xl font-bold tracking-tight text-white">
                  Check-in is Closed
                </h3>
                <p className="text-xs text-neutral-300 max-w-xs leading-relaxed">
                  The instructor has closed check-ins for this session.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Big Telemetry & Scan Instructions */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-[#C9A56B]">
            <Smartphone className="w-4 h-4 text-[#C9A56B]" />
            <span className="font-semibold uppercase tracking-wider">
              Scan with your phone camera
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline gap-3">
              <span className="font-serif text-7xl sm:text-8xl lg:text-9xl font-bold tracking-tight text-white tabular-nums">
                {presentCount}
              </span>
              <span className="font-serif text-4xl sm:text-5xl text-[#9AA4B5]">
                / {enrolledCount}
              </span>
            </div>
            <p className="font-mono text-sm uppercase tracking-widest text-[#C9A56B] font-semibold">
              confirmed students present
            </p>

            {/* Turnout Progress Bar */}
            <div className="w-full max-w-sm h-2.5 rounded-full bg-white/10 overflow-hidden mt-3">
              <div
                className="h-full bg-gradient-to-r from-[#C9A56B] to-emerald-400 transition-all duration-500 rounded-full"
                style={{
                  width: `${enrolledCount > 0 ? Math.min(100, Math.round((presentCount / enrolledCount) * 100)) : 0}%`,
                }}
              />
            </div>
            <div className="flex justify-between text-[11px] font-mono text-[#9AA4B5] max-w-sm pt-0.5">
              <span>
                {enrolledCount > 0
                  ? Math.round((presentCount / enrolledCount) * 100)
                  : 0}
                % turnout
              </span>
              <span>{Math.max(0, enrolledCount - presentCount)} remaining</span>
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 w-full max-w-sm">
            <div className="flex items-center justify-between text-[11px] font-mono text-[#9AA4B5] mb-1">
              <span>Direct access link:</span>
              {classroom && <span className="text-[#C9A56B]">Room {classroom}</span>}
            </div>
            <p className="font-mono text-xs text-[#EDE9E0] font-semibold truncate bg-white/5 p-2 rounded-input border border-white/10">
              {publicUrl}
            </p>
          </div>
        </div>
      </div>

      {/* ── Discreet Bottom Status ──────────────────────────────────── */}
      <div className="flex items-center justify-between text-[11px] font-mono text-[#9AA4B5] pt-4">
        <span>Press Esc to exit projection</span>
      </div>
    </div>
  );
}

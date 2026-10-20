'use client';

import React, { useEffect, useRef } from 'react';
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
  Circle as LeafletCircle,
  LeafletMouseEvent,
} from 'leaflet';
import { Compass } from 'lucide-react';

export interface LocationPickerMapProps {
  lat: number | null;
  lng: number | null;
  radius: number;
  accuracy?: number | null;
  onLocationChange?: (lat: number, lng: number) => void;
  className?: string;
}

export function LocationPickerMap({
  lat,
  lng,
  radius,
  accuracy,
  onLocationChange,
  className = '',
}: LocationPickerMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);

  useEffect(() => {
    // Only load leaflet on browser
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    async function initMap() {
      const L = (await import('leaflet')).default;
      // Import leaflet css
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!isMounted || !mapContainerRef.current) return;

      const centerLat = lat ?? 44.435;
      const centerLng = lng ?? 26.102;

      if (!mapInstanceRef.current) {
        const map = L.map(mapContainerRef.current, {
          zoomControl: true,
          attributionControl: false,
        }).setView([centerLat, centerLng], lat ? 17 : 14);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
        }).addTo(map);

        map.on('click', (e: LeafletMouseEvent) => {
          if (onLocationChange) {
            onLocationChange(e.latlng.lat, e.latlng.lng);
          }
        });

        mapInstanceRef.current = map;
      }

      const map = mapInstanceRef.current;

      if (lat != null && lng != null) {
        map.setView([lat, lng], 17);

        // Update or create marker
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          const icon = L.divIcon({
            className: 'custom-map-marker',
            html: `<div style="width: 24px; height: 24px; background: #B08D57; border: 3px solid #FAF8F4; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;"><div style="width: 6px; height: 6px; background: #FAF8F4; border-radius: 50%;"></div></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        }

        // Update or create radius circle (translucent gold)
        if (circleRef.current) {
          circleRef.current.setLatLng([lat, lng]);
          circleRef.current.setRadius(radius);
        } else {
          circleRef.current = L.circle([lat, lng], {
            radius: radius,
            color: '#B08D57',
            weight: 2,
            opacity: 0.8,
            fillColor: '#B08D57',
            fillOpacity: 0.15,
          }).addTo(map);
        }
      }
    }

    initMap();

    return () => {
      isMounted = false;
    };
  }, [lat, lng, radius, onLocationChange]);

  // Clean SVG Schematic Fallback when no coordinates are captured yet
  if (lat == null || lng == null) {
    return (
      <div
        className={`w-full h-[320px] rounded-card border border-border bg-card/60 flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden ${className}`}
      >
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)`,
            backgroundSize: '24px 24px',
          }}
        />

        <div className="w-14 h-14 rounded-full bg-accent-soft text-accent flex items-center justify-center mb-3 shadow-xs border border-accent/20">
          <Compass className="w-7 h-7" />
        </div>
        <h4 className="font-serif text-sm font-semibold text-foreground">
          Perimetru GPS Neconfigurat
        </h4>
        <p className="text-xs text-muted-foreground max-w-xs mt-1 leading-relaxed">
          Apasă pe butonul &quot;Detectează locația sălii&quot; din formular pentru a activa geofencing-ul anti-proxy și a previzualiza harta.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative rounded-card overflow-hidden border border-border ${className}`}>
      <div ref={mapContainerRef} className="w-full h-[320px] z-10" />

      {/* Floating Info Overlay */}
      <div className="absolute top-3 left-3 z-20 bg-background/90 backdrop-blur-md px-3 py-1.5 rounded-input border border-border shadow-sm text-xs font-mono">
        <span className="text-accent font-semibold">{radius}m</span>
        <span className="text-muted-foreground"> rază perimetru</span>
        {accuracy != null && (
          <span className="text-muted-foreground block text-[10px]">
            Acuratețe GPS: ±{Math.round(accuracy)}m
          </span>
        )}
      </div>
    </div>
  );
}

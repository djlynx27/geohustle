import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface ZoneMarker {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  demandScore?: number;
}

interface LeafletMapProps {
  center: [number, number];
  zoom?: number;
  markers: ZoneMarker[];
  className?: string;
}

function getMarkerColor(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 40) return '#eab308';
  return '#ef4444';
}

export function LeafletMap({ center, zoom = 12, markers, className = '' }: LeafletMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (!mapRef.current) {
      mapRef.current = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);
    }

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update center/zoom
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView(center, zoom);
    }
  }, [center[0], center[1], zoom]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current) return;

    // Remove existing markers
    mapRef.current.eachLayer(layer => {
      if (layer instanceof L.CircleMarker) {
        mapRef.current!.removeLayer(layer);
      }
    });

    markers.forEach(m => {
      const score = m.demandScore ?? 50;
      const color = getMarkerColor(score);

      L.circleMarker([m.latitude, m.longitude], {
        radius: 10,
        fillColor: color,
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.85,
      })
        .addTo(mapRef.current!)
        .bindPopup(
          `<div style="font-family:sans-serif;min-width:120px">
            <strong>${m.name}</strong><br/>
            <span style="text-transform:capitalize">${m.type}</span><br/>
            <span style="color:${color};font-weight:bold">Score: ${score}</span>
          </div>`
        );
    });
  }, [markers]);

  return <div ref={containerRef} className={`w-full h-full ${className}`} />;
}

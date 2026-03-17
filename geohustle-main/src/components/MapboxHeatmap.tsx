import { useRef, useCallback, useState, useEffect } from 'react';
import Map, { Source, Layer, Marker, type MapRef } from 'react-map-gl';
import { LeafletMap } from './LeafletMap';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;

export interface HeatmapZone {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  demandScore?: number;
}

interface MapboxHeatmapProps {
  center: [number, number];
  zoom?: number;
  markers: HeatmapZone[];
  onZoneClick?: (zone: HeatmapZone) => void;
  className?: string;
}

function getMarkerColor(score: number): string {
  if (score >= 70) return 'hsl(142, 71%, 45%)';
  if (score >= 40) return 'hsl(48, 96%, 53%)';
  return 'hsl(0, 84%, 60%)';
}

function DriverDot() {
  return (
    <div className="relative flex items-center justify-center">
      <span className="absolute w-8 h-8 rounded-full bg-pink-500/30 animate-ping" />
      <div className="relative w-7 h-7 rounded-full bg-pink-500 border-2 border-white shadow-lg flex items-center justify-center">
        <svg viewBox="0 0 24 24" className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="3" />
          <line x1="12" y1="3" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="21" />
          <line x1="3" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="21" y2="12" />
        </svg>
      </div>
    </div>
  );
}

export function MapboxHeatmap({ center, zoom = 11, markers, onZoneClick, className = '' }: MapboxHeatmapProps) {
  const mapRef = useRef<MapRef>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Watch driver GPS
  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
      setDriverPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      setLocationError(null);
    },
    (err) => {
      setLocationError(err.message || 'Erreur de géolocalisation');
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Fly to center on change
  const onLoad = useCallback(() => {
    mapRef.current?.flyTo({ center: [center[1], center[0]], zoom, duration: 800 });
  }, [center, zoom]);

  useEffect(() => {
    mapRef.current?.flyTo({ center: [center[1], center[0]], zoom, duration: 800 });
  }, [center[0], center[1], zoom]);

  // GeoJSON for heatmap
  const geojson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection',
    features: markers.map((m) => ({
      type: 'Feature',
      properties: { intensity: (m.demandScore ?? 50) / 100 },
      geometry: { type: 'Point', coordinates: [m.longitude, m.latitude] },
    })),
  };

  const [locationError, setLocationError] = useState<string | null>(null);

  const goToMyLocation = () => {
    if (!driverPos) return;
    mapRef.current?.flyTo({ center: [driverPos.lng, driverPos.lat], zoom: 15, duration: 600 });
  };

  if (!MAPBOX_TOKEN) {
    return (
      <div className={`relative w-full h-full ${className}`}>
        <div className="absolute top-3 left-3 z-30">
          <button onClick={goToMyLocation} disabled={!driverPos} className="rounded-md border border-white/30 bg-white/10 px-3 py-1 text-xs text-white disabled:opacity-50">
            📍 Me localiser
          </button>
        </div>
        <div className="absolute top-14 left-3 right-3 z-20 p-2 rounded border border-white/30 bg-black/60 text-white text-xs text-center">
          Mapbox non configuré&nbsp;: affichage en mode Leaflet fallback.
        </div>
        <div className="absolute inset-0">
          <LeafletMap center={center} zoom={zoom} markers={markers} driverPosition={driverPos || undefined} />
        </div>
      </div>
    );
  }

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div className="absolute top-3 left-3 z-30">
        <button onClick={goToMyLocation} disabled={!driverPos} className="rounded-md border border-white/30 bg-white/10 px-3 py-1 text-xs text-white disabled:opacity-50">
          📍 Me localiser
        </button>
      </div>
      {locationError && (
        <div className="absolute z-20 top-14 left-3 right-3 p-2 rounded bg-red-600/80 text-white text-[11px] text-center">
          ⚠ {locationError}
        </div>
      )}
      <Map
        ref={mapRef}
        initialViewState={{
          longitude: center[1],
          latitude: center[0],
          zoom,
        }}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        style={{ width: '100%', height: '100%' }}
        onLoad={onLoad}
        attributionControl={false}
        reuseMaps
      >
        {/* Heatmap layer */}
        <Source id="zones-heat" type="geojson" data={geojson}>
          <Layer
            id="heatmap-layer"
            type="heatmap"
            paint={{
              'heatmap-weight': ['get', 'intensity'],
              'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 1, 15, 3],
              'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 20, 15, 40],
              'heatmap-opacity': 0.7,
              'heatmap-color': [
                'interpolate',
                ['linear'],
                ['heatmap-density'],
                0, 'rgba(0,0,0,0)',
                0.2, 'hsl(220, 90%, 55%)',
                0.4, 'hsl(190, 90%, 50%)',
                0.6, 'hsl(55, 95%, 55%)',
                0.8, 'hsl(30, 95%, 55%)',
                1.0, 'hsl(0, 85%, 55%)',
              ],
            }}
          />
        </Source>

        {/* Zone circle markers */}
        {markers.map((m) => {
          const score = m.demandScore ?? 50;
          return (
            <Marker key={m.id} longitude={m.longitude} latitude={m.latitude} anchor="center">
              <button
                onClick={(e) => { e.stopPropagation(); onZoneClick?.(m); }}
                className="rounded-full border-2 border-white/80 shadow-md transition-transform hover:scale-125 focus:outline-none"
                style={{
                  width: 18,
                  height: 18,
                  backgroundColor: getMarkerColor(score),
                }}
                aria-label={m.name}
              />
            </Marker>
          );
        })}

        {/* Driver pulsing blue dot */}
        {driverPos && (
          <Marker longitude={driverPos.lng} latitude={driverPos.lat} anchor="center">
            <DriverDot />
          </Marker>
        )}
      </Map>
    </div>
  );
}

import { useMemo } from 'react';
import { useUserLocation, haversineKm } from '@/hooks/useUserLocation';
import { useZones } from '@/hooks/useSupabase';
import { useWeather } from '@/hooks/useWeather';
import { scoreAllZones, type WeatherCondition } from '@/lib/scoringEngine';
import { getDemandLevel } from '@/lib/demandUtils';
import { Navigation } from 'lucide-react';
import { getGoogleMapsNavUrl } from '@/lib/venueCoordinates';

export function NearestHotspot() {
  const { location: userLocation } = useUserLocation(30000);

  const { data: zonesMtl = [] } = useZones('mtl');
  const { data: zonesLvl = [] } = useZones('lvl');
  const { data: zonesLng = [] } = useZones('lng');
  const { data: zonesBlv = [] } = useZones('blv');
  const { data: zonesRsm = [] } = useZones('rsm');
  const { data: zonesSth = [] } = useZones('sth');
  const { data: zonesBsb = [] } = useZones('bsb');
  const { data: zonesTrb = [] } = useZones('trb');
  const { data: weatherMtl } = useWeather('mtl');

  const allZones = useMemo(() => [...zonesMtl, ...zonesLvl, ...zonesLng, ...zonesBlv, ...zonesRsm, ...zonesSth, ...zonesBsb, ...zonesTrb], [zonesMtl, zonesLvl, zonesLng, zonesBlv, zonesRsm, zonesSth, zonesBsb, zonesTrb]);

  const nearest = useMemo(() => {
    if (!userLocation || allZones.length === 0) return null;

    const now = new Date();
    const wc: WeatherCondition | null = weatherMtl ? { weatherId: weatherMtl.weatherId, temp: weatherMtl.temp, demandBoostPoints: weatherMtl.demandBoostPoints } : null;
    const { scores } = scoreAllZones(allZones, now, wc);

    const ranked = allZones
      .map(zone => ({
        ...zone,
        distance: haversineKm(userLocation.latitude, userLocation.longitude, zone.latitude, zone.longitude),
        score: scores.get(zone.id) ?? 40,
      }))
      .sort((a, b) => a.distance - b.distance);

    const hotspot = ranked.find(z => z.score >= 60 && z.distance <= 10);
    return hotspot ?? ranked[0] ?? null;
  }, [userLocation, allZones, weatherMtl]);

  if (!nearest) return null;

  const level = getDemandLevel(nearest.score);
  const borderClass = level === 'high' ? 'border-l-[hsl(var(--demand-high))]' : level === 'medium' ? 'border-l-[hsl(var(--demand-medium))]' : 'border-l-[hsl(var(--demand-low))]';
  const googleUrl = getGoogleMapsNavUrl(nearest.name, nearest.latitude, nearest.longitude);

  return (
    <div className="fixed bottom-[4.5rem] inset-x-0 z-30 px-2">
      <div className={`flex items-center gap-3 bg-card border border-border border-l-4 ${borderClass} rounded-xl h-[72px] px-4 shadow-lg shadow-background/50`}>
        <div className="flex-1 min-w-0">
          <span className="text-[16px] font-display font-bold block truncate">
            📍 {nearest.name}
          </span>
          <span className="text-[14px] text-muted-foreground font-body">
            {nearest.score}/100 · {nearest.distance.toFixed(1)} km
          </span>
        </div>
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0 flex items-center justify-center gap-1 bg-primary text-primary-foreground font-display font-bold text-[16px] rounded-lg h-12 w-16 hover:bg-primary/90 transition-colors"
        >
          GO <Navigation className="w-4 h-4" />
        </a>
      </div>
    </div>
  );
}

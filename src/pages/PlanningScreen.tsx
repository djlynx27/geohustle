import { useState, useMemo, useRef, useCallback, type FormEvent } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { CitySelect } from '@/components/CitySelect';
import { DemandBadge } from '@/components/DemandBadge';
import { useCities, useZones } from '@/hooks/useSupabase';
import { generate96TimeLabels, getDemandClass, getSlotOrderMinutes, normalize24hTime, formatTime24h } from '@/lib/demandUtils';
import { computeDemandScore, type WeatherCondition } from '@/lib/scoringEngine';
import { useWeather } from '@/hooks/useWeather';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUserLocation, haversineKm } from '@/hooks/useUserLocation';
import { NavigationSheet } from '@/components/NavigationSheet';
import { useCityId } from '@/hooks/useCityId';

const TIME_LABELS = generate96TimeLabels();

export default function PlanningScreen() {
  const { t } = useI18n();
  const [cityId, setCityId] = useCityId();
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [jumpTime, setJumpTime] = useState('');
  const [highlightTime, setHighlightTime] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const slotRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const { location: userLocation } = useUserLocation();

  const [navZone, setNavZone] = useState<{ name: string; lat: number; lng: number } | null>(null);

  const { data: cities = [] } = useCities();
  const { data: zones = [] } = useZones(cityId);
  const { data: weather } = useWeather(cityId);

  const slots = useMemo(() => {
    if (zones.length === 0) return [];

    const weatherCond: WeatherCondition | null = weather ? { weatherId: weather.weatherId, temp: weather.temp, demandBoostPoints: weather.demandBoostPoints } : null;
    const timeLabels = generate96TimeLabels();
    const items: any[] = [];

    for (const startTime of timeLabels) {
      const [hours, minutes] = startTime.split(':').map(Number);
      const endDate = new Date(2000, 0, 1, hours, minutes + 15);
      const endTime = formatTime24h(endDate);

      // Use a date object for scoring at this specific time
      const slotDate = new Date(date + 'T00:00:00');
      slotDate.setHours(hours, minutes, 0, 0);

      for (const zone of zones) {
        const { score } = computeDemandScore(zone, slotDate, weatherCond);
        items.push({
          id: `plan-${date}-${zone.id}-${startTime}`,
          start_time: startTime,
          end_time: endTime,
          zone_id: zone.id,
          demand_score: score,
          zones: zone,
        });
      }
    }

    // Group by HOUR, keep only top 3 zones per hour (best slot per zone)
    const hourGroups = new Map<number, typeof items>();
    for (const item of items) {
      const [h] = item.start_time.split(':').map(Number);
      const arr = hourGroups.get(h) ?? [];
      arr.push(item);
      hourGroups.set(h, arr);
    }

    const result: typeof items = [];
    for (const [, group] of hourGroups) {
      // Per zone, keep only the best-scoring slot within this hour
      const bestPerZone = new Map<string, (typeof items)[0]>();
      for (const item of group) {
        const existing = bestPerZone.get(item.zone_id);
        if (!existing || (item.demand_score ?? 0) > (existing.demand_score ?? 0)) {
          bestPerZone.set(item.zone_id, item);
        }
      }
      const deduped = [...bestPerZone.values()];
      deduped.sort((a, b) => {
        const scoreDiff = (b.demand_score ?? 0) - (a.demand_score ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        if (userLocation) {
          const dA = haversineKm(userLocation.latitude, userLocation.longitude, a.zones.latitude, a.zones.longitude);
          const dB = haversineKm(userLocation.latitude, userLocation.longitude, b.zones.latitude, b.zones.longitude);
          return dA - dB;
        }
        return 0;
      });
      result.push(...deduped.slice(0, 3));
    }

    return result.sort((a, b) => {
      const timeDiff = getSlotOrderMinutes(a.start_time) - getSlotOrderMinutes(b.start_time);
      if (timeDiff !== 0) return timeDiff;
      return (b.demand_score ?? 0) - (a.demand_score ?? 0);
    });
  }, [zones, cityId, date, userLocation, weather]);

  const fmtTime = normalize24hTime;

  const scrollAndHighlight = useCallback((time: string) => {
    const target = normalize24hTime(time);
    let bestEl: HTMLDivElement | null = null;
    let bestDiff = Infinity;
    const targetKey = getSlotOrderMinutes(target);

    slotRefs.current.forEach((el, key) => {
      const diff = Math.abs(getSlotOrderMinutes(key) - targetKey);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestEl = el;
      }
    });

    bestEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightTime(target);
    setTimeout(() => setHighlightTime(null), 3000);
  }, []);

  const handleJumpSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (/^\d{1,2}:\d{2}$/.test(jumpTime)) {
      scrollAndHighlight(normalize24hTime(jumpTime));
    }
  };

  const setSlotRef = useCallback((time: string, el: HTMLDivElement | null) => {
    if (el) slotRefs.current.set(time, el);
    else slotRefs.current.delete(time);
  }, []);

  return (
    <div className="flex flex-col h-full pb-36">
      <div className="px-3 pt-3 pb-2 space-y-2">
        <h1 className="text-[22px] font-display font-bold">{t('planning')}</h1>
        <div className="grid grid-cols-2 gap-2">
          <CitySelect cities={cities} value={cityId} onChange={setCityId} />
          <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-card border-border font-body text-[14px] h-11" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select onValueChange={scrollAndHighlight}>
            <SelectTrigger className="bg-card border-border font-body text-[14px] h-11">
              <SelectValue placeholder="⏱ Aller à..." />
            </SelectTrigger>
            <SelectContent className="bg-card border-border max-h-60">
              {TIME_LABELS.map(label => (
                <SelectItem key={label} value={label}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <form onSubmit={handleJumpSubmit} className="flex gap-1">
            <Input
              placeholder="ex: 19:30"
              value={jumpTime}
              onChange={e => setJumpTime(e.target.value)}
              className="bg-card border-border font-body text-[14px] h-11"
            />
          </form>
        </div>

        <p className="text-[14px] text-muted-foreground font-body">{t('schedule')} · {date}</p>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-3 space-y-1.5 pb-4">
        {slots.map((slot, index) => {
          const zone = slot.zones ?? zones.find(z => z.id === slot.zone_id);
          const dc = getDemandClass(slot.demand_score);
          const timeKey = fmtTime(slot.start_time);
          const isHighlighted = highlightTime !== null && timeKey === highlightTime;
          const dist = userLocation && zone
            ? haversineKm(userLocation.latitude, userLocation.longitude, zone.latitude, zone.longitude)
            : null;

          return (
            <div
              key={slot.id || index}
              ref={el => setSlotRef(timeKey, el)}
              onClick={() => zone && setNavZone({ name: zone.name, lat: zone.latitude, lng: zone.longitude })}
              className={`flex items-center justify-between bg-card rounded-xl border-l-4 ${dc.border} border border-border p-4 gap-3 transition-all duration-500 cursor-pointer active:scale-[0.98] ${
                isHighlighted ? 'ring-2 ring-primary bg-primary/20 border-primary shadow-lg shadow-primary/30' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <span className="text-[14px] text-muted-foreground font-body block">{fmtTime(slot.start_time).split(':')[0]}:00 – {fmtTime(slot.start_time).split(':')[0]}:59</span>
                <span className="text-[18px] font-display font-semibold leading-tight block break-words">
                  {zone?.name}
                  {dist !== null && <span className="text-muted-foreground text-[14px] font-body ml-2">· {dist.toFixed(1)} km</span>}
                </span>
              </div>
              <div className="flex-shrink-0">
                <DemandBadge score={slot.demand_score} size="lg" />
              </div>
            </div>
          );
        })}
      </div>

      <NavigationSheet
        open={!!navZone}
        onClose={() => setNavZone(null)}
        zoneName={navZone?.name ?? ''}
        latitude={navZone?.lat ?? 0}
        longitude={navZone?.lng ?? 0}
      />
    </div>
  );
}

import { useState, useEffect, useMemo } from 'react';
import { useZones } from '@/hooks/useSupabase';
import { useWeather } from '@/hooks/useWeather';
import { useEvents, getActiveEvents, getEndingSoonEvents, getStartingSoonEvents } from '@/hooks/useEvents';
import { useTicketmasterEvents, getRelevantTmEvents } from '@/hooks/useTicketmaster';
import { useZoneScores } from '@/hooks/useZoneScores';
import { scoreAllZonesWithLearning, type WeatherCondition, type ActiveEventBoost } from '@/lib/scoringEngine';
import { haversineKm } from '@/hooks/useUserLocation';

export interface ScoreFactors {
  hasWeatherBoost: boolean;
  hasEventBoost: boolean;
  weatherBoostPoints: number;
  eventBoostPoints: number;
}

/**
 * Hook that provides demand scores for all zones in a city.
 * Primary source: DB scores (calculated by edge function every 30min).
 * Fallback: client-side calculation using weather + events.
 */
export function useDemandScores(cityId: string) {
  const { data: zones = [] } = useZones(cityId);
  const { data: weather } = useWeather(cityId);
  const { data: events = [] } = useEvents(cityId);
  const { data: tmEvents = [] } = useTicketmasterEvents(cityId);
  const { data: dbScores = [] } = useZoneScores(cityId);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const weatherCondition: WeatherCondition | null = useMemo(() => {
    if (!weather) return null;
    return {
      weatherId: weather.weatherId,
      temp: weather.temp,
      demandBoostPoints: weather.demandBoostPoints,
    };
  }, [weather]);

  const activeEvents = useMemo(() => getActiveEvents(events, now), [events, now]);
  const endingSoon = useMemo(() => getEndingSoonEvents(events, now, 60), [events, now]);
  const startingSoon = useMemo(() => getStartingSoonEvents(events, now, 90), [events, now]);
  const relevantTmEvents = useMemo(() => getRelevantTmEvents(tmEvents, now, 3), [tmEvents, now]);

  const eventBoosts: ActiveEventBoost[] = useMemo(() => {
    const dbBoosts: ActiveEventBoost[] = activeEvents.map(e => ({
      latitude: e.latitude,
      longitude: e.longitude,
      boost_multiplier: e.boost_multiplier,
      boost_radius_km: e.boost_radius_km,
      boost_zone_types: e.boost_zone_types,
    }));

    const tmBoosts: ActiveEventBoost[] = relevantTmEvents.map(e => ({
      latitude: e.latitude,
      longitude: e.longitude,
      boost_multiplier: 1 + e.boostPoints / 50,
      boost_radius_km: 2,
      boost_zone_types: [],
    }));

    return [...dbBoosts, ...tmBoosts];
  }, [activeEvents, relevantTmEvents]);

  // Build score maps: prefer DB scores, fallback to client-side
  const { scores, factors } = useMemo(() => {
    // DB scores indexed by zone_id
    const dbScoreMap = new Map(dbScores.map(s => [s.zone_id, s]));

    if (dbScoreMap.size > 0) {
      // Use DB scores as primary
      const scores = new Map<string, number>();
      const factors = new Map<string, ScoreFactors>();

      for (const zone of zones) {
        const dbRow = dbScoreMap.get(zone.id);
        if (dbRow) {
          scores.set(zone.id, dbRow.final_score);
          factors.set(zone.id, {
            hasWeatherBoost: dbRow.weather_boost > 0,
            hasEventBoost: dbRow.event_boost > 0,
            weatherBoostPoints: dbRow.weather_boost,
            eventBoostPoints: dbRow.event_boost,
          });
        } else {
          // Zone has no DB score yet, use current_score from zone
          scores.set(zone.id, (zone as any).current_score ?? 50);
          factors.set(zone.id, { hasWeatherBoost: false, hasEventBoost: false, weatherBoostPoints: 0, eventBoostPoints: 0 });
        }
      }

      return { scores, factors };
    }

    // Fallback: client-side calculation avec agents IA d'apprentissage
    return scoreAllZonesWithLearning(zones, now, weatherCondition, eventBoosts, []);
  }, [zones, dbScores, now, weatherCondition, eventBoosts]);

  return { scores, factors, zones, weather, now, activeEvents, endingSoon, startingSoon, relevantTmEvents };
}

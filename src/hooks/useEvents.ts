import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AppEvent {
  id: string;
  name: string;
  venue: string;
  city_id: string;
  latitude: number;
  longitude: number;
  start_at: string;
  end_at: string;
  capacity: number;
  demand_impact: number;
  boost_multiplier: number;
  boost_radius_km: number;
  boost_zone_types: string[];
  category: string;
  is_holiday: boolean;
}

export function useEvents(cityId?: string) {
  return useQuery<AppEvent[]>({
    queryKey: ['events', cityId ?? 'all'],
    queryFn: async () => {
      let q = supabase.from('events').select('*').order('start_at');
      if (cityId) q = q.eq('city_id', cityId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AppEvent[];
    },
  });
}

/** Get events active right now or within the next `windowMinutes` */
export function getActiveEvents(events: AppEvent[], now: Date, windowMinutes = 60): AppEvent[] {
  const nowMs = now.getTime();
  return events.filter(e => {
    const start = new Date(e.start_at).getTime();
    const end = new Date(e.end_at).getTime();
    // Active: started and not yet ended + window
    return nowMs >= start && nowMs <= end + windowMinutes * 60_000;
  });
}

/** Get events ending within X minutes */
export function getEndingSoonEvents(events: AppEvent[], now: Date, withinMinutes = 60): AppEvent[] {
  const nowMs = now.getTime();
  return events.filter(e => {
    const end = new Date(e.end_at).getTime();
    const diff = end - nowMs;
    return diff > 0 && diff <= withinMinutes * 60_000;
  });
}

/** Get events starting within X minutes (not yet started) */
export function getStartingSoonEvents(events: AppEvent[], now: Date, withinMinutes = 90): AppEvent[] {
  const nowMs = now.getTime();
  return events.filter(e => {
    const start = new Date(e.start_at).getTime();
    const diff = start - nowMs;
    return diff > 0 && diff <= withinMinutes * 60_000;
  });
}

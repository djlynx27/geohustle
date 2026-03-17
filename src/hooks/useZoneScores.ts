import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ZoneScore {
  id: string;
  zone_id: string;
  score: number;
  weather_boost: number;
  event_boost: number;
  final_score: number;
  calculated_at: string;
}

/**
 * Fetch the latest calculated scores for all zones in a city.
 * Falls back to zone.current_score if no score rows exist yet.
 */
export function useZoneScores(cityId: string) {
  return useQuery<ZoneScore[]>({
    queryKey: ['zone-scores', cityId],
    queryFn: async () => {
      // Get the latest scores by joining with zones for city filter
      const { data, error } = await supabase
        .from('scores')
        .select('*, zones!inner(city_id)')
        .eq('zones.city_id', cityId)
        .order('calculated_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      
      // Deduplicate: keep only the latest score per zone
      const latest = new Map<string, ZoneScore>();
      for (const row of (data ?? [])) {
        if (!latest.has(row.zone_id)) {
          latest.set(row.zone_id, row as unknown as ZoneScore);
        }
      }
      return Array.from(latest.values());
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}


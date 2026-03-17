import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type City = Tables<'cities'>;
export type Zone = Tables<'zones'>;
export type TimeSlotRow = Tables<'time_slots'>;
export type TimeSlotWithZone = TimeSlotRow & { zones: Zone | null };

// Cities
export function useCities() {
  return useQuery({
    queryKey: ['cities'],
    queryFn: async () => {
      const { data, error } = await supabase.from('cities').select('*').order('name');
      if (error) throw error;
      return data as City[];
    },
  });
}

export function useAddCity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (city: TablesInsert<'cities'>) => {
      const { error } = await supabase.from('cities').insert(city);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cities'] }),
  });
}

// Zones
export function useZones(cityId: string) {
  return useQuery({
    queryKey: ['zones', cityId],
    queryFn: async () => {
      const { data, error } = await supabase.from('zones').select('*').eq('city_id', cityId).order('name');
      if (error) throw error;
      return data as Zone[];
    },
    enabled: !!cityId,
  });
}

export function useAddZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (zone: TablesInsert<'zones'>) => {
      const { error } = await supabase.from('zones').insert(zone);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  });
}

export function useUpdateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; type?: string; latitude?: number; longitude?: number }) => {
      const { error } = await supabase.from('zones').update(updates as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  });
}

export function useDeleteZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('zones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['zones'] }),
  });
}

// Time Slots
export function useTimeSlots(cityId: string, date: string) {
  return useQuery({
    queryKey: ['time_slots', cityId, date],
    queryFn: async () => {
      const pageSize = 1000;
      const allRows: TimeSlotWithZone[] = [];

      for (let from = 0; ; from += pageSize) {
        const to = from + pageSize - 1;
        const { data, error } = await supabase
          .from('time_slots')
          .select('*, zones(*)')
          .eq('city_id', cityId)
          .eq('date', date)
          .order('start_time')
          .range(from, to);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allRows.push(...data);

        if (data.length < pageSize) break;
      }

      return allRows;
    },
    enabled: !!cityId && !!date,
  });
}

export function useBulkInsertTimeSlots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (slots: TablesInsert<'time_slots'>[]) => {
      // Delete existing slots for that city+date first
      if (slots.length > 0) {
        await supabase.from('time_slots').delete().eq('city_id', slots[0].city_id).eq('date', slots[0].date);
      }
      // Insert in batches of 500
      for (let i = 0; i < slots.length; i += 500) {
        const batch = slots.slice(i, i + 500);
        const { error } = await supabase.from('time_slots').insert(batch);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['time_slots'] }),
  });
}

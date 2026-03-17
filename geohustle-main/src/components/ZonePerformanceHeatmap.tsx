import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3 } from 'lucide-react';
import type { Zone } from '@/hooks/useSupabase';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = [
  { value: '1', label: 'Lun' },
  { value: '2', label: 'Mar' },
  { value: '3', label: 'Mer' },
  { value: '4', label: 'Jeu' },
  { value: '5', label: 'Ven' },
  { value: '6', label: 'Sam' },
  { value: '0', label: 'Dim' },
];

function useZonePerformance() {
  return useQuery({
    queryKey: ['zone-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('zone_id, earnings, tips, started_at, ended_at')
        .not('zone_id', 'is', null)
        .order('started_at', { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60_000,
  });
}

interface Props {
  zones: Zone[];
}

export function ZonePerformanceHeatmap({ zones }: Props) {
  const [hour, setHour] = useState(String(new Date().getHours()));
  const [day, setDay] = useState(String(new Date().getDay()));
  const { data: trips = [] } = useZonePerformance();

  const zoneColors = useMemo(() => {
    const selectedHour = parseInt(hour);
    const selectedDay = parseInt(day);

    // Filter trips matching selected hour and day
    const matching = trips.filter(t => {
      const d = new Date(t.started_at);
      return d.getHours() === selectedHour && d.getDay() === selectedDay;
    });

    // Calculate earnings/h per zone
    const zoneStats: Record<string, { totalEarnings: number; totalHours: number }> = {};
    for (const t of matching) {
      if (!t.zone_id) continue;
      if (!zoneStats[t.zone_id]) zoneStats[t.zone_id] = { totalEarnings: 0, totalHours: 0 };
      zoneStats[t.zone_id].totalEarnings += Number(t.earnings || 0) + Number(t.tips || 0);
      if (t.started_at && t.ended_at) {
        zoneStats[t.zone_id].totalHours += (new Date(t.ended_at).getTime() - new Date(t.started_at).getTime()) / 3_600_000;
      }
    }

    const earningsPerHour: Record<string, number> = {};
    for (const [zid, s] of Object.entries(zoneStats)) {
      earningsPerHour[zid] = s.totalHours > 0 ? s.totalEarnings / s.totalHours : 0;
    }

    const values = Object.values(earningsPerHour);
    if (values.length === 0) return new Map<string, 'green' | 'yellow' | 'red' | 'grey'>();

    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    const result = new Map<string, 'green' | 'yellow' | 'red' | 'grey'>();
    for (const z of zones) {
      const eph = earningsPerHour[z.id];
      if (eph === undefined) {
        result.set(z.id, 'grey');
      } else if (eph >= avg * 1.2) {
        result.set(z.id, 'green');
      } else if (eph >= avg * 0.8) {
        result.set(z.id, 'yellow');
      } else {
        result.set(z.id, 'red');
      }
    }
    return result;
  }, [trips, hour, day, zones]);

  const colorLabels = { green: 'Au-dessus', yellow: 'Moyen', red: 'En-dessous', grey: 'Pas de données' };
  const colorClasses = {
    green: 'bg-green-500/20 border-green-500/40 text-green-400',
    yellow: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400',
    red: 'bg-red-500/20 border-red-500/40 text-red-400',
    grey: 'bg-muted/20 border-border text-muted-foreground',
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-[14px] font-display font-bold">Performance par zone</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Select value={hour} onValueChange={setHour}>
          <SelectTrigger className="bg-background border-border text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border max-h-60">
            {HOURS.map(h => (
              <SelectItem key={h} value={String(h)}>{String(h).padStart(2, '0')}:00</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={day} onValueChange={setDay}>
          <SelectTrigger className="bg-background border-border text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-card border-border">
            {DAYS.map(d => (
              <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Legend */}
      <div className="flex gap-2 text-[11px]">
        {(['green', 'yellow', 'red', 'grey'] as const).map(c => (
          <span key={c} className={`px-2 py-0.5 rounded border ${colorClasses[c]}`}>
            {colorLabels[c]}
          </span>
        ))}
      </div>

      {/* Zone list with colors */}
      <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
        {zones.map(z => {
          const color = zoneColors.get(z.id) || 'grey';
          return (
            <div key={z.id} className={`rounded-lg border px-3 py-2 ${colorClasses[color]}`}>
              <span className="text-[13px] font-display font-semibold">{z.name}</span>
              <span className="text-[11px] ml-2 capitalize opacity-70">{z.type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

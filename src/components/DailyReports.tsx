import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, TrendingUp, MapPin, Clock, Sparkles } from 'lucide-react';

function useReports() {
  return useQuery({
    queryKey: ['daily-reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_reports')
        .select('*')
        .order('report_date', { ascending: false })
        .limit(14);
      if (error) throw error;
      return data;
    },
  });
}

export function DailyReports() {
  const { data: reports = [] } = useReports();

  if (reports.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" /> Rapports quotidiens
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">Aucun rapport généré. Les rapports sont créés automatiquement à 23h30 chaque jour.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-display flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Rapports quotidiens
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {reports.map((r: any) => (
          <div key={r.id} className="bg-background rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-display font-bold">
                {new Date(r.report_date + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <Badge variant="secondary" className="text-xs">{r.total_trips || 0} courses</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <span className="text-[11px] text-muted-foreground block">Gains</span>
                <span className="text-[16px] font-display font-bold text-primary">${Number(r.total_earnings || 0).toFixed(0)}</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Distance</span>
                <span className="text-[16px] font-display font-bold">{Number(r.total_distance_km || 0).toFixed(0)} km</span>
              </div>
              <div>
                <span className="text-[11px] text-muted-foreground block">Heures</span>
                <span className="text-[16px] font-display font-bold">{Number(r.hours_worked || 0).toFixed(1)}h</span>
              </div>
            </div>
            <div className="flex gap-3 text-[12px] text-muted-foreground">
              {r.best_zone_name && (
                <span className="flex items-center gap-1"><MapPin className="w-3 h-3 text-green-400" /> {r.best_zone_name}</span>
              )}
              {r.best_time_slot && (
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {r.best_time_slot}</span>
              )}
            </div>
            {r.dead_time_pct > 0 && (
              <div className="text-[12px] text-yellow-500">⏱️ Temps mort: {Number(r.dead_time_pct).toFixed(0)}%</div>
            )}
            {r.ai_recommendation && (
              <div className="flex items-start gap-1.5 text-[12px] text-muted-foreground italic bg-primary/5 rounded px-2 py-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                {r.ai_recommendation}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

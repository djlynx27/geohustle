import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Target } from 'lucide-react';

const LS_KEY = 'geohustle_weekly_goal';

function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    from: monday.toISOString().split('T')[0],
    to: sunday.toISOString().split('T')[0],
    dayOfWeek: day === 0 ? 7 : day, // 1=Mon..7=Sun
  };
}

function useWeekTripsEarnings() {
  const { from, to } = getWeekRange();
  return useQuery({
    queryKey: ['week-earnings', from],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('earnings, tips')
        .gte('started_at', `${from}T00:00:00`)
        .lte('started_at', `${to}T23:59:59`);
      if (error) throw error;
      return (data ?? []).reduce((sum, t) => sum + Number(t.earnings || 0) + Number(t.tips || 0), 0);
    },
    staleTime: 60_000,
  });
}

export function WeeklyGoalDisplay() {
  const [goal, setGoal] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved ? Number(saved) : 0;
  });
  const { data: weekEarnings = 0 } = useWeekTripsEarnings();
  const { dayOfWeek } = getWeekRange();

  if (goal <= 0) return null;

  const pct = Math.min(100, Math.round((weekEarnings / goal) * 100));
  const expectedPct = Math.round((dayOfWeek / 7) * 100);

  let status: { label: string; color: string };
  if (pct >= expectedPct + 5) {
    status = { label: 'En avance', color: 'text-green-400' };
  } else if (pct >= expectedPct - 10) {
    status = { label: 'Dans les temps', color: 'text-yellow-400' };
  } else {
    status = { label: 'En retard', color: 'text-red-400' };
  }

  return (
    <div className="bg-card rounded-xl border border-border px-4 py-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-[14px] font-body text-muted-foreground">Objectif semaine</span>
        </div>
        <span className={`text-[14px] font-display font-bold ${status.color}`}>{status.label}</span>
      </div>
      <Progress value={pct} className="h-2.5" />
      <div className="flex justify-between text-[13px] font-body">
        <span className="text-foreground font-display font-bold">${weekEarnings.toFixed(0)} / ${goal}</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
    </div>
  );
}

export function WeeklyGoalSetting() {
  const [goal, setGoal] = useState(() => {
    const saved = localStorage.getItem(LS_KEY);
    return saved || '';
  });

  function save(val: string) {
    setGoal(val);
    localStorage.setItem(LS_KEY, val);
  }

  return (
    <div className="flex items-center gap-2">
      <Target className="w-4 h-4 text-primary flex-shrink-0" />
      <span className="text-[14px] font-body text-muted-foreground whitespace-nowrap">Objectif semaine $</span>
      <input
        type="number"
        value={goal}
        onChange={e => save(e.target.value)}
        placeholder="ex: 1500"
        className="flex-1 bg-background border border-border rounded-md px-2 py-1.5 text-[14px] font-display"
      />
    </div>
  );
}

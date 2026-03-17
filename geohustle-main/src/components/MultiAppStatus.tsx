import { useMemo } from 'react';
import { useWeather } from '@/hooks/useWeather';
import { Smartphone } from 'lucide-react';

interface AppRec {
  name: string;
  icon: string;
  on: boolean;
  reason: string;
}

function getRecommendations(hour: number, dayOfWeek: number, isBadWeather: boolean): AppRec[] {
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isMealTime = (hour >= 11 && hour <= 13) || (hour >= 17 && hour <= 21);
  const isLateNight = hour >= 22 || hour < 5;
  const isMorningRush = hour >= 6 && hour <= 9;
  const isAfternoonRush = hour >= 15 && hour <= 18;

  return [
    {
      name: 'Lyft',
      icon: '🚗',
      on: isMorningRush || isAfternoonRush || isLateNight || isBadWeather || isWeekend,
      reason: isBadWeather ? 'Mauvais temps = forte demande' :
        isLateNight ? 'Forte demande nocturne' :
        isMorningRush || isAfternoonRush ? 'Heure de pointe' :
        isWeekend ? 'Weekend actif' : 'Demande faible',
    },
    {
      name: 'Skip',
      icon: '🍔',
      on: isMealTime || isBadWeather,
      reason: isMealTime ? 'Heure de repas' :
        isBadWeather ? 'Livraisons en hausse' : 'Hors heures de repas',
    },
    {
      name: 'DoorDash',
      icon: '🛵',
      on: isMealTime || isBadWeather || isWeekend,
      reason: isMealTime ? 'Heure de repas' :
        isBadWeather ? 'Mauvais temps boost' :
        isWeekend ? 'Weekend chargé' : 'Hors heures de pointe',
    },
    {
      name: 'EVA',
      icon: '🚕',
      on: isMorningRush || isAfternoonRush || isWeekend,
      reason: isMorningRush || isAfternoonRush ? 'Heure de pointe' :
        isWeekend ? 'Weekend actif' : 'Demande limitée',
    },
  ];
}

interface Props {
  cityId: string;
}

export function MultiAppStatus({ cityId }: Props) {
  const { data: weather } = useWeather(cityId);
  const now = new Date();

  const apps = useMemo(() => {
    return getRecommendations(now.getHours(), now.getDay(), weather?.isBadWeather ?? false);
  }, [now.getHours(), now.getDay(), weather?.isBadWeather]);

  return (
    <div className="bg-card rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Smartphone className="w-4 h-4 text-primary" />
        <span className="text-[14px] font-display font-bold">Status recommandé</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {apps.map(app => (
          <div
            key={app.name}
            className={`rounded-lg border px-3 py-2.5 ${
              app.on
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-muted/20 border-border'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">{app.icon}</span>
              <span className="text-[14px] font-display font-bold">{app.name}</span>
              <span className={`text-[11px] font-body font-bold ml-auto ${
                app.on ? 'text-green-400' : 'text-muted-foreground'
              }`}>
                {app.on ? 'ON' : 'OFF'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-body mt-0.5">{app.reason}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

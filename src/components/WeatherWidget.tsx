import { useWeather } from '@/hooks/useWeather';
import { CloudRain } from 'lucide-react';

export function WeatherWidget({ cityId }: { cityId: string }) {
  const { data, isLoading } = useWeather(cityId);

  if (isLoading || !data) return null;

  return (
    <div className="flex items-center gap-1.5 min-w-0">
      <span className="text-lg flex-shrink-0">{data.icon}</span>
      <span className="text-[14px] font-display font-bold flex-shrink-0">{data.temp}°C</span>
      {data.isBadWeather && (
        <CloudRain className="w-4 h-4 text-primary flex-shrink-0" />
      )}
      {data.precipProbability > 40 && (
        <span className="text-[12px] text-muted-foreground font-body flex-shrink-0">
          💧{data.precipProbability}%
        </span>
      )}
    </div>
  );
}

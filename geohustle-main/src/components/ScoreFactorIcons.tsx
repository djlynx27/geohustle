import { CloudRain, CalendarCheck } from 'lucide-react';
import type { ScoreFactors } from '@/hooks/useDemandScores';

interface ScoreFactorIconsProps {
  factors: ScoreFactors | undefined;
}

/**
 * Small inline icons showing which factors boosted the demand score.
 */
export function ScoreFactorIcons({ factors }: ScoreFactorIconsProps) {
  if (!factors) return null;
  const { hasWeatherBoost, hasEventBoost, weatherBoostPoints, eventBoostPoints } = factors;

  if (!hasWeatherBoost && !hasEventBoost) return null;

  return (
    <span className="inline-flex items-center gap-1 ml-1">
      {hasWeatherBoost && (
        <span className="inline-flex items-center gap-0.5 text-primary" title={`Météo +${weatherBoostPoints}`}>
          <CloudRain className="w-3.5 h-3.5" />
          {weatherBoostPoints > 0 && <span className="text-[11px] font-body font-semibold">+{weatherBoostPoints}</span>}
        </span>
      )}
      {hasEventBoost && (
        <span className="inline-flex items-center gap-0.5 text-accent-foreground" title={`Événement +${eventBoostPoints}`}>
          <CalendarCheck className="w-3.5 h-3.5" />
          {eventBoostPoints > 0 && <span className="text-[11px] font-body font-semibold">+{eventBoostPoints}</span>}
        </span>
      )}
    </span>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useCityId } from '@/hooks/useCityId';
import { useDemandScores } from '@/hooks/useDemandScores';
import { useUserLocation, haversineKm } from '@/hooks/useUserLocation';
import { CitySelect } from '@/components/CitySelect';
import { useCities } from '@/hooks/useSupabase';
import { DemandBadge } from '@/components/DemandBadge';
import { getGoogleMapsNavUrl, getWazeNavUrl } from '@/lib/venueCoordinates';
import { Button } from '@/components/ui/button';
import { Navigation } from 'lucide-react';
import { DeadTimeTimer } from '@/components/DeadTimeTimer';
import { WeeklyGoalDisplay } from '@/components/WeeklyGoal';

export default function DriveScreen() {
  const { t, lang } = useI18n();
  const [cityId, setCityId] = useCityId();
  const { data: cities = [] } = useCities();
  const { scores, factors, zones } = useDemandScores(cityId);
  const { location, status } = useUserLocation(15000);

  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function requestWakeLock() {
      if (typeof navigator === "undefined") return;
      // @ts-expect-error: wakeLock is not yet in TS lib
      if (!("wakeLock" in navigator)) return;
      try {
        // @ts-expect-error: wakeLock is not yet in TS lib
        const wl = await navigator.wakeLock.request("screen");
        if (cancelled) {
          wl.release();
          return;
        }
        wakeLockRef.current = wl;
        wl.addEventListener("release", () => {
          if (wakeLockRef.current === wl) {
            wakeLockRef.current = null;
          }
        });
      } catch {
        // silently ignore wake lock failures
      }
    }

    if (document.visibilityState === "visible") {
      requestWakeLock();
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        requestWakeLock();
      } else if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release();
        wakeLockRef.current = null;
      }
    };
  }, []);

  const rankedZones = useMemo(() => {
    return zones
      .map(z => ({ ...z, score: scores.get(z.id) ?? 0 }))
      .sort((a, b) => b.score - a.score);
  }, [zones, scores]);

  const heroZone = rankedZones[0] ?? null;

  const heroDistance = heroZone && location
    ? haversineKm(location.latitude, location.longitude, heroZone.latitude, heroZone.longitude)
    : null;

  const statusLabel =
    status === 'loading'
      ? t('gettingLocation')
      : status === 'error'
        ? `${t('locationUnavailable')} - ${t('locationPermissionTip')}`
        : '';

  return (
    <div className="flex flex-col h-full pb-36 bg-background text-foreground">
      {/* Top bar: city + status */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-3">
        <div className="w-[160px] flex-shrink-0">
          <CitySelect cities={cities} value={cityId} onChange={setCityId} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-muted-foreground font-body truncate">
            {statusLabel || (heroZone
              ? t('readyToDrive')
              : t('loadingZones'))}
          </p>
        </div>
      </div>

      {/* Dead time + weekly goal in compact form */}
      <div className="px-4 space-y-2">
        <DeadTimeTimer nearestZoneName={heroZone?.name} />
        <WeeklyGoalDisplay />
      </div>

      {/* Full-screen hero card */}
      <div className="flex-1 flex items-center justify-center px-4">
        <div className="w-full max-w-md bg-card rounded-3xl border border-border px-5 py-6 space-y-4 shadow-lg">
          <p className="text-[13px] font-body uppercase tracking-wide text-muted-foreground text-center">
            {t('bestZoneNow')}
          </p>

          {heroZone ? (
            <>
              <div className="flex flex-col items-center text-center space-y-1">
                <h1 className="text-[32px] font-display font-bold leading-tight break-words">
                  {heroZone.name}
                </h1>
                <p className="text-[16px] text-muted-foreground capitalize">
                  {heroZone.type}
                </p>
                {heroDistance !== null && (
                  <p className="text-[20px] font-display font-semibold text-muted-foreground mt-1">
                    📍 {heroDistance.toFixed(1)} km
                  </p>
                )}
              </div>

              <div className="flex justify-center">
                <DemandBadge score={heroZone.score} size="giant" />
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  asChild
                  className="w-full h-16 text-[18px] font-display font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  <a
                    href={getGoogleMapsNavUrl(heroZone.name, heroZone.latitude, heroZone.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Navigation className="w-5 h-5" />
                    {t('goGoogleMaps')}
                  </a>
                </Button>
                <Button
                  asChild
                  variant="secondary"
                  className="w-full h-16 text-[18px] font-display font-bold gap-2"
                >
                  <a
                    href={getWazeNavUrl(heroZone.name, heroZone.latitude, heroZone.longitude)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🧭 {t('waze')}
                  </a>
                </Button>
              </div>
            </>
          ) : (
            <p className="text-[16px] text-muted-foreground font-body text-center">
              {t('noZonesAvailable')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}


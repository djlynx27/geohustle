/**
 * Smart time-based demand boost logic for zone recommendations
 */

export interface TimeBoost {
  zoneTypes: string[];
  boost: number;
  bannerKey: string;
  bannerFr: string;
  bannerEn: string;
  icon: string;
}

export function getActiveTimeBoosts(now: Date): TimeBoost[] {
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const isWeekday = day >= 1 && day <= 5;
  const isFriSat = day === 5 || day === 6;
  const isWeekend = day === 0 || day === 6;

  const boosts: TimeBoost[] = [];

  // 1. Weekday morning rush 6h-9h
  if (isWeekday && hour >= 6 && hour < 9) {
    boosts.push({
      zoneTypes: ['métro', 'transport'],
      boost: 20,
      bannerKey: 'boostWeekdayMorningRush',
      bannerFr: 'Heure de pointe – zones métro prioritaires 🚇',
      bannerEn: 'Rush hour – metro zones prioritized 🚇',
      icon: '🚇',
    });
  }

  // 2. Weekday evening rush 16h-18h
  if (isWeekday && hour >= 16 && hour < 18) {
    boosts.push({
      zoneTypes: ['métro', 'transport'],
      boost: 15,
      bannerKey: 'boostWeekdayEveningRush',
      bannerFr: 'Heure de pointe du soir – zones métro en hausse 🚇',
      bannerEn: 'Evening rush – metro zones boosted 🚇',
      icon: '🚇',
    });
  }

  // 3. Weekend nights 22h-3h
  if (isWeekend && (hour >= 22 || hour < 3)) {
    boosts.push({
      zoneTypes: ['nightlife'],
      boost: 25,
      bannerKey: 'boostWeekendNight',
      bannerFr: 'Nuit du week-end – zones nightlife en forte demande 🎉',
      bannerEn: 'Weekend night – nightlife zones in high demand 🎉',
      icon: '🎉',
    });
  }

  // 4. Friday/Saturday nights after 23h
  if (isFriSat && hour >= 23) {
    boosts.push({
      zoneTypes: ['nightlife', 'événements'],
      boost: 30,
      bannerKey: 'boostFriSatNight',
      bannerFr: 'Vendredi/Samedi soir – nightlife & casino en hausse 🎰',
      bannerEn: 'Friday/Saturday night – nightlife & casino boosted 🎰',
      icon: '🎰',
    });
  }

  // 5. Sunday 10h-14h
  if (day === 0 && hour >= 10 && hour < 14) {
    boosts.push({
      zoneTypes: ['commercial'],
      boost: 20,
      bannerKey: 'boostSunday',
      bannerFr: 'Dimanche – zones commerciales en hausse 🛍️',
      bannerEn: 'Sunday – commercial zones boosted 🛍️',
      icon: '🛍️',
    });
  }

  // 6. Lunch 11h-13h any day
  if (hour >= 11 && hour < 13) {
    boosts.push({
      zoneTypes: ['commercial', 'université'],
      boost: 15,
      bannerKey: 'boostLunch',
      bannerFr: 'Heure du dîner – zones commerciales & universités 🍽️',
      bannerEn: 'Lunch hour – commercial & university zones 🍽️',
      icon: '🍽️',
    });
  }

  return boosts;
}

export function computeTimeBoost(zoneType: string, boosts: TimeBoost[]): number {
  let total = 0;
  for (const b of boosts) {
    if (b.zoneTypes.includes(zoneType)) {
      total += b.boost;
    }
  }
  return total;
}

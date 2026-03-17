/**
 * Real-time demand scoring engine.
 * Deterministic scores based on zone type, name, time, day-of-week, weather, and events.
 * Calibrated for realistic Montreal taxi demand patterns.
 */

import type { Zone } from '@/hooks/useSupabase';
import { haversineKm } from '@/hooks/useUserLocation';
import { applyLearningAgents, type ZoneHistory } from '@/lib/aiAgents';

export interface ActiveEventBoost {
  latitude: number;
  longitude: number;
  boost_multiplier: number;
  boost_radius_km: number;
  boost_zone_types: string[]; // empty = all zones
}

// ── Base scores by zone type (conservative baseline, boosted by time rules) ──
const BASE_SCORES: Record<string, number> = {
  'aéroport': 50,
  'métro': 35,
  'nightlife': 40,
  'transport': 40,
  'événements': 45,
  'commercial': 40,
  'université': 35,
  'médical': 40,
  'tourisme': 45,
  'résidentiel': 35,
  'achalandage': 40,
};

// ── Time-of-day rules with realistic multipliers ─────────────────────
// Multipliers are calibrated so base × multiplier hits realistic demand ranges:
//   00:00–05:00: metro 30-45, nightlife 60-80, airport 50-65
//   06:00–08:00: metro 55-70, gare centrale 75, airport 60
//   08:00–11:00: metro 50-65, commercial 55-65
//   11:00–14:00: commercial 65-75, residential 55
//   14:00–17:00: mixed 55-70
//   17:00–19:00: metro 70-85, gare centrale 80
//   19:00–23:00: nightlife 75-90, events 80-95
//   23:00–00:00: nightlife 70-85, airport 55
interface TimeRule {
  days: number[]; // 0=Sun..6=Sat, empty = any day
  startHour: number;
  startMin: number;
  endHour: number;
  endMin: number;
  multipliers: Record<string, number>;
}

const TIME_RULES: TimeRule[] = [
  // 00:00–05:00: nightlife stays high, metro dead, airport early flights
  { days: [], startHour: 0, startMin: 0, endHour: 5, endMin: 0,
    multipliers: { 'métro': 1.0, 'nightlife': 1.7, 'aéroport': 1.1, 'résidentiel': 0.9, 'commercial': 0.8 } },
  // 06:00–08:00: morning commute peak
  { days: [1,2,3,4,5], startHour: 6, startMin: 0, endHour: 8, endMin: 0,
    multipliers: { 'métro': 1.7, 'transport': 1.85, 'aéroport': 1.2 } },
  // 08:00–11:00: post-rush, moderate metro, commercial opening
  { days: [1,2,3,4,5], startHour: 8, startMin: 0, endHour: 11, endMin: 0,
    multipliers: { 'métro': 1.6, 'commercial': 1.5, 'université': 1.4 } },
  // 11:00–14:00: lunch hour, commercial peak, residential pickup
  { days: [1,2,3,4,5], startHour: 11, startMin: 0, endHour: 14, endMin: 0,
    multipliers: { 'commercial': 1.7, 'résidentiel': 1.55, 'tourisme': 1.3 } },
  // 14:00–17:00: afternoon mixed demand
  { days: [1,2,3,4,5], startHour: 14, startMin: 0, endHour: 17, endMin: 0,
    multipliers: { 'métro': 1.5, 'commercial': 1.5, 'université': 1.4, 'tourisme': 1.3 } },
  // 17:00–19:00: evening commute peak (strongest metro demand)
  { days: [1,2,3,4,5], startHour: 17, startMin: 0, endHour: 19, endMin: 0,
    multipliers: { 'métro': 2.1, 'transport': 2.0, 'aéroport': 1.2 } },
  // 19:00–23:00: nightlife + events prime time
  { days: [], startHour: 19, startMin: 0, endHour: 23, endMin: 0,
    multipliers: { 'nightlife': 2.0, 'événements': 1.9, 'tourisme': 1.2 } },
  // 23:00–00:00: late night transition
  { days: [], startHour: 23, startMin: 0, endHour: 0, endMin: 0,
    multipliers: { 'nightlife': 1.9, 'aéroport': 1.1 } },
  // Fri/Sat late night extra boost
  { days: [5,6], startHour: 22, startMin: 0, endHour: 3, endMin: 0,
    multipliers: { 'nightlife': 2.2, 'aéroport': 1.2 } },
  // Bar closing surge 02:00–03:30
  { days: [], startHour: 2, startMin: 0, endHour: 3, endMin: 30,
    multipliers: { 'nightlife': 2.0 } },
  // Sundays 10:00–14:00 brunch/shopping
  { days: [0], startHour: 10, startMin: 0, endHour: 14, endMin: 0,
    multipliers: { 'commercial': 1.5, 'tourisme': 1.3 } },
  // Weekend daytime: lower metro, higher tourism/commercial
  { days: [0,6], startHour: 10, startMin: 0, endHour: 18, endMin: 0,
    multipliers: { 'métro': 1.2, 'tourisme': 1.4, 'commercial': 1.4 } },
];

// Medical shift changes - special handling
const MEDICAL_SHIFT_HOURS = [7, 15, 19, 23];

function timeInRange(hour: number, min: number, rule: TimeRule): boolean {
  const t = hour * 60 + min;
  const s = rule.startHour * 60 + rule.startMin;
  const e = rule.endHour * 60 + rule.endMin;
  // Wraps midnight
  if (s > e) return t >= s || t < e;
  return t >= s && t < e;
}

function dayMatches(dayOfWeek: number, rule: TimeRule): boolean {
  if (rule.days.length === 0) return true;
  return rule.days.includes(dayOfWeek);
}

// ── City-specific zone profiles ───────────────────────────────────────
// Returns a demand curve value 0-10 for named zones at a given hour
interface ZoneProfile {
  pattern: (hour: number, dayOfWeek: number) => number; // 0-10
}

const ZONE_PROFILES: Record<string, ZoneProfile> = {
  // MONTRÉAL
  'Centre Bell': {
    pattern: (h) => {
      if (h >= 21 && h <= 23) return 9;
      if (h >= 18 && h <= 20) return 6;
      return 3;
    },
  },
  'Crescent Sainte-Catherine': {
    pattern: (h, d) => {
      if ((d === 4 || d === 5 || d === 6) && (h >= 23 || h < 3)) return 9;
      if (h >= 18 && h <= 22) return 6;
      return 3;
    },
  },
  'Vieux-Port': {
    pattern: (h) => {
      if (h >= 10 && h <= 17) return 6;
      return 2;
    },
  },
  'Aéroport Trudeau (YUL)': {
    pattern: (h) => {
      if (h >= 3 && h <= 5) return 8;
      if (h >= 18 && h <= 22) return 7;
      if (h >= 6 && h <= 9) return 6;
      return 4;
    },
  },
  'CHUM': {
    pattern: (h) => {
      if (MEDICAL_SHIFT_HOURS.includes(h)) return 7;
      return 3;
    },
  },
  'Casino de Montréal': {
    pattern: (h) => {
      if (h >= 22 || h < 4) return 7;
      return 2;
    },
  },
  'Station Berri-UQAM': {
    pattern: (h, d) => {
      if (d >= 1 && d <= 5 && ((h >= 7 && h <= 9) || (h >= 17 && h <= 19))) return 8;
      if (d >= 1 && d <= 5 && h >= 10 && h <= 16) return 5;
      return 3;
    },
  },
  'Gare Centrale': {
    pattern: (h, d) => {
      if (d >= 1 && d <= 5 && h >= 6 && h <= 8) return 8;
      if (d >= 1 && d <= 5 && h >= 17 && h <= 19) return 8;
      return 3;
    },
  },
  // LAVAL
  'Place Bell': {
    pattern: (h) => {
      if (h >= 21 && h <= 23) return 9;
      return 2;
    },
  },
  'Station Montmorency': {
    pattern: (h, d) => {
      if (d >= 1 && d <= 5 && ((h >= 7 && h <= 9) || (h >= 17 && h <= 19))) return 7;
      return 3;
    },
  },
  'CF Carrefour Laval': {
    pattern: (h, d) => {
      if ((d === 0 || d === 6) && h >= 12 && h <= 20) return 6;
      return 3;
    },
  },
  'Centropolis': {
    pattern: (h, d) => {
      if ((d === 5 || d === 6) && h >= 20 && (h <= 23 || h < 1)) return 7;
      return 3;
    },
  },
  'Hôpital de la Cité-de-la-Santé': {
    pattern: (h) => {
      if (MEDICAL_SHIFT_HOURS.includes(h)) return 7;
      return 3;
    },
  },
  'Gare Sainte-Rose': {
    pattern: (h, d) => {
      if (d >= 1 && d <= 5 && ((h >= 6 && h <= 8) || (h >= 16 && h <= 18))) return 7;
      return 2;
    },
  },
  // LONGUEUIL
  'Longueuil–Université-de-Sherbrooke': {
    pattern: (h, d) => {
      if (d >= 1 && d <= 5 && ((h >= 7 && h <= 9) || (h >= 17 && h <= 19))) return 7;
      return 3;
    },
  },
  'Quartier DIX30': {
    pattern: (h, d) => {
      if ((d === 0 || d === 6) && h >= 11 && h <= 21) return 7;
      return 3;
    },
  },
  'Vieux-Longueuil': {
    pattern: (h, d) => {
      if ((d === 5 || d === 6) && (h >= 20 || h < 2)) return 6;
      return 3;
    },
  },
};

// ── Weather modifier ──────────────────────────────────────────────────
export interface WeatherCondition {
  weatherId: number;
  temp: number;
  /** Additive demand boost points from weather (0-30) */
  demandBoostPoints?: number;
}

export interface ScoreFactors {
  hasWeatherBoost: boolean;
  hasEventBoost: boolean;
  weatherBoostPoints: number;
  eventBoostPoints: number;
}

export function getWeatherMultiplier(weather: WeatherCondition | null): number {
  if (!weather) return 1.0;
  const { weatherId, temp } = weather;
  if ((weatherId >= 502 && weatherId <= 531) || (weatherId >= 600 && weatherId <= 622) || (weatherId >= 200 && weatherId <= 232)) {
    return 1.4;
  }
  if (weatherId >= 300 && weatherId <= 501) {
    return 1.15;
  }
  if (temp < -15) return 1.25;
  return 1.0;
}

// ── Main scoring function ─────────────────────────────────────────────
export function computeDemandScore(
  zone: { name: string; type: string; latitude?: number; longitude?: number },
  now: Date,
  weather: WeatherCondition | null,
  eventBoosts?: ActiveEventBoost[],
): { score: number; factors: ScoreFactors } {
  const hour = now.getHours();
  const min = now.getMinutes();
  const dayOfWeek = now.getDay();

  // 1. Base score
  let baseScore = BASE_SCORES[zone.type] ?? 40;

  // 2. Time multipliers (take the highest applicable)
  let bestMultiplier = 1.0;
  for (const rule of TIME_RULES) {
    if (dayMatches(dayOfWeek, rule) && timeInRange(hour, min, rule)) {
      const m = rule.multipliers[zone.type];
      if (m && m > bestMultiplier) bestMultiplier = m;
    }
  }
  baseScore *= bestMultiplier;

  // 3. Medical shift change bonus
  if (zone.type === 'médical') {
    for (const sh of MEDICAL_SHIFT_HOURS) {
      const diff = Math.abs(hour - sh);
      if (diff === 0 || (diff === 1 && (sh > hour ? min >= 30 : min <= 30))) {
        baseScore *= 1.3;
        break;
      }
    }
  }

  // 4. City-specific zone profile overlay (40% weight)
  const profile = ZONE_PROFILES[zone.name];
  if (profile) {
    const curveValue = profile.pattern(hour, dayOfWeek);
    baseScore = baseScore * 0.6 + (curveValue / 10) * 100 * 0.4;
  }

  // Cap base at 100
  baseScore = Math.min(100, baseScore);

  // 5. Weather boost
  const weatherBoostPoints = weather?.demandBoostPoints ?? 0;
  const weatherMultiplier = getWeatherMultiplier(weather);
  const weatherAdjustedBase = baseScore * weatherMultiplier;

  // 6. Event boost (proximity-based)
  let eventBoostPoints = 0;
  if (eventBoosts && eventBoosts.length > 0 && zone.latitude != null && zone.longitude != null) {
    for (const eb of eventBoosts) {
      const dist = haversineKm(zone.latitude, zone.longitude, eb.latitude, eb.longitude);
      if (dist <= eb.boost_radius_km) {
        const typeMatch = eb.boost_zone_types.length === 0 || eb.boost_zone_types.includes(zone.type);
        if (typeMatch) {
          const pts = Math.min(30, Math.round((eb.boost_multiplier - 1) * baseScore));
          if (pts > eventBoostPoints) eventBoostPoints = pts;
        }
      }
    }
  }

  // 7. Final weighted score: 50% base + 25% weather + 25% events
  const finalScore = Math.round(
    weatherAdjustedBase * 0.50 +
    (baseScore + weatherBoostPoints) * 0.25 +
    (baseScore + eventBoostPoints) * 0.25
  );

  const factors: ScoreFactors = {
    hasWeatherBoost: weatherBoostPoints > 0 || weatherMultiplier > 1.0,
    hasEventBoost: eventBoostPoints > 0,
    weatherBoostPoints,
    eventBoostPoints,
  };

  return {
    score: Math.max(0, Math.min(100, finalScore)),
    factors,
  };
}

// ── Batch scoring for all zones ───────────────────────────────────────
export function scoreAllZones(
  zones: Zone[],
  now: Date,
  weather: WeatherCondition | null,
  eventBoosts?: ActiveEventBoost[],
): { scores: Map<string, number>; factors: Map<string, ScoreFactors> } {
  const scores = new Map<string, number>();
  const factors = new Map<string, ScoreFactors>();
  for (const zone of zones) {
    const result = computeDemandScore(zone, now, weather, eventBoosts);
    scores.set(zone.id, result.score);
    factors.set(zone.id, result.factors);
  }
  return { scores, factors };
}

export function scoreAllZonesWithLearning(
  zones: Zone[],
  now: Date,
  weather: WeatherCondition | null,
  eventBoosts?: ActiveEventBoost[],
  history: ZoneHistory[] = [],
): { scores: Map<string, number>; factors: Map<string, ScoreFactors> } {
  const base = scoreAllZones(zones, now, weather, eventBoosts);
  const adjustedScores = applyLearningAgents(zones, base.scores, history);
  return { scores: adjustedScores, factors: base.factors };
}

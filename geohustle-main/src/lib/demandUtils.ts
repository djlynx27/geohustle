import { Zone } from '@/hooks/useSupabase';
import type { TablesInsert } from '@/integrations/supabase/types';

export type DemandLevel = 'high' | 'medium' | 'low';

export function normalize24hTime(time: string): string {
  const [rawHours = '0', rawMinutes = '0'] = time.slice(0, 5).split(':');
  const hours = Number.parseInt(rawHours, 10);
  const minutes = Number.parseInt(rawMinutes, 10);

  return `${String(Number.isNaN(hours) ? 0 : hours).padStart(2, '0')}:${String(Number.isNaN(minutes) ? 0 : minutes).padStart(2, '0')}`;
}

export function formatTime24h(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function getSlotOrderMinutes(time: string): number {
  const normalizedTime = normalize24hTime(time);
  const [hours, minutes] = normalizedTime.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;

  return totalMinutes >= 360 ? totalMinutes - 360 : totalMinutes + 1080;
}

export function generate96TimeLabels(): string[] {
  return Array.from({ length: 96 }, (_, index) => {
    const totalMinutes = (360 + index * 15) % (24 * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  });
}

export function getUpcomingSlotTimes(now: Date, count: number): string[] {
  const firstUpcoming = new Date(now);
  const minutes = firstUpcoming.getMinutes();
  const minutesUntilNextSlot = minutes % 15 === 0 ? 15 : 15 - (minutes % 15);
  firstUpcoming.setMinutes(minutes + minutesUntilNextSlot, 0, 0);

  return Array.from({ length: count }, (_, index) => {
    const slotTime = new Date(firstUpcoming);
    slotTime.setMinutes(firstUpcoming.getMinutes() + index * 15);
    return formatTime24h(slotTime);
  });
}

export function getDemandLevel(score: number): DemandLevel {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

export function getDemandClass(score: number) {
  const level = getDemandLevel(score);
  return {
    bg: level === 'high' ? 'demand-high' : level === 'medium' ? 'demand-medium' : 'demand-low',
    text: level === 'high' ? 'demand-high-text' : level === 'medium' ? 'demand-medium-text' : 'demand-low-text',
    border: level === 'high' ? 'demand-high-border' : level === 'medium' ? 'demand-medium-border' : 'demand-low-border',
  };
}

export function getCurrentSlotTime(now: Date = new Date()): { start: string; end: string; date: string } {
  const currentTime = new Date(now);
  const minutes = Math.floor(currentTime.getMinutes() / 15) * 15;
  const start = new Date(currentTime);
  start.setMinutes(minutes, 0, 0);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + 15);

  const date = start.toISOString().split('T')[0];
  return { start: formatTime24h(start), end: formatTime24h(end), date };
}

function generateDemandScore(hour: number, zoneType: string): number {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  let base = 30 + Math.floor(Math.random() * 20);

  // Rush hours (weekday only)
  if (!isWeekend && ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18))) base += 30;

  // Weekend afternoon boost for commercial/tourisme
  if (isWeekend && hour >= 11 && hour <= 17) {
    if (zoneType === 'commercial' || zoneType === 'tourisme') base += 25;
    if (zoneType === 'résidentiel') base += 10;
  }

  // Sunday brunch / morning is quieter for transport
  if (dayOfWeek === 0 && hour < 10) {
    if (zoneType === 'métro' || zoneType === 'transport') base -= 15;
  }

  // Nightlife
  if (hour >= 22 || hour <= 2) {
    if (zoneType === 'nightlife') base += 40;
    else if (zoneType === 'aéroport') base += 20;
    else base -= 10;
  }

  // Airport early morning
  if (hour >= 4 && hour <= 7 && zoneType === 'aéroport') base += 35;

  // Events evening
  if (hour >= 18 && hour <= 23 && zoneType === 'événements') base += 30;

  // University weekday only
  if (!isWeekend && hour >= 8 && hour <= 17 && zoneType === 'université') base += 20;
  if (isWeekend && zoneType === 'université') base -= 15;

  // Medical always has base demand
  if (zoneType === 'médical') base += 10;

  return Math.max(0, Math.min(100, base));
}

export function createSimulatedSlotForTime(
  cityId: string,
  date: string,
  time: string,
  zone: Zone,
): TablesInsert<'time_slots'> & { id: string; created_at: string; zones: Zone } {
  const startTime = normalize24hTime(time);
  const [hours, minutes] = startTime.split(':').map(Number);
  const endDate = new Date(2000, 0, 1, hours, minutes + 15);

  return {
    id: `sim-${date}-${zone.id}-${startTime}`,
    date,
    start_time: startTime,
    end_time: formatTime24h(endDate),
    city_id: cityId,
    zone_id: zone.id,
    demand_score: generateDemandScore(hours, zone.type),
    comment: '',
    created_at: '',
    zones: zone,
  };
}

export function generateSimulatedSlots(cityId: string, date: string, zones: Zone[]): TablesInsert<'time_slots'>[] {
  const slots: TablesInsert<'time_slots'>[] = [];

  for (const startTime of generate96TimeLabels()) {
    const [hours, minutes] = startTime.split(':').map(Number);
    const endDate = new Date(2000, 0, 1, hours, minutes + 15);

    for (const zone of zones) {
      const score = generateDemandScore(hours, zone.type);
      slots.push({
        date,
        start_time: startTime,
        end_time: formatTime24h(endDate),
        city_id: cityId,
        zone_id: zone.id,
        demand_score: score,
        comment: '',
      });
    }
  }

  return slots;
}

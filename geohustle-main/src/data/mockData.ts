import { City, Zone, TimeSlot, ZoneType } from '@/types/models';

export const CITIES: City[] = [
  { id: 'mtl', name: 'Montréal' },
  { id: 'lvl', name: 'Laval' },
  { id: 'lng', name: 'Longueuil' },
];

export const ZONES: Zone[] = [
  // Montréal
  { id: 'z1', city_id: 'mtl', name: 'Centre-ville', type: 'commercial', latitude: 45.5017, longitude: -73.5673 },
  { id: 'z2', city_id: 'mtl', name: 'Métro Berri-UQAM', type: 'métro', latitude: 45.5149, longitude: -73.5608 },
  { id: 'z3', city_id: 'mtl', name: 'Vieux-Port', type: 'tourisme', latitude: 45.5048, longitude: -73.5538 },
  { id: 'z4', city_id: 'mtl', name: 'Plateau Mont-Royal', type: 'nightlife', latitude: 45.5225, longitude: -73.5764 },
  { id: 'z5', city_id: 'mtl', name: 'Aéroport Trudeau (YUL)', type: 'aéroport', latitude: 45.4577, longitude: -73.7499 },
  { id: 'z6', city_id: 'mtl', name: 'Gare Centrale', type: 'transport', latitude: 45.4996, longitude: -73.5668 },
  { id: 'z7', city_id: 'mtl', name: 'CHUM', type: 'médical', latitude: 45.5115, longitude: -73.5579 },
  { id: 'z8', city_id: 'mtl', name: 'McGill University', type: 'université', latitude: 45.5049, longitude: -73.5772 },
  { id: 'z9', city_id: 'mtl', name: 'Centre Bell', type: 'événements', latitude: 45.4961, longitude: -73.5693 },
  { id: 'z10', city_id: 'mtl', name: 'Quartier des spectacles', type: 'nightlife', latitude: 45.5083, longitude: -73.5665 },
  { id: 'z17', city_id: 'mtl', name: 'Stade olympique', type: 'événements', latitude: 45.5558, longitude: -73.5512 },
  { id: 'z18', city_id: 'mtl', name: 'Station Côte-Vertu', type: 'métro', latitude: 45.5143, longitude: -73.6833 },
  { id: 'z19', city_id: 'mtl', name: 'Casino de Montréal', type: 'nightlife', latitude: 45.5055, longitude: -73.5258 },
  // Laval
  { id: 'z20', city_id: 'lvl', name: 'Place Bell', type: 'événements', latitude: 45.5559, longitude: -73.7217 },
  { id: 'z11', city_id: 'lvl', name: 'CF Carrefour Laval', type: 'commercial', latitude: 45.5702, longitude: -73.7519 },
  { id: 'z12', city_id: 'lvl', name: 'Métro Montmorency', type: 'métro', latitude: 45.5548, longitude: -73.7194 },
  { id: 'z13', city_id: 'lvl', name: 'Centropolis', type: 'nightlife', latitude: 45.562, longitude: -73.744 },
  { id: 'z22', city_id: 'lvl', name: 'Hôpital de la Cité-de-la-Santé', type: 'médical', latitude: 45.60332, longitude: -73.71082 },
  { id: 'z23', city_id: 'lvl', name: 'Gare Sainte-Rose', type: 'transport', latitude: 45.625, longitude: -73.764 },
  // Rive-Sud
  { id: 'z21', city_id: 'lng', name: 'Quartier DIX30', type: 'commercial', latitude: 45.4411, longitude: -73.4403 },
  { id: 'z14', city_id: 'lng', name: 'Longueuil–Université-de-Sherbrooke', type: 'métro', latitude: 45.5249, longitude: -73.5219 },
  { id: 'z15', city_id: 'lng', name: 'Place Charles-Le Moyne', type: 'commercial', latitude: 45.5312, longitude: -73.5146 },
  { id: 'z16', city_id: 'lng', name: 'Hôpital Charles-LeMoyne', type: 'médical', latitude: 45.5285, longitude: -73.5090 },
];

export function generateSimulatedSlots(cityId: string, date: string): TimeSlot[] {
  const cityZones = ZONES.filter(z => z.city_id === cityId);
  const slots: TimeSlot[] = [];
  let slotIndex = 0;

  for (let hour = 6; hour < 30; hour++) {
    for (let min = 0; min < 60; min += 15) {
      const h = hour % 24;
      const startTime = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
      const endMin = min + 15;
      const endH = endMin >= 60 ? (h + 1) % 24 : h;
      const endM = endMin % 60;
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;

      const zone = cityZones[slotIndex % cityZones.length];
      const score = generateDemandScore(h, zone.type);

      slots.push({
        id: `ts-${cityId}-${date}-${slotIndex}`,
        date,
        start_time: startTime,
        end_time: endTime,
        city_id: cityId,
        zone_id: zone.id,
        demand_score: score,
        comment: '',
      });
      slotIndex++;
    }
  }
  return slots;
}

function generateDemandScore(hour: number, zoneType: ZoneType): number {
  let base = 30 + Math.floor(Math.random() * 20);

  // Rush hours
  if ((hour >= 7 && hour <= 9) || (hour >= 16 && hour <= 18)) base += 30;
  // Late night
  if (hour >= 22 || hour <= 2) {
    if (zoneType === 'nightlife') base += 40;
    else if (zoneType === 'aéroport') base += 20;
    else base -= 10;
  }
  // Morning airport
  if (hour >= 4 && hour <= 7 && zoneType === 'aéroport') base += 35;
  // Events evening
  if (hour >= 18 && hour <= 23 && zoneType === 'événements') base += 30;
  // University weekday
  if (hour >= 8 && hour <= 17 && zoneType === 'université') base += 20;
  // Hospital always decent
  if (zoneType === 'médical') base += 10;

  return Math.max(0, Math.min(100, base));
}

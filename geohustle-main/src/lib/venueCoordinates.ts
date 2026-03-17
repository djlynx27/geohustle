/**
 * Precise drop-off/entrance coordinates for known venues.
 * Used to override zone centroid coordinates in navigation links.
 */
const VENUE_DROPOFF: Record<string, { lat: number; lng: number }> = {
  // Montreal
  'Stade olympique': { lat: 45.5558, lng: -73.5512 },
  'Centre Bell': { lat: 45.4961, lng: -73.5693 },
  // Laval
  'Place Bell': { lat: 45.5559, lng: -73.7217 },
  'CF Carrefour Laval': { lat: 45.5702, lng: -73.7519 },
  'Métro Montmorency': { lat: 45.5584, lng: -73.7210 },
  'Centropolis': { lat: 45.5613, lng: -73.7494 },
  'Gare Sainte-Rose': { lat: 45.6250, lng: -73.7640 },
  'Hôpital de la Cité-de-la-Santé': { lat: 45.5790, lng: -73.7192 },
  // Rive-Sud
  'Quartier DIX30': { lat: 45.4411, lng: -73.4403 },
  'Promenades St-Bruno': { lat: 45.5243, lng: -73.3572 },
  'Longueuil–Université-de-Sherbrooke': { lat: 45.5250, lng: -73.5219 },
  'Carrefour Richelieu': { lat: 45.4467, lng: -73.2570 },
  // Blainville
  'Complexe sportif de Blainville': { lat: 45.6711, lng: -73.8883 },
  'Centre commercial Blainville': { lat: 45.6748, lng: -73.8778 },
  'Gare Blainville-Saint-Martin exo': { lat: 45.6782, lng: -73.8651 },
  'Gare Blainville': { lat: 45.6782, lng: -73.8651 },
  // Rosemère
  'Gare Sainte-Rose exo': { lat: 45.6250, lng: -73.7640 },
  'Centre commercial Place Rosemère': { lat: 45.6369, lng: -73.7989 },
  'Place Rosemère': { lat: 45.6369, lng: -73.7989 },
  // Sainte-Thérèse
  'Gare Sainte-Thérèse exo': { lat: 45.6441, lng: -73.8278 },
  'Centre-ville Sainte-Thérèse': { lat: 45.6421, lng: -73.8298 },
  // Boisbriand
  'Gare Boisbriand exo': { lat: 45.6194, lng: -73.8431 },
  'Carrefour du Nord': { lat: 45.6228, lng: -73.8397 },
  // Terrebonne
  'Carrefour des Laurentides': { lat: 45.7044, lng: -73.6428 },
  'Vieux-Terrebonne': { lat: 45.7019, lng: -73.6447 },
  'Gare Terrebonne': { lat: 45.7033, lng: -73.6367 },
};

/**
 * Get the best drop-off coordinates for a venue.
 * Falls back to the provided lat/lng if no override exists.
 */
export function getDropoffCoords(zoneName: string, fallbackLat: number, fallbackLng: number): { lat: number; lng: number } {
  // Try exact match first
  if (VENUE_DROPOFF[zoneName]) return VENUE_DROPOFF[zoneName];
  // Try partial match (venue name contained in zone name or vice versa)
  for (const [key, coords] of Object.entries(VENUE_DROPOFF)) {
    if (zoneName.includes(key) || key.includes(zoneName)) return coords;
  }
  return { lat: fallbackLat, lng: fallbackLng };
}

export function getGoogleMapsNavUrl(zoneName: string, lat: number, lng: number): string {
  const c = getDropoffCoords(zoneName, lat, lng);
  return `https://www.google.com/maps/dir/?api=1&destination=${c.lat},${c.lng}&travelmode=driving`;
}

export function getWazeNavUrl(zoneName: string, lat: number, lng: number): string {
  const c = getDropoffCoords(zoneName, lat, lng);
  return `https://waze.com/ul?ll=${c.lat},${c.lng}&navigate=yes`;
}

import { useQuery } from '@tanstack/react-query';

const cityCoords: Record<string, { lat: number; lon: number }> = {
  mtl: { lat: 45.5017, lon: -73.5673 },
  qc: { lat: 46.8139, lon: -71.2080 },
  ott: { lat: 45.4215, lon: -75.6972 },
  lvl: { lat: 45.5559, lon: -73.7217 },
  lng: { lat: 45.5249, lon: -73.5219 },
};

export interface WeatherData {
  temp: number;
  description: string;
  icon: string;
  isBadWeather: boolean;
  weatherId: number;
  /** 0-100 precipitation probability for current hour */
  precipProbability: number;
  /** mm of precipitation */
  precipitation: number;
  /** Open-Meteo WMO weather code */
  weatherCode: number;
  /** Wind speed km/h */
  windSpeed: number;
  /** Computed weather boost points for demand scoring */
  demandBoostPoints: number;
}

/** Map WMO weather codes to icon + description */
function getWeatherMeta(code: number): { icon: string; description: string; isBadWeather: boolean } {
  // WMO Weather interpretation codes
  if (code === 0) return { icon: '☀️', description: 'Dégagé', isBadWeather: false };
  if (code <= 3) return { icon: '⛅', description: 'Partiellement nuageux', isBadWeather: false };
  if (code <= 48) return { icon: '🌫️', description: 'Brouillard', isBadWeather: true };
  if (code <= 57) return { icon: '🌧️', description: 'Bruine', isBadWeather: true };
  if (code <= 67) return { icon: '🌧️', description: 'Pluie', isBadWeather: true };
  if (code <= 77) return { icon: '🌨️', description: 'Neige', isBadWeather: true };
  if (code <= 82) return { icon: '🌧️', description: 'Averses', isBadWeather: true };
  if (code <= 86) return { icon: '🌨️', description: 'Averses de neige', isBadWeather: true };
  if (code === 95) return { icon: '⛈️', description: 'Orage', isBadWeather: true };
  if (code <= 99) return { icon: '⛈️', description: 'Orage avec grêle', isBadWeather: true };
  return { icon: '🌥️', description: 'Nuageux', isBadWeather: false };
}

/** Calculate demand boost points from weather conditions */
function calcWeatherBoost(precipProb: number, weatherCode: number): number {
  let boost = 0;

  // Snow (WMO codes 71-77) → +30
  if (weatherCode >= 71 && weatherCode <= 77) {
    return 30;
  }

  // Precipitation probability based
  if (precipProb > 80) {
    boost = 25;
  } else if (precipProb > 60) {
    boost = 15;
  }

  return boost;
}

export function useWeather(cityId: string) {
  return useQuery<WeatherData>({
    queryKey: ['weather', cityId],
    queryFn: async () => {
      const coords = cityCoords[cityId];
      if (!coords) throw new Error('Unknown city');

      const url = `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&hourly=precipitation_probability,precipitation,weather_code,wind_speed_10m&current=temperature_2m,precipitation,weather_code,wind_speed_10m&timezone=America/Toronto&forecast_days=2`;

      const res = await fetch(url);
      if (!res.ok) throw new Error('Open-Meteo fetch failed');
      const data = await res.json();

      const currentTemp = Math.round(data.current.temperature_2m);
      const currentCode = data.current.weather_code;
      const currentPrecip = data.current.precipitation;
      const currentWind = data.current.wind_speed_10m;

      // Get current hour's precipitation probability from hourly data
      const now = new Date();
      const currentHourISO = now.toISOString().slice(0, 13); // "2024-01-01T14"
      const hourlyTimes: string[] = data.hourly.time;
      const hourIndex = hourlyTimes.findIndex((t: string) => t.startsWith(currentHourISO.replace('T', 'T')));
      // Fallback: find closest hour
      let precipProb = 0;
      if (hourIndex >= 0) {
        precipProb = data.hourly.precipitation_probability[hourIndex] ?? 0;
      } else {
        // Try matching by local hour
        const localHour = now.getHours();
        const todayStr = now.toISOString().slice(0, 10);
        const fallbackIdx = hourlyTimes.findIndex((t: string) => t === `${todayStr}T${String(localHour).padStart(2, '0')}:00`);
        if (fallbackIdx >= 0) {
          precipProb = data.hourly.precipitation_probability[fallbackIdx] ?? 0;
        }
      }

      const meta = getWeatherMeta(currentCode);
      const demandBoostPoints = calcWeatherBoost(precipProb, currentCode);

      // Map WMO code to approximate OpenWeatherMap id for backward compat
      let weatherId = 800; // clear
      if (currentCode >= 95) weatherId = 200; // thunderstorm
      else if (currentCode >= 71 && currentCode <= 77) weatherId = 600; // snow
      else if (currentCode >= 51 && currentCode <= 67) weatherId = 500; // rain
      else if (currentCode >= 45 && currentCode <= 48) weatherId = 741; // fog
      else if (currentCode >= 80 && currentCode <= 82) weatherId = 502; // heavy rain
      else if (currentCode >= 83 && currentCode <= 86) weatherId = 601; // snow showers

      return {
        temp: currentTemp,
        description: meta.description,
        icon: meta.icon,
        isBadWeather: meta.isBadWeather,
        weatherId,
        precipProbability: precipProb,
        precipitation: currentPrecip,
        weatherCode: currentCode,
        windSpeed: currentWind,
        demandBoostPoints,
      };
    },
    staleTime: 10 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000, // 30 min auto-refresh
  });
}

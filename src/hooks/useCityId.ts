import { useState, useCallback } from 'react';

const STORAGE_KEY = 'geohustle_city_id';

export function useCityId(defaultId = 'mtl') {
  const [cityId, setCityIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || defaultId;
    } catch {
      return defaultId;
    }
  });

  const setCityId = useCallback((id: string) => {
    setCityIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
  }, []);

  return [cityId, setCityId] as const;
}

import { useState, useEffect, useCallback, useRef } from 'react';

interface UserLocation {
  latitude: number;
  longitude: number;
  heading?: number | null;
  speed?: number | null;
}

export type UserLocationStatus = 'idle' | 'loading' | 'success' | 'error';

export interface UserLocationResult {
  location: UserLocation | null;
  status: UserLocationStatus;
  error: string | null;
}

export function useUserLocation(intervalMs = 30000): UserLocationResult {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [status, setStatus] = useState<UserLocationStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const update = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('error');
      setError('Geolocation is not supported on this device');
      return;
    }
    setStatus((prev) => (prev === 'success' ? prev : 'loading'));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const now = Date.now();
        // throttle updates to avoid needless re-renders
        if (now - lastUpdateRef.current < 3000 && lastUpdateRef.current !== 0) {
          return;
        }
        lastUpdateRef.current = now;
        setLocation({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          heading: typeof pos.coords.heading === 'number' ? pos.coords.heading : null,
          speed: typeof pos.coords.speed === 'number' ? pos.coords.speed : null,
        });
        setStatus('success');
        setError(null);
      },
      (err) => {
        setStatus('error');
        setError(err.message || 'Unable to get current location');
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    update();
    const id = setInterval(update, intervalMs);
    return () => clearInterval(id);
  }, [update, intervalMs]);

  return { location, status, error };
}

/** Haversine distance in km */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

import { useEffect, useRef, useState, useCallback } from 'react';
import { useDemandScores } from '@/hooks/useDemandScores';
import { useUserLocation, haversineKm } from '@/hooks/useUserLocation';
import { getEndingSoonEvents, getStartingSoonEvents, type AppEvent } from '@/hooks/useEvents';

const NOTIF_COOLDOWN_MS = 15 * 60_000; // 15 min per notification type
const NOTIFIED_EVENTS_KEY = 'geohustle_notified_events';

function getNotifiedEvents(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_EVENTS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function markEventNotified(eventId: string) {
  const set = getNotifiedEvents();
  set.add(eventId);
  // Keep only last 200 to avoid unbounded growth
  const arr = [...set];
  if (arr.length > 200) arr.splice(0, arr.length - 200);
  try { localStorage.setItem(NOTIFIED_EVENTS_KEY, JSON.stringify(arr)); } catch {}
}

interface NotifState {
  lastDemandNotif: number;
  lastWeatherNotif: number;
  lastBarNotif: number;
  prevWeatherId: number | null;
}

function getGoogleMapsUrl(lat: number, lng: number) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
}

async function sendNotification(title: string, body: string, url?: string) {
  if (Notification.permission !== 'granted') return;

  // Try service worker notification first (works in background)
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon: '/pwa-icon-192.png',
      badge: '/pwa-icon-192.png',
      tag: title.slice(0, 20),
      renotify: true,
      data: { url },
      actions: url ? [{ action: 'go', title: 'GO →' }] : [],
    } as NotificationOptions);
    return;
  }

  // Fallback to basic notification
  new Notification(title, { body, icon: '/pwa-icon-192.png' });
}

function findNearestZone(lat: number, lng: number, zones: any[]): any | null {
  let best: any = null;
  let bestDist = Infinity;
  for (const z of zones) {
    const d = haversineKm(lat, lng, z.latitude, z.longitude);
    if (d < bestDist) {
      bestDist = d;
      best = z;
    }
  }
  return best;
}

export function useNotifications(cityId: string) {
  const [enabled, setEnabled] = useState(() => Notification.permission === 'granted');
  const { scores, zones, weather, endingSoon, startingSoon } = useDemandScores(cityId);
  const { location: userLocation } = useUserLocation();
  const stateRef = useRef<NotifState>({
    lastDemandNotif: 0,
    lastWeatherNotif: 0,
    lastBarNotif: 0,
    prevWeatherId: null,
  });

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return false;
    const result = await Notification.requestPermission();
    setEnabled(result === 'granted');
    return result === 'granted';
  }, []);

  // Check demand spikes
  useEffect(() => {
    if (!enabled || !userLocation) return;
    const now = Date.now();
    const s = stateRef.current;
    if (now - s.lastDemandNotif < NOTIF_COOLDOWN_MS) return;

    for (const zone of zones) {
      const score = scores.get(zone.id) ?? 0;
      if (score < 85) continue;
      const dist = haversineKm(userLocation.latitude, userLocation.longitude, zone.latitude, zone.longitude);
      if (dist > 5) continue;

      sendNotification(
        '🔴 Forte demande',
        `${zone.name} · Score ${score}/100 · ${dist.toFixed(1)} km`,
        getGoogleMapsUrl(zone.latitude, zone.longitude),
      );
      s.lastDemandNotif = now;
      break;
    }
  }, [enabled, scores, zones, userLocation]);

  // PRE-EVENT: 90 min before event starts — ONCE per event (localStorage dedup)
  useEffect(() => {
    if (!enabled || !startingSoon || startingSoon.length === 0) return;
    const now = Date.now();
    const notified = getNotifiedEvents();

    for (const ev of startingSoon) {
      if (notified.has(ev.id)) continue; // Already sent for this event

      const startMs = new Date(ev.start_at).getTime();
      const minsUntil = Math.round((startMs - now) / 60_000);

      const nearZone = findNearestZone(ev.latitude, ev.longitude, zones);
      const zoneName = nearZone?.name || 'la zone';
      const attendance = ev.capacity;
      const attendanceText = attendance && attendance > 0 ? ` — ${attendance.toLocaleString()} personnes attendues` : '';

      sendNotification(
        `🎫 Événement dans ${minsUntil}min`,
        `${ev.name} à ${ev.venue}${attendanceText}. Positionnez-vous près de ${zoneName} pour la surge!`,
        getGoogleMapsUrl(ev.latitude, ev.longitude),
      );
      markEventNotified(ev.id);
      break; // one at a time
    }
  }, [enabled, startingSoon, zones]);

  // Check events ending in 30 min — ONCE per event (localStorage dedup)
  useEffect(() => {
    if (!enabled) return;
    const now = Date.now();
    const notified = getNotifiedEvents();

    for (const ev of endingSoon) {
      const endingKey = `ending_${ev.id}`;
      if (notified.has(endingKey)) continue;

      const endMs = new Date(ev.end_at).getTime();
      const minsLeft = Math.round((endMs - now) / 60_000);
      if (minsLeft > 30 || minsLeft < 0) continue;

      sendNotification(
        `🏒 ${ev.name}`,
        `Se termine dans ${minsLeft}min - Positionnez-vous!`,
        getGoogleMapsUrl(ev.latitude, ev.longitude),
      );
      markEventNotified(endingKey);
      break;
    }
  }, [enabled, endingSoon]);

  // Friday/Saturday 02:15 bar closing
  useEffect(() => {
    if (!enabled) return;
    const checkBarClosing = () => {
      const now = new Date();
      const day = now.getDay();
      const h = now.getHours();
      const m = now.getMinutes();
      const s = stateRef.current;

      // Friday=5 or Saturday=6, at 02:15
      if ((day === 5 || day === 6) && h === 2 && m >= 15 && m < 30) {
        if (Date.now() - s.lastBarNotif < NOTIF_COOLDOWN_MS) return;
        sendNotification(
          '🍺 Bars ferment dans 45min',
          'Crescent/St-Laurent au max',
          getGoogleMapsUrl(45.4985, -73.5726), // Crescent St
        );
        s.lastBarNotif = Date.now();
      }
    };

    checkBarClosing();
    const interval = setInterval(checkBarClosing, 60_000);
    return () => clearInterval(interval);
  }, [enabled]);

  // Weather change detection
  useEffect(() => {
    if (!enabled || !weather) return;
    const s = stateRef.current;
    const now = Date.now();

    if (s.prevWeatherId !== null && s.prevWeatherId >= 700 && weather.weatherId < 700) {
      if (now - s.lastWeatherNotif >= NOTIF_COOLDOWN_MS) {
        sendNotification(
          '🌧️ Précipitations détectées',
          'Demande en hausse partout',
        );
        s.lastWeatherNotif = now;
      }
    }
    s.prevWeatherId = weather.weatherId;
  }, [enabled, weather]);

  return { enabled, requestPermission };
}

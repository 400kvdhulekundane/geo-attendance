/**
 * Capacitor native bridge service
 * Provides geolocation via @capacitor/geolocation and
 * local notifications via @capacitor/local-notifications.
 * Falls back gracefully to the browser APIs when running in a web browser.
 */

import { PositionData } from '../utils/storage';

// ─── Type declarations (avoid import errors before npm install) ───────────────

type CapacitorGeolocation = {
  requestPermissions: () => Promise<{ location: string }>;
  getCurrentPosition: (opts: {
    enableHighAccuracy: boolean;
    timeout: number;
  }) => Promise<{ coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number }>;
  watchPosition: (
    opts: { enableHighAccuracy: boolean; timeout: number },
    cb: (pos: { coords: { latitude: number; longitude: number; accuracy: number }; timestamp: number } | null, err?: unknown) => void
  ) => Promise<string>;
  clearWatch: (opts: { id: string }) => Promise<void>;
};

type CapacitorLocalNotifications = {
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (opts: {
    notifications: Array<{
      id: number;
      title: string;
      body: string;
      smallIcon?: string;
      iconColor?: string;
      schedule?: { at: Date };
    }>;
  }) => Promise<void>;
  checkPermissions: () => Promise<{ display: string }>;
};

// ─── Runtime detection ────────────────────────────────────────────────────────

function getGeoPlugin(): CapacitorGeolocation | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).CapacitorCustomPlatform?.plugins?.Geolocation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ?? (window as any).Capacitor?.Plugins?.Geolocation
        ?? null;
    }
  } catch { /* noop */ }
  return null;
}

function getNotifPlugin(): CapacitorLocalNotifications | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = (window as any).Capacitor;
    if (cap?.isNativePlatform?.()) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (window as any).Capacitor?.Plugins?.LocalNotifications ?? null;
    }
  } catch { /* noop */ }
  return null;
}

export function isNative(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return !!(window as any).Capacitor?.isNativePlatform?.();
  } catch {
    return false;
  }
}

// ─── Geolocation ─────────────────────────────────────────────────────────────

export async function requestLocationPermission(): Promise<boolean> {
  const plugin = getGeoPlugin();
  if (plugin) {
    try {
      const result = await plugin.requestPermissions();
      return result.location === 'granted';
    } catch {
      return false;
    }
  }
  // Web fallback – permission is requested implicitly by the browser
  return true;
}

export async function getNativePosition(): Promise<PositionData> {
  const plugin = getGeoPlugin();
  if (plugin) {
    const pos = await plugin.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
    return {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
      timestamp: pos.timestamp,
    };
  }
  // Web fallback
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp }),
      reject,
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

let watchId: string | null = null;

export async function startLocationWatch(
  callback: (pos: PositionData) => void,
  onError?: (err: unknown) => void
): Promise<void> {
  const plugin = getGeoPlugin();
  if (plugin) {
    watchId = await plugin.watchPosition({ enableHighAccuracy: true, timeout: 15000 }, (pos, err) => {
      if (err || !pos) { onError?.(err); return; }
      callback({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      });
    });
    return;
  }
  // Web fallback
  const id = navigator.geolocation.watchPosition(
    (p) => callback({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, timestamp: p.timestamp }),
    onError,
    { enableHighAccuracy: true, timeout: 15000 }
  );
  watchId = String(id);
}

export async function stopLocationWatch(): Promise<void> {
  if (watchId === null) return;
  const plugin = getGeoPlugin();
  if (plugin) {
    await plugin.clearWatch({ id: watchId });
  } else {
    navigator.geolocation.clearWatch(Number(watchId));
  }
  watchId = null;
}

// ─── Notifications ────────────────────────────────────────────────────────────

let notifPermissionGranted = false;
let notifIdCounter = Math.floor(Math.random() * 10000);

export async function requestNotificationPermission(): Promise<boolean> {
  const plugin = getNotifPlugin();
  if (plugin) {
    try {
      const check = await plugin.checkPermissions();
      if (check.display === 'granted') { notifPermissionGranted = true; return true; }
      const result = await plugin.requestPermissions();
      notifPermissionGranted = result.display === 'granted';
      return notifPermissionGranted;
    } catch {
      return false;
    }
  }
  // Web Notification API fallback
  if ('Notification' in window) {
    const perm = await Notification.requestPermission();
    notifPermissionGranted = perm === 'granted';
    return notifPermissionGranted;
  }
  return false;
}

export async function sendLocalNotification(title: string, body: string): Promise<void> {
  const plugin = getNotifPlugin();
  if (plugin) {
    try {
      await plugin.schedule({
        notifications: [{
          id: ++notifIdCounter,
          title,
          body,
          smallIcon: 'ic_stat_notify',   // must exist in android res/drawable
          iconColor: '#10b981',
        }],
      });
      return;
    } catch (e) {
      console.warn('Native notification failed:', e);
    }
  }
  // Web Notification API fallback
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/icon.png' });
    return;
  }
  // Last resort: browser alert (silent on mobile, but at least visible)
  console.info(`[Notification] ${title}: ${body}`);
}

// ─── Convenience wrappers used by useAutomation ───────────────────────────────

export async function notifyCheckIn(profileName: string, time: string): Promise<void> {
  await sendLocalNotification(
    '✅ Checked In – ' + profileName,
    `Auto check-in recorded at ${time}`
  );
}

export async function notifyCheckOut(profileName: string, time: string, durationMinutes: number): Promise<void> {
  const h = Math.floor(durationMinutes / 60);
  const m = Math.round(durationMinutes % 60);
  const dur = h > 0 ? `${h}h ${m}m` : `${m}m`;
  await sendLocalNotification(
    '🚪 Checked Out – ' + profileName,
    `Auto check-out at ${time} · Duration: ${dur}`
  );
}

export async function notifyAbsent(profileName: string): Promise<void> {
  await sendLocalNotification(
    '⚠️ Marked Absent – ' + profileName,
    `You were marked absent for ${profileName} today`
  );
}

export async function notifyGeofenceExit(profileName: string, time: string): Promise<void> {
  await sendLocalNotification(
    '📍 Left Geofence – ' + profileName,
    `Check-out triggered on geofence exit at ${time}`
  );
}

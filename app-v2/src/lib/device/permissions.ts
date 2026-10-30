/** مجوزهای دستگاه: اعلان و موقعیت؛ در وب به API مرورگر برمی‌گردد. */
import { Capacitor } from "@capacitor/core";

export type PermissionState = "granted" | "denied" | "prompt" | "unavailable";

const native = () => Capacitor.isNativePlatform();

/** بعضی دیالوگ‌های نیتیو روی برخی گوشی‌ها هرگز resolve نمی‌شوند؛ UI نباید قفل بماند. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(null);
    }, ms);
    promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(null);
      }
    );
  });
}

export async function checkNotificationPermission(): Promise<PermissionState> {
  if (native() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const status = await LocalNotifications.checkPermissions();
      return status.display === "granted" ? "granted" : status.display === "denied" ? "denied" : "prompt";
    } catch {
      return "unavailable";
    }
  }
  if (typeof Notification === "undefined") return "unavailable";
  return Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "prompt";
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (native() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      const status = await withTimeout(LocalNotifications.requestPermissions(), 12_000);
      if (!status) return checkNotificationPermission();
      if (status.display === "granted") return "granted";
      if (status.display === "denied") return "denied";
      return checkNotificationPermission();
    } catch {
      return checkNotificationPermission();
    }
  }
  if (typeof Notification === "undefined") return "unavailable";
  try {
    const result = await withTimeout(Notification.requestPermission(), 12_000);
    if (result === "granted") return "granted";
    if (result === "denied") return "denied";
    return checkNotificationPermission();
  } catch {
    return checkNotificationPermission();
  }
}

export async function checkLocationPermission(): Promise<PermissionState> {
  if (native() && Capacitor.isPluginAvailable("Geolocation")) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const status = await Geolocation.checkPermissions();
      if (status.location === "granted" || status.coarseLocation === "granted") return "granted";
      if (status.location === "denied" || status.coarseLocation === "denied") return "denied";
      return "prompt";
    } catch {
      return "unavailable";
    }
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) return "unavailable";
  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: "geolocation" });
      return status.state === "granted" ? "granted" : status.state === "denied" ? "denied" : "prompt";
    } catch {
      /* ignore */
    }
  }
  return "prompt";
}

export async function requestLocationPermission(): Promise<PermissionState> {
  if (native() && Capacitor.isPluginAvailable("Geolocation")) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const status = await withTimeout(Geolocation.requestPermissions(), 12_000);
      if (!status) return checkLocationPermission();
      if (status.location === "granted" || status.coarseLocation === "granted") return "granted";
      if (status.location === "denied" || status.coarseLocation === "denied") return "denied";
      return checkLocationPermission();
    } catch {
      return checkLocationPermission();
    }
  }
  return checkLocationPermission();
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type LocationFailure = "denied" | "disabled" | "timeout" | "unavailable";

export type LocationResult = { ok: true; coords: Coordinates } | { ok: false; kind: LocationFailure; message: string };

function classifyError(message: string, code?: number): LocationFailure {
  const text = String(message || "").toLowerCase();
  if (code === 1 || /denied|not authorized|permission/.test(text)) return "denied";
  if (code === 2 || /disabled|location services|gps|unavailable/.test(text)) return "disabled";
  if (code === 3 || /timeout|timed out/.test(text)) return "timeout";
  return "unavailable";
}

async function nativePosition(highAccuracy: boolean): Promise<LocationResult | null> {
  if (!native() || !Capacitor.isPluginAvailable("Geolocation")) return null;
  try {
    const { Geolocation } = await import("@capacitor/geolocation");
    const position = await withTimeout(
      Geolocation.getCurrentPosition({ enableHighAccuracy: highAccuracy, timeout: highAccuracy ? 18_000 : 24_000, maximumAge: 60_000 }),
      26_000
    );
    if (!position) return { ok: false, kind: "timeout", message: "خواندن موقعیت زمان‌بر شد." };
    return { ok: true, coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
  } catch (error) {
    const message = String((error as { message?: string })?.message || error);
    const code = Number((error as { code?: number })?.code);
    return { ok: false, kind: classifyError(message, code), message };
  }
}

async function browserPosition(): Promise<LocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, kind: "unavailable", message: "موقعیت مکانی در این دستگاه در دسترس نیست." };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ ok: true, coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } }),
      (error) => resolve({ ok: false, kind: classifyError(error.message, error.code), message: error.message }),
      { enableHighAccuracy: false, timeout: 20_000, maximumAge: 120_000 }
    );
  });
}

export async function getCurrentCoordinates(): Promise<LocationResult> {
  const high = await nativePosition(true);
  if (high?.ok) return high;
  if (high?.kind === "denied") return high;
  // اگر GPS دقیق آماده نیست، یک بار با دقت کمتر و بعد از مسیر مرورگر تلاش می‌کنیم.
  const low = await nativePosition(false);
  if (low?.ok) return low;
  const browser = await browserPosition();
  if (browser.ok) return browser;
  return high ?? low ?? browser;
}

/** مجوزهای دستگاه: اعلان و موقعیت؛ در وب به API مرورگر برمی‌گردد. */
import { Capacitor } from "@capacitor/core";

export type PermissionState = "granted" | "denied" | "prompt" | "unavailable";

const native = () => Capacitor.isNativePlatform();

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
      const status = await LocalNotifications.requestPermissions();
      return status.display === "granted" ? "granted" : "denied";
    } catch {
      return "unavailable";
    }
  }
  if (typeof Notification === "undefined") return "unavailable";
  try {
    return (await Notification.requestPermission()) === "granted" ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

export async function checkLocationPermission(): Promise<PermissionState> {
  if (native() && Capacitor.isPluginAvailable("Geolocation")) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const status = await Geolocation.checkPermissions();
      if (status.location === "granted" || status.coarseLocation === "granted") return "granted";
      return status.location === "denied" ? "denied" : "prompt";
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
      const status = await Geolocation.requestPermissions();
      if (status.location === "granted" || status.coarseLocation === "granted") return "granted";
      return status.location === "denied" ? "denied" : "prompt";
    } catch {
      return "unavailable";
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

export async function getCurrentCoordinates(): Promise<LocationResult> {
  if (native() && Capacitor.isPluginAvailable("Geolocation")) {
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 18_000, maximumAge: 60_000 });
      return { ok: true, coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } };
    } catch (error) {
      const message = String((error as { message?: string })?.message || error);
      const code = Number((error as { code?: number })?.code);
      return { ok: false, kind: classifyError(message, code), message };
    }
  }
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, kind: "unavailable", message: "موقعیت مکانی در این دستگاه در دسترس نیست." };
  }
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ ok: true, coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } }),
      (error) => resolve({ ok: false, kind: classifyError(error.message, error.code), message: error.message }),
      { enableHighAccuracy: true, timeout: 18_000, maximumAge: 60_000 }
    );
  });
}

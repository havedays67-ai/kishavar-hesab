import { Capacitor } from "@capacitor/core";
import type { Insight } from "./insights";
import { checkNotificationPermission } from "./device/permissions";

const LAST_KEY = "kishavar.important-notified.v1";

function stableId(code: string): number {
  let hash = 7;
  for (let index = 0; index < code.length; index += 1) hash = (hash * 31 + code.charCodeAt(index)) % 1_000_000;
  return 700_000_000 + hash;
}

/** موضوعات مهم برای اعلان: فقط بحرانی/هشدار، حداکثر ۳ مورد در روز. */
export function importantTopics(insights: Insight[]): Insight[] {
  return [...insights]
    .filter((item) => item.severity === "critical" || item.severity === "warning")
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1))
    .slice(0, 3);
}

function notificationsWanted(): boolean {
  try {
    const raw = localStorage.getItem("kishavar.permissions.prefs.v2");
    if (!raw) return true;
    const prefs = JSON.parse(raw) as { asked?: boolean; notifications?: boolean };
    return !prefs.asked || prefs.notifications !== false;
  } catch {
    return true;
  }
}

export async function notifyImportantTopics(insights: Insight[]): Promise<{ ok: boolean; count: number }> {
  const topics = importantTopics(insights);
  if (topics.length === 0) return { ok: false, count: 0 };
  if (!notificationsWanted()) return { ok: false, count: 0 };
  const permission = await checkNotificationPermission();
  if (permission !== "granted") return { ok: false, count: 0 };
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(LAST_KEY) === today) return { ok: true, count: 0 };
    localStorage.setItem(LAST_KEY, today);
  } catch {
    /* ignore */
  }
  if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("LocalNotifications")) {
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.createChannel({ id: "kishavar-important", name: "موضوعات مهم کشاورزیار", importance: 5, sound: "default", vibration: true, lights: true, visibility: 1 });
      await LocalNotifications.schedule({
        notifications: topics.map((topic, index) => ({
          id: stableId(topic.code),
          title: `کشاورزیار: ${topic.title}`,
          body: topic.action || topic.detail,
          channelId: "kishavar-important",
          sound: "default",
          schedule: { at: new Date(Date.now() + 3_000 + index * 1_200), allowWhileIdle: true },
        })),
      });
      return { ok: true, count: topics.length };
    } catch {
      return { ok: false, count: 0 };
    }
  }
  if (typeof Notification !== "undefined") {
    topics.forEach((topic, index) => {
      try {
        window.setTimeout(() => new Notification(`کشاورزیار: ${topic.title}`, { body: topic.action || topic.detail }), index * 1_200);
      } catch {
        /* ignore */
      }
    });
    return { ok: true, count: topics.length };
  }
  return { ok: false, count: 0 };
}

/**
 * استدلال محصولات خارج از فهرست ثابت.
 * نتیجه در حافظهٔ دستگاه نگه داشته می‌شود تا پرسش دوباره، پنجرهٔ انتظار نسازد.
 */
export interface CropInsightTask {
  day: number;
  kind: "prep" | "planting" | "fertilizer" | "spray" | "irrigation" | "harvest";
  title: string;
  detail: string;
}

export interface CropInsight {
  name: string;
  summary: string;
  sowing: string;
  harvestDays: number;
  waterMm: number;
  fertilizer: string;
  irrigation: string;
  tasks: CropInsightTask[];
  risks: string[];
  confidence: string;
  weather: string;
  engine: string;
}

export type CropResearchResult =
  | { ok: true; data: CropInsight; cached: boolean }
  | { ok: false; kind: "irrelevant" | "unavailable"; message: string };

const ENDPOINTS = [
  "https://ai.tivachat-vflash-ai.ir/api/research",
  "https://kishavar-ai.indistinctiveeee.workers.dev/api/research",
];
const CACHE_KEY = "kishavar.crop-research.v3";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 70_000;

const normalizeName = (name: string) => name.trim().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\u200c/g, " ").replace(/\s+/g, " ").toLowerCase();
const normalizePlace = (value = "") => value.trim().replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/\s+/g, " ").toLowerCase();

type CacheMap = Record<string, { at: number; data: CropInsight }>;

function readCache(): CacheMap {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as CacheMap) : {};
  } catch {
    return {};
  }
}

function cacheKey(name: string, options: { city?: string; province?: string; climate?: string; today?: string } = {}): string {
  // کلید پایدار است و اعتبار با age هفت‌روزه سنجیده می‌شود؛ نه مرز هفتهٔ تقویمی.
  return [normalizeName(name), normalizePlace(options.province), normalizePlace(options.city), normalizePlace(options.climate)].join("|");
}

export function cachedCropInsight(name: string, options: { city?: string; province?: string; climate?: string; today?: string } = {}): CropInsight | null {
  const hit = readCache()[cacheKey(name, options)];
  if (!hit || !hit.data || Date.now() - Number(hit.at || 0) > MAX_AGE_MS) return null;
  return hit.data;
}

function writeCache(name: string, data: CropInsight, options: { city?: string; province?: string; climate?: string; today?: string } = {}) {
  try {
    const map = readCache();
    map[cacheKey(name, options)] = { at: Date.now(), data };
    const keys = Object.keys(map);
    if (keys.length > 24) keys.slice(0, keys.length - 24).forEach((key) => delete map[key]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(map));
  } catch {
    /* حافظهٔ دستگاه پر یا غیرفعال است؛ استدلال تازه همچنان کار می‌کند. */
  }
}

export async function researchCrop(
  name: string,
  options: { city?: string; province?: string; climate?: string; today?: string; force?: boolean } = {},
): Promise<CropResearchResult> {
  const clean = name.trim().slice(0, 80);
  if (clean.length < 2) return { ok: false, kind: "irrelevant", message: "نام محصول را کامل بنویس." };
  if (!options.force) {
    const cached = cachedCropInsight(clean, options);
    if (cached) return { ok: true, data: cached, cached: true };
  }
  let lastError = "";
  for (const endpoint of ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: clean, city: options.city ?? "", province: options.province ?? "", climate: options.climate ?? "", today: options.today ?? "", force: Boolean(options.force) }),
        signal: controller.signal,
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (data?.ok && data?.relevant === false) {
        return { ok: false, kind: "irrelevant", message: String(data.reason || "درخواست شما یافت نشد") };
      }
      if (!response.ok || !data?.ok) {
        lastError = String(data?.error || `HTTP ${response.status}`);
        continue;
      }
      const insight: CropInsight = {
        name: String(data.name || clean),
        summary: String(data.summary || ""),
        sowing: String(data.sowing || ""),
        harvestDays: Number(data.harvestDays) || 120,
        waterMm: Number(data.waterMm) || 500,
        fertilizer: String(data.fertilizer || ""),
        irrigation: String(data.irrigation || ""),
        tasks: Array.isArray(data.tasks) ? data.tasks : [],
        risks: Array.isArray(data.risks) ? data.risks.map(String) : [],
        confidence: String(data.confidence || "متوسط"),
        weather: String(data.weather || ""),
        engine: String(data.engine || "primary"),
      };
      if (!insight.tasks.length) {
        lastError = "تقویم خالی برگشت";
        continue;
      }
      writeCache(clean, insight, options);
      return { ok: true, data: insight, cached: false };
    } catch (error) {
      lastError = error instanceof Error && error.name === "AbortError" ? "زمان انتظار تمام شد" : String(error);
    } finally {
      clearTimeout(timer);
    }
  }
  return { ok: false, kind: "unavailable", message: lastError || "استدلال الان ممکن نیست" };
}

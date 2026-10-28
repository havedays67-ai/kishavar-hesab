/**
 * کش یادگیری موضعی (Learned Cache)
 * ------------------------------------------------------------
 * فقط نگاشت «جمله ← intent/slots» ذخیره می‌شود؛ نه مبلغ، نه موجودی و
 * نه نتیجهٔ هیچ گزارشی. هر مقدار با `sanitize` کنترل می‌شود: اگر
 * شماره‌ای داخل مقدار باشد، کل رکورد رد می‌شود.
 * سیاست حذف: LRU با سقف قابل تنظیم. پاک‌سازی کامل از تنظیمات.
 * داده روی همان دستگاه می‌ماند و هیچ مسیر شبکه‌ای وجود ندارد.
 */
import { packKey, type PackEntry } from "./pack";
import type { NluIntent, NluSlots } from "./rules";

const STORAGE_KEY = "kishavar.nlu.learned.v1";
export const DEFAULT_CACHE_LIMIT = 500;
const ALLOWED_SLOTS = new Set(["crop", "category", "unit", "docType", "direction", "role"]);

export interface CacheRecord extends PackEntry {
  key: string;
  hash: number;
  hits: number;
  lastUsed: number;
  source: "model" | "pack" | "rules" | "user";
}

export function isRecordSafe(intent: string, slots: NluSlots): boolean {
  if (!intent || !/^[a-z_]+$/.test(intent)) return false;
  for (const [key, value] of Object.entries(slots ?? {})) {
    if (!ALLOWED_SLOTS.has(key)) return false;
    if (typeof value !== "string") return false;
    // هیچ رقم یا الگوی مبلغی در مقدار مجاز نیست
    if (/[0-9۰-۹]/.test(value)) return false;
    if (value.length > 48) return false;
  }
  return true;
}

function getStorage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  } as Storage;
}

const fallback = memoryStorage();

export class LearnedCache {
  private records = new Map<number, CacheRecord>();
  private limit: number;
  private storage: Storage;
  private dirty = false;

  constructor(storage?: Storage, limit = DEFAULT_CACHE_LIMIT) {
    this.storage = storage ?? getStorage() ?? fallback;
    this.limit = Math.max(20, Math.min(5000, limit));
    this.load();
  }

  private load(): void {
    try {
      const raw = this.storage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as CacheRecord[];
      if (!Array.isArray(parsed)) return;
      for (const record of parsed) {
        if (!record || typeof record.hash !== "number" || !isRecordSafe(record.intent, record.slots)) continue;
        this.records.set(record.hash, { ...record, hits: Math.max(0, record.hits ?? 0) });
      }
    } catch {
      this.records.clear();
    }
  }

  private persist(): void {
    if (!this.dirty) return;
    try {
      const values = [...this.records.values()].sort((a, b) => b.lastUsed - a.lastUsed).slice(0, this.limit);
      this.storage.setItem(STORAGE_KEY, JSON.stringify(values));
      this.dirty = false;
    } catch {
      /* حافظه پر است؛ در حافظهٔ جاری نگه می‌داریم */
    }
  }

  get(text: string): CacheRecord | null {
    const hash = packKey(text);
    const record = this.records.get(hash);
    if (!record) return null;
    record.hits += 1;
    record.lastUsed = Date.now();
    this.dirty = true;
    this.persist();
    return record;
  }

  put(text: string, intent: NluIntent, slots: NluSlots, source: CacheRecord["source"] = "model", weight = 1): boolean {
    if (!isRecordSafe(intent, slots)) return false;
    const hash = packKey(text);
    const existing = this.records.get(hash);
    if (existing && existing.hits > weight * 3) return false;
    this.records.set(hash, {
      key: text,
      hash,
      intent,
      slots,
      hits: existing?.hits ?? 0,
      lastUsed: Date.now(),
      source,
    });
    this.evict();
    this.dirty = true;
    this.persist();
    return true;
  }

  private evict(): void {
    if (this.records.size <= this.limit) return;
    const ordered = [...this.records.values()].sort((a, b) => a.lastUsed - b.lastUsed);
    const excess = this.records.size - this.limit;
    for (let index = 0; index < excess; index += 1) this.records.delete(ordered[index].hash);
  }

  setLimit(limit: number): void {
    this.limit = Math.max(20, Math.min(5000, Math.floor(limit)));
    this.evict();
    this.dirty = true;
    this.persist();
  }

  getLimit(): number {
    return this.limit;
  }

  clear(): void {
    this.records.clear();
    this.dirty = false;
    try {
      this.storage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  size(): number {
    return this.records.size;
  }

  stats(): { size: number; limit: number; hits: number; sources: Record<string, number> } {
    const sources: Record<string, number> = {};
    let hits = 0;
    for (const record of this.records.values()) {
      hits += record.hits;
      sources[record.source] = (sources[record.source] ?? 0) + 1;
    }
    return { size: this.records.size, limit: this.limit, hits, sources };
  }

  /** برای تست امنیت: همهٔ مقادیر ذخیره‌شده */
  dump(): CacheRecord[] {
    return [...this.records.values()];
  }

  /** برای تست امنیت: بررسی اینکه هیچ مقدار عددی/مالی ذخیره نشده */
  containsNumbers(): boolean {
    return this.dump().some((record) => /\d/.test(`${record.intent}|${JSON.stringify(record.slots)}`));
  }
}

let singleton: LearnedCache | null = null;

export function learnedCache(): LearnedCache {
  if (!singleton) singleton = new LearnedCache();
  return singleton;
}

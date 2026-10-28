/**
 * کش پاسخ‌های آماده (Answer Cache) — ایمن و بدون هیچ مبلغ
 * ------------------------------------------------------------
 * فقط «نگاشت جملهٔ ماسک‌شده ← شناسهٔ پرسش/پاسخ» ذخیره می‌شود؛ خودِ جواب از
 * بانک ثابت خوانده می‌شود و هرگز مبلغ، موجودی یا نتیجهٔ محاسبه در کش نمی‌آید.
 * بنابراین اگر داده‌های دفتر تغییر کند، پاسخ‌های عددی همیشه تازه محاسبه
 * می‌شوند و کش فقط برای متن ثابت راهنما کار می‌کند.
 *
 * LRU ساده با سقف قابل تنظیم؛ کاملاً محلی و قابل پاک‌سازی.
 */
import { sentenceKey } from "../nlu/normalizer";

export interface AnswerCacheStats {
  size: number;
  limit: number;
  hits: number;
  misses: number;
  storesMoney: false;
}

export interface CachedAnswer {
  id: string;
  tag: string;
  createdAt: number;
}

interface Record_ extends CachedAnswer {
  key: string;
}

export class AnswerCache {
  private readonly map = new Map<string, Record_>();
  private hits = 0;
  private misses = 0;

  constructor(private readonly limit = 600) {}

  /** کلید همیشه ماسک‌شده است؛ متن دارای رقم پذیرفته نمی‌شود. */
  put(question: string, answer: CachedAnswer): boolean {
    const key = sentenceKey(question);
    if (!key || /[0-9۰-۹]/.test(key)) return false;
    this.map.delete(key);
    this.map.set(key, { ...answer, key });
    while (this.map.size > this.limit) {
      const oldest = this.map.keys().next().value;
      if (!oldest) break;
      this.map.delete(oldest);
    }
    return true;
  }

  get(question: string): CachedAnswer | null {
    const key = sentenceKey(question);
    const found = this.map.get(key);
    if (!found) {
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    this.map.delete(key);
    this.map.set(key, found);
    return found;
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }

  size(): number {
    return this.map.size;
  }

  stats(): AnswerCacheStats {
    return { size: this.map.size, limit: this.limit, hits: this.hits, misses: this.misses, storesMoney: false };
  }

  dump(): CachedAnswer[] {
    return [...this.map.values()].map(({ id, tag, createdAt }) => ({ id, tag, createdAt }));
  }
}

const GLOBAL_KEY = "__kishavarAnswerCache";

export function answerCache(): AnswerCache {
  const holder = globalThis as unknown as Record<string, AnswerCache | undefined>;
  if (!holder[GLOBAL_KEY]) holder[GLOBAL_KEY] = new AnswerCache(600);
  return holder[GLOBAL_KEY] as AnswerCache;
}

export function resetAnswerCache(): void {
  const holder = globalThis as unknown as Record<string, AnswerCache | undefined>;
  holder[GLOBAL_KEY] = new AnswerCache(600);
}

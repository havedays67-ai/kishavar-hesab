/**
 * Bloom filter سبک برای «رد سریع» جمله‌های ناشناخته پیش از خواندن بسته
 * ---------------------------------------------------------------------
 * چرا: جستجوی دودویی روی بسته برای جمله‌ای که هرگز دیده نشده، همیشه
 * چند پرش حافظه انجام می‌دهد. با یک بیت‌آرایهٔ کوچک (پیش‌فرض ۱۰ بیت به ازای
 * هر کلید) می‌توان بدون هیچ I/O و با ۱–۲ بار دسترسی به حافظه، «قطعاً
 * نیست» را تشخیص داد. Bloom هیچ‌وقت false-negative ندارد؛ پس هیچ پاسخ
 * درستی از دست نمی‌رود. فقط false-positive ممکن است که در آن حالت
 * جستجوی عادی بسته انجام و پاسخ واقعی برگردانده می‌شود.
 *
 * هیچ متن یا مبلغی ذخیره نمی‌شود؛ فقط بیت‌های هش ۳۲بیتی کلیدِ ماسک‌شده.
 * دو هش مستقل با «دوگانه‌سازی» (Kirsch–Mitzenmacher) از همان هش FNV
 * ساخته می‌شود تا هزینهٔ محاسبه دو برابر نشود.
 */

export const BLOOM_BITS_PER_KEY = 10;
export const BLOOM_HASH_COUNT = 7;
const MAX_BITS = 1 << 29; // سقف ۵۱۲ مگابیت (۶۴MB) برای جلوگیری از تخصیص ناخواسته

export interface BloomFilter {
  bits: Uint8Array;
  bitCount: number;
  hashCount: number;
  keyCount: number;
  byteLength: number;
  /** تخمین نرخ مثبت کاذب برای همین تعداد کلید/بیت (فرمول استاندارد) */
  estimatedFalsePositiveRate: number;
  contains(hash: number): boolean;
}

/** هش دوم مستقل و قطعی (splitmix32) — همان عدد ورودی، خروجی متفاوت. */
export function bloomSecondHash(hash: number): number {
  let value = (hash ^ 0x9e3779b9) >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b) >>> 0;
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

export function estimatedBloomFpr(keyCount: number, bitCount: number, hashCount: number): number {
  if (keyCount <= 0 || bitCount <= 0 || hashCount <= 0) return 0;
  return Number(Math.pow(1 - Math.exp((-hashCount * keyCount) / bitCount), hashCount).toFixed(6));
}

export function bloomFromBits(
  bits: Uint8Array,
  bitCount: number,
  hashCount: number,
  keyCount: number,
): BloomFilter {
  const safeBitCount = Math.max(1, Math.min(MAX_BITS, Math.floor(bitCount)));
  const safeHashCount = Math.max(1, Math.min(16, Math.floor(hashCount)));
  return {
    bits,
    bitCount: safeBitCount,
    hashCount: safeHashCount,
    keyCount,
    byteLength: bits.byteLength,
    estimatedFalsePositiveRate: estimatedBloomFpr(keyCount, safeBitCount, safeHashCount),
    contains(hash: number): boolean {
      const first = hash >>> 0;
      const second = (bloomSecondHash(first) | 1) >>> 0;
      for (let index = 0; index < safeHashCount; index += 1) {
        const position = (first + Math.imul(index, second)) >>> 0;
        const bit = position % safeBitCount;
        if ((bits[bit >>> 3] & (1 << (bit & 7))) === 0) return false;
      }
      return true;
    },
  };
}

/** ساخت فیلتر از هش‌های کلید. */
export function buildBloom(
  hashes: Iterable<number>,
  bitsPerKey = BLOOM_BITS_PER_KEY,
  hashCount = BLOOM_HASH_COUNT,
): BloomFilter {
  const values: number[] = [];
  for (const hash of hashes) values.push(hash >>> 0);
  // آرایه بایت‌به‌بایت ذخیره می‌شود؛ پس تعداد بیت باید مضرب ۸ باشد تا
  // هنگام خواندن فایل، همان bitCount بازسازی شود (وگرنه false-negative).
  const rawBits = Math.min(MAX_BITS, Math.max(8, values.length * Math.max(1, bitsPerKey)));
  const bitCount = Math.ceil(rawBits / 8) * 8;
  const bytes = new Uint8Array(Math.ceil(bitCount / 8));
  const safeHashCount = Math.max(1, Math.min(16, hashCount));
  for (const first of values) {
    const second = (bloomSecondHash(first) | 1) >>> 0;
    for (let index = 0; index < safeHashCount; index += 1) {
      const position = (first + Math.imul(index, second)) >>> 0;
      const bit = position % bitCount;
      bytes[bit >>> 3] |= 1 << (bit & 7);
    }
  }
  return bloomFromBits(bytes, bitCount, safeHashCount, values.length);
}

/** اندازهٔ بایت لازم برای bloom با n کلید و bitsPerKey داده‌شده. */
export function bloomByteSize(keyCount: number, bitsPerKey = BLOOM_BITS_PER_KEY): number {
  return Math.ceil(Math.max(8, keyCount * Math.max(1, bitsPerKey)) / 8);
}

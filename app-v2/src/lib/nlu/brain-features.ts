/**
 * استخراج ویژگی مشترک برای «مغز آماری CPU»
 * ------------------------------------------------------------
 * همین تابع هم در آموزش (tools/train) و هم روی گوشی اجرا می‌شود؛ بنابراین
 * بردار ویژگی در آموزش و استنتاج دقیقاً یکی است و اختلاف train/serve نداریم.
 *
 * نکات:
 *  - ورودی با نرمال‌ساز همان اپ نرمال و «ماسک اعداد» می‌شود؛ پس هیچ مبلغی
 *    در ویژگی‌ها و در نتیجه در وزن‌های مدل ذخیره نمی‌شود.
 *  - هش FNV-1a + سطل ثابت (4096) → حافظهٔ ثابت و کوچک روی گوشی.
 *  - کاملاً عدد صحیح و قطعی؛ بدون شبکه و بدون GPU.
 */
import { sentenceKey } from "./normalizer";
import { correctWord } from "./persian-lexicon";

export const BRAIN_BUCKETS = 4096;
export const BRAIN_FEATURE_VERSION = 1;

/** وزن ویژگی‌ها: واژه، ترکیب دو واژه، و n-gram نویسه‌ای برای غلط‌املایی */
export const FEATURE_WEIGHTS = { word: 2, bigram: 1, char4: 1 } as const;

export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export interface BrainFeature {
  bucket: number;
  weight: number;
}

/** بردار ویژگی اسپارس (بدون تخصیص آبجکت سنگین) */
export function brainFeatures(raw: string): BrainFeature[] {
  const text = sentenceKey(raw);
  if (!text) return [];
  const tokens = text.split(" ").filter(Boolean);
  const features: BrainFeature[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    features.push({ bucket: fnv1a(`w:${token}`) % BRAIN_BUCKETS, weight: FEATURE_WEIGHTS.word });
    // نسخهٔ تصحیح‌شده با واژگان فارسی آموخته‌شده (تحمل غلط املایی) —
    // همان قاعده در آموزش و استنتاج، پس train/serve یکسان است.
    const fixed = correctWord(token);
    if (fixed !== token) features.push({ bucket: fnv1a(`w:${fixed}`) % BRAIN_BUCKETS, weight: FEATURE_WEIGHTS.word });
    if (index + 1 < tokens.length) {
      features.push({ bucket: fnv1a(`b:${token} ${tokens[index + 1]}`) % BRAIN_BUCKETS, weight: FEATURE_WEIGHTS.bigram });
    }
    const padded = `^${token}$`;
    if (padded.length >= 5) {
      for (let start = 0; start + 4 <= padded.length; start += 1) {
        features.push({ bucket: fnv1a(`c:${padded.slice(start, start + 4)}`) % BRAIN_BUCKETS, weight: FEATURE_WEIGHTS.char4 });
      }
    }
  }
  return features;
}

export function featureBuckets(raw: string): number[] {
  return brainFeatures(raw).map((feature) => feature.bucket);
}

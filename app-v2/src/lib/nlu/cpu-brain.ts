/**
 * مغز آماری سبک روی پردازندهٔ گوشی (Naive Bayes با وزن int8)
 * ------------------------------------------------------------
 * - فقط وقتی صدا زده می‌شود که قواعد و بستهٔ پاسخ جواب نداده باشند.
 * - محاسبه کاملاً عدد صحیح است: جمع وزن‌های int8 برای هر قصد؛ بدون اعشار
 *   سنگین، بدون JSON و بدون تخصیص بزرگ → مناسب گوشی ۶ گیگ و مصرف باتری کم.
 * - حجم مدل: قصدها × ۴۰۹۶ وزن int8 (حدود ۱۰۰ کیلوبایت) که فقط یک‌بار decode می‌شود.
 * - هیچ مبلغ/عددی از کاربر ذخیره نمی‌شود؛ ویژگی‌ها از متن ماسک‌شده ساخته می‌شوند.
 */
import { BRAIN_META, BRAIN_LABELS, BRAIN_PRIORS_B64, BRAIN_WEIGHTS_B64 } from "./generated/brain";
import { BRAIN_BUCKETS, brainFeatures, fnv1a } from "./brain-features";
import { sentenceKey } from "./normalizer";
import { detectSlots, type NluIntent, type NluSlots } from "./rules";

export interface BrainPrediction {
  intent: NluIntent;
  confidence: number;
  /** فاصلهٔ امتیاز بهترین و دومی (عدد صحیح) — معیار اطمینان */
  margin: number;
  slots: NluSlots;
  features: number;
}

let weights: Int8Array | null = null;
let priors: Int16Array | null = null;

function decodeBase64(value: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }
  const bufferCtor = (globalThis as unknown as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
  if (bufferCtor) return new Uint8Array(bufferCtor.from(value, "base64"));
  throw new Error("base64 decode unavailable");
}

function model(): { weights: Int8Array; priors: Int16Array } {
  if (!weights || !priors) {
    const raw = decodeBase64(BRAIN_WEIGHTS_B64);
    weights = new Int8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    const rawPriors = decodeBase64(BRAIN_PRIORS_B64);
    priors = new Int16Array(rawPriors.buffer, rawPriors.byteOffset, rawPriors.byteLength / 2);
  }
  return { weights, priors };
}

export function brainAvailable(): boolean {
  return BRAIN_META.labels > 0 && BRAIN_META.buckets === BRAIN_BUCKETS;
}

/**
 * استنتاج قطعی. اگر ویژگی شناخته‌شده‌ای نبود یا اطمینان کم بود، null برمی‌گردد
 * تا Router با خیال راحت سؤال شفاف بپرسد (هیچ حدسی ثبت نمی‌شود).
 */
export function classifyWithBrain(raw: string, options: { minConfidence?: number } = {}): BrainPrediction | null {
  if (!brainAvailable()) return null;
  const features = brainFeatures(raw);
  if (features.length === 0) return null;
  const { weights: matrix, priors: priorValues } = model();
  const labels = BRAIN_LABELS.length;
  const scores = new Int32Array(labels);
  for (let label = 0; label < labels; label += 1) scores[label] = priorValues[label] ?? 0;
  let known = 0;
  for (const feature of features) {
    for (let label = 0; label < labels; label += 1) {
      const value = matrix[label * BRAIN_BUCKETS + feature.bucket];
      if (value !== 0) known += 1;
      scores[label] += value * feature.weight;
    }
  }
  // «ویژگی شناخته‌شده» کم یعنی جمله هیچ واژهٔ آموخته‌شده‌ای ندارد → حدس نزن
  if (known < labels) return null;
  // نسبت واژه‌های آموخته‌شده: جملهٔ بی‌معنا ویژگی نویسه‌ای دارد ولی واژهٔ واقعی ندارد
  const tokens = sentenceKey(raw).split(" ").filter(Boolean);
  let knownTokens = 0;
  for (const token of tokens) {
    const bucket = fnv1a(`w:${token}`) % BRAIN_BUCKETS;
    for (let label = 0; label < labels; label += 1) {
      if (matrix[label * BRAIN_BUCKETS + bucket] !== 0) {
        knownTokens += 1;
        break;
      }
    }
  }
  if (tokens.length === 0 || knownTokens / tokens.length < 0.34) return null;
  let best = 0;
  let second = -1;
  for (let label = 1; label < labels; label += 1) {
    if (scores[label] > scores[best]) {
      second = best;
      best = label;
    } else if (second === -1 || scores[label] > scores[second]) {
      second = label;
    }
  }
  const margin = scores[best] - (second >= 0 ? scores[second] : 0);
  const confidence = Number(Math.max(0, Math.min(0.97, 0.5 + margin / 400)).toFixed(3));
  // پیش‌فرض محافظه‌کارانه: جملهٔ بی‌معنا یا کم‌اطمینان هرگز برچسب نمی‌گیرد
  const minConfidence = options.minConfidence ?? 0.6;
  if (confidence < minConfidence) return null;
  const intent = BRAIN_LABELS[best] as NluIntent;
  if (intent === "unknown") return null;
  return {
    intent,
    confidence,
    margin,
    slots: detectSlots(raw, intent),
    features: features.length,
  };
}

/** برای آزمون پایداری: هش ویژگی‌ها بدون اجرای مدل */
export function brainFeatureDigest(raw: string): number {
  const features = brainFeatures(raw);
  let digest = 0x811c9dc5;
  for (const feature of features) digest = (digest ^ fnv1a(`${feature.bucket}:${feature.weight}`)) >>> 0;
  return digest;
}

export const CPU_BRAIN_VERSION = BRAIN_META.version;

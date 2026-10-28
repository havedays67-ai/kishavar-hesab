/**
 * Router لایهٔ فهم سریع + سنجه‌ها (Metrics)
 * ------------------------------------------------------------
 * ترتیب ثابت (هر سطح که اطمینان کافی داد، بقیه اجرا نمی‌شوند):
 *   ۱) Normalizer
 *   ۲) Rule Engine
 *   ۳) Answer Pack و Learned Cache
 *   ۴) بازیاب معنایی (فقط حالت پشتیبان)
 *   ۵) مدل کوچک (آخرین راه) — فعلاً وصل نیست
 *
 * سنجه‌ها محلی‌اند و هیچ دادهٔ مالی یا متن سؤال را ذخیره نمی‌کنند:
 * فقط شمارش hit هر سطح، زمان پاسخ (میانگین/p95)، تعداد فراخوانی مدل،
 * تخمین RAM و تخمین مصرف باتری.
 */
import { normalizePersian, normalizeAndKey } from "./normalizer";
import { runRules, type NluIntent, type NluSlots } from "./rules";
import { packKey, type PackIndex } from "./pack";
import { learnedCache, type LearnedCache } from "./learned-cache";
import { RETRIEVAL_THRESHOLD, type RetrieverIndex } from "./retriever";
import { runModelFallback, isModelAvailable } from "./model";
import { classifyWithBrain, brainAvailable } from "./cpu-brain";

export type FastLayer = "rules" | "cache" | "pack" | "brain" | "retrieval" | "model" | "clarify";

export interface SupportSnippet {
  id: string;
  title: string;
  text: string;
  score: number;
}

export interface RouteResult {
  layer: FastLayer;
  intent: NluIntent;
  slots: NluSlots;
  confidence: number;
  latencyMs: number;
  normalized: string;
  support?: SupportSnippet;
  clarifyingQuestion?: string;
  matched?: string;
}

export interface LayerCounters {
  rules: number;
  cache: number;
  pack: number;
  brain: number;
  retrieval: number;
  model: number;
  clarify: number;
}

export interface MetricsSnapshot {
  total: number;
  counters: LayerCounters;
  /** جمله‌هایی که bloom با اطمینان گفت «در بسته نیست» و جستجوی دودویی انجام نشد */
  bloomRejects: number;
  hitRate: LayerCounters & { fast: number };
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  modelCalls: number;
  peakRamBytes: number;
  batteryEstimateMah: number;
  packBytes: number;
}

const MAX_SAMPLES = 400;

class FastLayerMetrics {
  private counters: LayerCounters = { rules: 0, cache: 0, pack: 0, brain: 0, retrieval: 0, model: 0, clarify: 0 };
  private samples: number[] = [];
  private modelCalls = 0;
  private packBytes = 0;
  private bloomRejects = 0;

  record(layer: FastLayer, latencyMs: number, extra?: { modelCall?: boolean; packBytes?: number; bloomReject?: boolean }): void {
    this.counters[layer] += 1;
    this.samples.push(latencyMs);
    if (this.samples.length > MAX_SAMPLES) this.samples.shift();
    if (extra?.modelCall) this.modelCalls += 1;
    if (extra?.packBytes) this.packBytes = extra.packBytes;
    if (extra?.bloomReject) this.bloomRejects += 1;
  }

  snapshot(): MetricsSnapshot {
    const total = Object.values(this.counters).reduce((sum, value) => sum + value, 0);
    const sorted = [...this.samples].sort((a, b) => a - b);
    const percentile = (value: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((value / 100) * sorted.length))] : 0);
    const avgMs = sorted.length ? sorted.reduce((sum, value) => sum + value, 0) / sorted.length : 0;
    const fast = this.counters.rules + this.counters.cache + this.counters.pack;
    const ratio = (value: number) => (total ? Number(((value / total) * 100).toFixed(1)) : 0);
    return {
      total,
      bloomRejects: this.bloomRejects,
      counters: { ...this.counters },
      hitRate: { ...this.counters, fast: ratio(fast) } as MetricsSnapshot["hitRate"],
      avgMs: Number(avgMs.toFixed(2)),
      p50Ms: Number(percentile(50).toFixed(2)),
      p95Ms: Number(percentile(95).toFixed(2)),
      modelCalls: this.modelCalls,
      // تخمین: ۱۴ بایت سرآیند هر رکورد در ایندکس هش + سقف ۲۴۰ بایت برای هر رکورد کش
      peakRamBytes: this.packBytes + learnedCache().size() * 240 + 48 * 1024,
      // تخمین محافظه‌کارانه: ۰٫۶ میلی‌آمپر در حالت پردازش فعال
      batteryEstimateMah: Number(((avgMs / 1000) * 0.6).toFixed(4)),
      packBytes: this.packBytes,
    };
  }

  reset(): void {
    this.counters = { rules: 0, cache: 0, pack: 0, brain: 0, retrieval: 0, model: 0, clarify: 0 };
    this.samples = [];
    this.modelCalls = 0;
  }

  setPackBytes(bytes: number): void {
    this.packBytes = bytes;
  }
}

export const fastLayerMetrics = new FastLayerMetrics();

/** آستانهٔ پذیرش مغز CPU؛ زیر آن، برنامه صادقانه سؤال می‌پرسد. */
export const BRAIN_THRESHOLD = 0.86;

export interface RouteOptions {
  mode: "support" | "assistant";
  pack?: PackIndex | null;
  cache?: LearnedCache | null;
  retriever?: RetrieverIndex | null;
  useRules?: boolean;
  usePack?: boolean;
  useCache?: boolean;
  useRetrieval?: boolean;
  useBrain?: boolean;
}

const DATA_INTENTS = new Set<NluIntent>([
  "report_receivable", "report_payable", "report_cash", "report_profit", "report_cheques", "report_inventory",
]);

/** آیا این intent باید پاسخ عددی از موتور قطعی بگیرد؟ (هرگز از کش/بسته) */
export function needsDeterministicAnswer(intent: NluIntent): boolean {
  return DATA_INTENTS.has(intent);
}

export function clarifyingFor(intent: NluIntent): string {
  switch (intent) {
    case "add_expense":
    case "purchase_input":
      return "متوجه شدم هزینه است؛ بگویید بابت چه چیزی (کود، بذر، کارگر…) و برای کدام زمین/کشت بود تا پیش‌نویس بسازم.";
    case "sale_crop":
    case "add_income":
      return "برای ثبت فروش، مقدار (کیلوگرم/تن)، محصول و نام خریدار را بگویید؛ مبلغ نهایی و افت را موتور خودش حساب می‌کند.";
    case "wage_payment":
      return "نام کارگر و تعداد نفر-روز را بگویید تا پیش‌نویس دستمزد ساخته شود.";
    case "cheque_received":
    case "cheque_paid":
      return "برای چک، شماره، تاریخ سررسید و نام طرف‌حساب را بگویید. توجه: چک قانونی باید در سامانهٔ صیاد ثبت شود.";
    default:
      return "سؤال را کمی روشن‌تر بنویسید: موضوع (مالی، سند، کشاورزی) و اگر عدد می‌خواهید، بازهٔ زمانی را هم بگویید.";
  }
}

/** مسیر همگام (بدون مدل) — برای رابط فعلی برنامه. */
export function routeFast(raw: string, options: RouteOptions): RouteResult {
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const { text, key, hash } = normalizeAndKey(raw);
  // bloom فقط زمانی معنا دارد که بسته در اختیار باشد؛ نتیجه‌اش «قطعاً نیست» است
  // و در شمارنده‌ها ثبت می‌شود تا نرخ رد سریع قابل سنجش باشد.
  const bloomReject = Boolean(
    options.usePack !== false && options.pack && !options.pack.mightContainHash(hash),
  );
  const finish = (layer: FastLayer, result: Omit<RouteResult, "layer" | "latencyMs" | "normalized">): RouteResult => {
    const latencyMs = Number(((typeof performance !== "undefined" ? performance.now() : Date.now()) - started).toFixed(3));
    fastLayerMetrics.record(layer, latencyMs, { packBytes: options.pack?.manifest.bytes, bloomReject: bloomReject && layer !== "pack" });
    return { ...result, layer, latencyMs, normalized: text };
  };

  // ۲) قواعد قطعی
  if (options.useRules !== false) {
    const rule = runRules(raw);
    if (rule) {
      return finish("rules", { intent: rule.intent, slots: rule.slots, confidence: rule.confidence, matched: rule.matched });
    }
  }

  // ۳-الف) کش یادگیری موضعی
  if (options.useCache !== false) {
    const cache = options.cache ?? learnedCache();
    const cached = cache.get(key);
    if (cached) {
      return finish("cache", {
        intent: cached.intent,
        slots: cached.slots,
        confidence: 0.82,
        matched: `cache:${cached.source}`,
      });
    }
  }

  // ۳-ب) بستهٔ پاسخ
  if (options.usePack !== false && options.pack) {
    // هش از قبل محاسبه شده؛ لوکاپ دوباره نرمال‌سازی نمی‌کند
    const hit = options.pack.lookupByHash(hash);
    if (hit) {
      return finish("pack", { intent: hit.intent, slots: hit.slots, confidence: 0.78, matched: "pack" });
    }
  }

  // ۳-ج) مغز آماری CPU — فقط اگر قواعد/کش/بسته جواب نداده باشند
  if (options.useBrain !== false && brainAvailable()) {
    const brain = classifyWithBrain(raw, { minConfidence: BRAIN_THRESHOLD });
    if (brain) {
      return finish("brain", { intent: brain.intent, slots: brain.slots, confidence: brain.confidence, matched: "cpu-brain" });
    }
  }

  // ۴) بازیاب معنایی — فقط حالت پشتیبان
  if (options.mode === "support" && options.useRetrieval !== false && options.retriever) {
    const [best] = options.retriever.lookup(text, 1);
    if (best && best.score >= RETRIEVAL_THRESHOLD) {
      return finish("retrieval", {
        intent: "app_help",
        slots: {},
        confidence: Number(best.confidence.toFixed(3)),
        support: {
          id: best.doc.id,
          title: best.doc.title,
          text: best.doc.text,
          score: Number(best.score.toFixed(3)),
        },
        matched: "tfidf",
      });
    }
  }

  const safe = normalizePersian(raw);
  if (!safe) {
    return finish("clarify", { intent: "unknown", slots: {}, confidence: 0, clarifyingQuestion: "سؤال‌تان را بنویسید تا راهنمایی کنم." });
  }
  return finish("clarify", {
    intent: "unknown",
    slots: {},
    confidence: 0,
    clarifyingQuestion: clarifyingFor("unknown"),
    matched: "no-hit",
  });
}

/** مسیر کامل با مدل (آخرین راه) — برای استفادهٔ آیندهٔ رابط غیرهمگام. */
export async function routeWithModel(raw: string, options: RouteOptions): Promise<RouteResult> {
  const fast = routeFast(raw, options);
  if (fast.layer !== "clarify") return fast;
  if (!isModelAvailable()) return fast;
  const { text, hash } = normalizeAndKey(raw);
  const started = typeof performance !== "undefined" ? performance.now() : Date.now();
  const outcome = await runModelFallback(text, String(hash));
  const latencyMs = Number(((typeof performance !== "undefined" ? performance.now() : Date.now()) - started).toFixed(3));
  if (!outcome.value) {
    fastLayerMetrics.record("clarify", latencyMs, { modelCall: true, packBytes: options.pack?.manifest.bytes });
    return { ...fast, latencyMs: Number((fast.latencyMs + latencyMs).toFixed(3)) };
  }
  fastLayerMetrics.record("model", latencyMs, { modelCall: true });
  const cache = options.cache ?? learnedCache();
  cache.put(text, outcome.value.intent, outcome.value.slots, "model");
  return {
    layer: "model",
    intent: outcome.value.intent,
    slots: outcome.value.slots,
    confidence: outcome.value.confidence,
    latencyMs,
    normalized: text,
    matched: "model",
  };
}

export function packHitProbe(pack: PackIndex | null | undefined, texts: string[]): number {
  if (!pack) return 0;
  const hits = texts.filter((text) => {
    const key = packKey(text);
    return pack.lookupByHash(key) !== null;
  }).length;
  return texts.length ? Number(((hits / texts.length) * 100).toFixed(2)) : 0;
}

export const FAST_LAYER_VERSION = "1.0.0";

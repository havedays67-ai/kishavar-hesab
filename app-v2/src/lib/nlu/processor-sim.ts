/**
 * شبیه‌ساز پردازندهٔ لایهٔ فهم (CPU pipeline simulator)
 * ------------------------------------------------------------
 * این ماژول «پردازندهٔ واقعی» نیست و ادعای هم‌ارزی با GPU یا ART نمی‌کند.
 * کاری که می‌کند: هزینهٔ محاسباتی هر لایه را با شمارش عملیات عدد صحیح
 * (هش، مقایسه، جمع/ضرب وزن int8) مدل می‌کند تا روی گوشی بفهمیم کدام لایه
 * گلوگاه است و آیا «مغز CPU» از فراخوانی مدل سبک‌تر است یا نه.
 *
 * خروجی فقط شمارش و تخمین است؛ هیچ دادهٔ مالی یا متن کاربر ذخیره نمی‌شود.
 */
import { brainFeatures, BRAIN_BUCKETS } from "./brain-features";
import { classifyWithBrain } from "./cpu-brain";
import { openPack, packKey, type PackIndex } from "./pack";
import { runRules } from "./rules";
import { normalizeAndKey } from "./normalizer";

export interface LayerSimulation {
  layer: "normalizer" | "rules" | "bloom" | "pack" | "brain" | "clarify";
  intOps: number;
  memoryReads: number;
  accepted: boolean;
  note: string;
}

export interface PipelineSimulation {
  text: string;
  steps: LayerSimulation[];
  totalIntOps: number;
  /** تخمین چرخهٔ CPU با فرض ۳ عملیات ساده در هر چرخه (صرفاً مدل) */
  estimatedCycles: number;
  estimatedMicrosAt1Ghz: number;
  acceptedLayer: string;
  /** مقایسه با فراخوانی مدل (در این نسخه مدل همراه APK نیست) */
  modelCallEstimate: { available: boolean; note: string; relativeCostVsBrain: number | null };
}

/** تخمین هزینهٔ یک فراخوانی مدل کوچک کوانتیزه روی گوشی (میلی‌ثانیه) — عدد ادعایی نیست */
export const MODEL_CALL_ESTIMATE_MS_NOTE = "مدل همراه APK نیست؛ عدد اندازه‌گیری نشده است.";

export function simulatePipeline(raw: string, pack?: PackIndex | null): PipelineSimulation {
  const steps: LayerSimulation[] = [];
  const { text, hash } = normalizeAndKey(raw);
  steps.push({
    layer: "normalizer",
    intOps: Math.max(1, text.length * 3),
    memoryReads: 0,
    accepted: false,
    note: "نرمال‌سازی + ماسک اعداد؛ هیچ عددی در کلید نمی‌ماند",
  });

  const rule = runRules(raw);
  const ruleWords = text.split(" ").length;
  steps.push({
    layer: "rules",
    intOps: ruleWords * 45,
    memoryReads: ruleWords,
    accepted: Boolean(rule),
    note: rule ? `قاعدهٔ ${rule.matched}` : "قواعد مطمئن نبودند",
  });
  if (rule) return finish(text, steps, "rules");

  if (pack) {
    const might = pack.mightContainHash(hash);
    steps.push({
      layer: "bloom",
      intOps: might ? 28 : 7,
      memoryReads: 1,
      accepted: might,
      note: might ? "شاید باشد → جستجوی دودویی" : "قطعاً نیست → جستجو انجام نشد",
    });
    if (might) {
      const hit = pack.lookupByHash(hash);
      steps.push({
        layer: "pack",
        intOps: 160,
        memoryReads: 6,
        accepted: Boolean(hit),
        note: hit ? `بسته: ${hit.intent}` : "در بسته نبود",
      });
      if (hit) return finish(text, steps, "pack");
    }
  }

  const brain = classifyWithBrain(raw, { minConfidence: 0.86 });
  const features = brainFeatures(raw).length;
  steps.push({
    layer: "brain",
    intOps: features * 26 * 2 + 26,
    memoryReads: features,
    accepted: Boolean(brain),
    note: brain ? `مغز CPU: ${brain.intent} (${brain.confidence})` : "مغز مطمئن نبود → سؤال شفاف",
  });
  if (brain) return finish(text, steps, "brain");
  return finish(text, steps, "clarify");
}

function finish(text: string, steps: LayerSimulation[], acceptedLayer: string): PipelineSimulation {
  const totalIntOps = steps.reduce((sum, step) => sum + step.intOps, 0);
  const estimatedCycles = Math.ceil(totalIntOps / 3);
  return {
    text,
    steps,
    totalIntOps,
    estimatedCycles,
    estimatedMicrosAt1Ghz: Number((estimatedCycles / 1000).toFixed(2)),
    acceptedLayer,
    modelCallEstimate: {
      available: false,
      note: MODEL_CALL_ESTIMATE_MS_NOTE,
      relativeCostVsBrain: null,
    },
  };
}

export interface SimulatorReport {
  samples: number;
  accepted: Record<string, number>;
  avgIntOps: number;
  avgEstimatedMicrosAt1Ghz: number;
  brainShare: number;
  maxIntOpsSample: { intOps: number; layer: string };
}

/** اجرای شبیه‌ساز روی مجموعه‌ای از جمله‌ها (برای صفحهٔ عیب‌یابی و ارزیابی) */
export function simulateBatch(texts: string[], pack?: PackIndex | null): SimulatorReport {
  const accepted: Record<string, number> = {};
  let ops = 0;
  let micros = 0;
  let maxIntOpsSample = { intOps: 0, layer: "none" };
  for (const text of texts) {
    const simulation = simulatePipeline(text, pack);
    accepted[simulation.acceptedLayer] = (accepted[simulation.acceptedLayer] ?? 0) + 1;
    ops += simulation.totalIntOps;
    micros += simulation.estimatedMicrosAt1Ghz;
    if (simulation.totalIntOps > maxIntOpsSample.intOps) maxIntOpsSample = { intOps: simulation.totalIntOps, layer: simulation.acceptedLayer };
  }
  const samples = Math.max(1, texts.length);
  return {
    samples: texts.length,
    accepted,
    avgIntOps: Number((ops / samples).toFixed(1)),
    avgEstimatedMicrosAt1Ghz: Number((micros / samples).toFixed(2)),
    brainShare: Number((((accepted.brain ?? 0) / samples) * 100).toFixed(2)),
    maxIntOpsSample,
  };
}

/** برای بازسازی بسته از بایت‌ها در ابزارهای تست/بنچمارک */
export function simulateWithBytes(texts: string[], bytes: Uint8Array): SimulatorReport {
  return simulateBatch(texts, openPack(bytes));
}

export const SIMULATOR_VERSION = "1.0.0";
export const SIMULATOR_BUCKETS = BRAIN_BUCKETS;
void packKey;

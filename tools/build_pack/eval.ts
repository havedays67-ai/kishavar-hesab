/**
 * ارزیابی واقعی لایهٔ فهم سریع روی مجموعهٔ سختِ دیده‌نشده
 * اجرا: npx tsx tools/build_pack/eval.ts
 * خروجی: eval_report.json + docs/AI-EVAL.md (جدول واقعی، بدون ادعا)
 */
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR, ROOT, readJsonl, type EvalRow } from "./lib";
import { LearnedCache } from "../../app-v2/src/lib/nlu/learned-cache";
import { openPack, encodePack, type PackBuildItem } from "../../app-v2/src/lib/nlu/pack";
import { buildRetriever, type RetrievalDoc } from "../../app-v2/src/lib/nlu/retriever";
import { fastLayerMetrics, routeFast, type RouteOptions, type RouteResult } from "../../app-v2/src/lib/nlu/router";
import { validateModelOutput } from "../../app-v2/src/lib/nlu/model";
import { runRules } from "../../app-v2/src/lib/nlu/rules";
import { hashKey, sentenceKey } from "../../app-v2/src/lib/nlu/normalizer";
import { KNOWLEDGE } from "../../app-v2/src/lib/ai/knowledge";
import type { CorpusRow } from "./lib";

interface Metrics {
  total: number;
  classified: number;
  intentAccuracy: number;
  slotExactMatch: number;
  slotPrecision: number;
  slotRecall: number;
  clarifyRate: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  layers: Record<string, number>;
}

function score(rows: EvalRow[], results: RouteResult[], skipRetrieval = false): Metrics {
  let intentHits = 0;
  let classified = 0;
  let exact = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let clarify = 0;
  results.forEach((result, index) => {
    const expected = rows[index];
    // لایهٔ بازیابی «پاسخ دانشنامه» است نه طبقه‌بندی intent؛ جدا سنجیده می‌شود.
    const countable = !(skipRetrieval && result.layer === "retrieval");
    if (countable) {
      classified += 1;
      if (result.intent === expected.intent) intentHits += 1;
    }
    const expectedSlots = expected.slots as Record<string, string>;
    const actualSlots = result.slots as Record<string, string>;
    const expectedKeys = Object.keys(expectedSlots);
    const matches = expectedKeys.filter((key) => actualSlots[key] === expectedSlots[key]).length;
    if (matches === expectedKeys.length && Object.keys(actualSlots).length === expectedKeys.length) exact += 1;
    tp += matches;
    fn += expectedKeys.length - matches;
    fp += Object.keys(actualSlots).filter((key) => actualSlots[key] !== expectedSlots[key]).length;
    if (result.layer === "clarify") clarify += 1;
  });
  const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
  const pct = (value: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor((value / 100) * latencies.length))] : 0);
  return {
    total: rows.length,
    classified,
    intentAccuracy: Number(((intentHits / Math.max(1, classified)) * 100).toFixed(2)),
    slotExactMatch: Number(((exact / rows.length) * 100).toFixed(2)),
    slotPrecision: Number(((tp / Math.max(1, tp + fp)) * 100).toFixed(2)),
    slotRecall: Number(((tp / Math.max(1, tp + fn)) * 100).toFixed(2)),
    clarifyRate: Number(((clarify / rows.length) * 100).toFixed(2)),
    avgMs: Number((latencies.reduce((sum, value) => sum + value, 0) / Math.max(1, latencies.length)).toFixed(3)),
    p50Ms: Number(pct(50).toFixed(3)),
    p95Ms: Number(pct(95).toFixed(3)),
    layers: results.reduce<Record<string, number>>((acc, result) => {
      acc[result.layer] = (acc[result.layer] ?? 0) + 1;
      return acc;
    }, {}),
  };
}

function run(rows: EvalRow[], options: RouteOptions): RouteResult[] {
  return rows.map((row) => routeFast(row.text, options));
}

function main(): void {
  const hardPath = join(DATA_DIR, "hard-eval.jsonl");
  if (!existsSync(hardPath)) throw new Error("hard-eval.jsonl missing — run generate.ts first");
  const corpus = readJsonl<CorpusRow>(join(DATA_DIR, "corpus.jsonl"));
  const hard = readJsonl<EvalRow>(hardPath);

  const dataset = corpus.filter((row) => row.source === "dataset");
  const synthetic = corpus.filter((row) => row.source === "synthetic");
  const items: PackBuildItem[] = [...dataset, ...synthetic.slice(0, 6000)].map((row) => ({
    text: row.text,
    intent: row.intent,
    slots: row.slots,
  }));
  const pack = openPack(encodePack(items, { version: "1.0.0", builtFrom: "corpus.jsonl", syntheticShare: 0.9 }));
  const docs: RetrievalDoc[] = KNOWLEDGE.map((entry: (typeof KNOWLEDGE)[number]) => ({
    id: entry.id,
    title: entry.title,
    text: entry.answer,
    category: entry.category,
  }));
  const retriever = buildRetriever(docs);

  // ۱) قواعد تنها
  fastLayerMetrics.reset();
  const rulesOnly = run(hard, { mode: "assistant", usePack: false, useCache: false, useRetrieval: false });

  // ۲) بسته تنها (بدون قواعد)
  fastLayerMetrics.reset();
  const packOnly = run(hard, { mode: "assistant", useRules: false, useCache: false, useRetrieval: false, pack });

  // ۳) خط لولهٔ کامل (بدون مدل) در حالت پشتیبان
  fastLayerMetrics.reset();
  const cache = new LearnedCache(undefined, 500);
  cache.clear();
  const full = run(hard, { mode: "support", pack, cache, retriever });

  // ۴) شبیه‌سازی یادگیری: پس از تأیید کاربر، پاسخ‌های درست وارد کش می‌شوند
  full.forEach((result, index) => {
    if (result.layer === "clarify" || result.intent !== hard[index].intent) return;
    cache.put(hard[index].text, result.intent, result.slots, "user");
  });
  const replay = hard.map((row) => routeFast(row.text, { mode: "support", pack, cache, retriever }));
  const cacheHits = replay.filter((result) => result.layer === "cache").length;

  // ۵) قرارداد JSON مدل: اعتبارسنج سخت روی ورودی‌های سالم/خراب
  let acceptedValid = 0;
  let rejectedInvalid = 0;
  const sample = hard.slice(0, 120);
  for (const row of sample) {
    const good = JSON.stringify({ intent: row.intent, slots: row.slots, confidence: 0.9 });
    if (validateModelOutput(good).ok) acceptedValid += 1;
    const broken = `${good.slice(0, Math.max(5, good.length - 4))}  ,, }`;
    if (!validateModelOutput(broken).ok) rejectedInvalid += 1;
  }

  // ۶) توزیع Hit و سنجه‌های معماری
  const rulesHits = hard.filter((row) => runRules(row.text) !== null).length;
  const metrics = fastLayerMetrics.snapshot();

  const byScenario = (["common", "colloquial", "novel"] as const).map((scenario) => {
    const subset = hard.filter((row) => row.scenario === scenario);
    const subsetResults = full.filter((_, index) => hard[index].scenario === scenario);
    return { scenario, ...score(subset, subsetResults) };
  });

  const report = {
    generatedAt: new Date().toISOString(),
    architectureVersion: "1.0.0",
    dataset: {
      hardEval: hard.length,
      source: "synthetic-held-out (never in pack/cache/training corpus)",
      packEntries: pack.manifest.count,
      packBytes: pack.manifest.bytes,
      packChecksum: pack.manifest.checksum,
    },
    fastLayer: score(hard, full),
    fastLayerClassification: score(hard, full, true),
    rulesOnly: score(hard, rulesOnly),
    packOnly: score(hard, packOnly),
    byScenario,
    learnedCache: {
      simulated: true,
      beforeCacheLayer: full.filter((result) => result.layer === "cache").length,
      afterConfirmationCacheHits: cacheHits,
      cacheSize: cache.size(),
      storesMoney: cache.containsNumbers(),
    },
    jsonContract: {
      acceptedValidJson: acceptedValid,
      sampleSize: sample.length,
      rejectedCorruptedJson: rejectedInvalid,
      note: "اعتبارسنج سخت؛ مدل روی دستگاه در این نسخه همراه APK نیست، بنابراین نرخ JSON مدل واقعی اندازه‌گیری نشده است.",
    },
    model: {
      status: "not-available",
      reason: "هیچ وزن مدلی در مخزن/APK نیست؛ Router بدون مدل کار می‌کند و در ناشناخته‌ها سؤال شفاف می‌پرسد.",
      modelOnlyBaseline: "not-measured",
    },
    bloom: (() => {
      const probes = 2000;
      let seed = 987654321;
      let tested = 0;
      let falsePositives = 0;
      // نرخ false-positive واقعی: کلیدهای تصادفی که در بسته نیستند
      while (tested < probes) {
        seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
        if (pack.lookupByHash(seed) !== null) continue;
        tested += 1;
        if (pack.bloom?.contains(seed)) falsePositives += 1;
      }
      const manifestBloom = pack.manifest;
      // زمان «بررسی bloom با هش آماده» جدا از هزینهٔ نرمال‌سازی سنجیده می‌شود
      const codePoints = hard.map((row) => hashKey(sentenceKey(row.text)));
      let bloomRejects = 0;
      const started = performance.now();
      for (const hash of codePoints) if (!pack.mightContainHash(hash)) bloomRejects += 1;
      const probeMs = Number(((performance.now() - started) / Math.max(1, hard.length)).toFixed(5));
      return {
        enabled: manifestBloom.bloomBytes > 0,
        bloomBytes: manifestBloom.bloomBytes,
        bitsPerKey: manifestBloom.bloomBitsPerKey,
        hashCount: manifestBloom.bloomHashCount,
        estimatedFalsePositiveRate: manifestBloom.estimatedFalsePositiveRate,
        measuredFalsePositiveRate: manifestBloom.bloomBytes ? Number((falsePositives / tested).toFixed(6)) : null,
        rejectsInHardEval: bloomRejects,
        avgProbeMs: probeMs,
        storesTextOrMoney: false,
      };
    })(),
    metrics: {
      total: metrics.total,
      avgMs: metrics.avgMs,
      p50Ms: metrics.p50Ms,
      p95Ms: metrics.p95Ms,
      layers: metrics.counters,
      peakRamBytes: metrics.peakRamBytes,
      batteryEstimateMah: metrics.batteryEstimateMah,
      packBytes: metrics.packBytes,
      modelCalls: metrics.modelCalls,
      bloomRejects: metrics.bloomRejects,
    },
    targets: {
      intentAccuracyTarget: 98,
      met: score(hard, full).intentAccuracy >= 98,
      rulesHitRate: Number(((rulesHits / hard.length) * 100).toFixed(2)),
    },
    honestNotes: [
      "هارد‌ایوال کاملاً ترکیبی و خارج از بسته/کش/آموزش است؛ دقت روی داده واقعی کاربران ممکن است متفاوت باشد.",
      "هیچ عددی برای مدل روی دستگاه گزارش نشده چون مدل همراه APK نیست.",
      "زمان‌ها روی Node اندازه‌گیری شده‌اند، نه روی گوشی ۶ گیگ؛ برای گوشی باید همان بنچمارک تکرار شود.",
    ],
  };
  writeFileSync(join(ROOT, "eval_report.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(JSON.stringify({ fastLayer: report.fastLayer, byScenario, targets: report.targets, metrics: report.metrics }, null, 2));
}

main();

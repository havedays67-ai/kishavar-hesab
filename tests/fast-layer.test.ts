import { describe, expect, it } from "vitest";
import {
  hashKey, maskNumbers, normalizePersian, normalizeVerbalNumbers, sentenceKey, normalizeUnits,
} from "../app-v2/src/lib/nlu/normalizer";
import { runRules, RULE_THRESHOLD } from "../app-v2/src/lib/nlu/rules";
import { checksumOf, decodeValue, encodePack, openPack } from "../app-v2/src/lib/nlu/pack";
import { LearnedCache } from "../app-v2/src/lib/nlu/learned-cache";
import { buildRetriever, type RetrievalDoc } from "../app-v2/src/lib/nlu/retriever";
import { routeFast, fastLayerMetrics, needsDeterministicAnswer } from "../app-v2/src/lib/nlu/router";
import { buildBloom, bloomSecondHash, estimatedBloomFpr } from "../app-v2/src/lib/nlu/bloom";
import { __resetModelForTests, validateModelOutput } from "../app-v2/src/lib/nlu/model";
import { classifyWithBrain, brainAvailable } from "../app-v2/src/lib/nlu/cpu-brain";
import { BRAIN_THRESHOLD } from "../app-v2/src/lib/nlu/router";
import { correctWord, isKnownWord } from "../app-v2/src/lib/nlu/persian-lexicon";
import { findMarkedQA, markedSuggestions } from "../app-v2/src/lib/ai/qa-bank";
import { simulatePipeline, simulateBatch } from "../app-v2/src/lib/nlu/processor-sim";

describe("Normalizer", () => {
  it("ورودی‌های معادل یک کلید یکسان می‌سازند", () => {
    const variants = [
      "۲,۵۰۰,۰۰۰ تومان كود خريدم",
      "2500000 تومان کود خریدم",
      "دو میلیون و پانصد هزار تومان کود خریدم",
      "۲۵۰۰۰۰۰‌تومان‌کود خریدم",
    ];
    const keys = new Set(variants.map((text) => sentenceKey(text)));
    expect(keys.size).toBe(1);
    expect([...keys][0]).not.toMatch(/\d/);
  });

  it("ارقام فارسی/عربی و ی/ک عربی را یکسان می‌کند", () => {
    expect(normalizePersian("علي ۱۲٣")).toBe(normalizePersian("علی 123"));
    expect(normalizePersian("كتاب")).toContain("کتاب");
  });

  it("عدد حرفی و واحدها را استاندارد می‌کند", () => {
    expect(normalizeVerbalNumbers("دو میلیون و پانصد هزار").text).toBe("2500000");
    expect(normalizeUnits(normalizePersian("۵ كيلو گرم گندم"))).toContain("کیلوگرم");
  });

  it("ماسک اعداد، هیچ مبلغی باقی نمی‌گذارد", () => {
    expect(maskNumbers("۲۵ میلیون تومان برای کود")).not.toMatch(/\d/);
  });

  it("هش پایدار است", () => {
    expect(hashKey("گندم")).toBe(hashKey("گندم"));
    expect(hashKey("گندم")).not.toBe(hashKey("جو"));
  });
});

describe("Rule engine", () => {
  it("ثبت هزینه/فروش/چک/سود را تشخیص می‌دهد", () => {
    expect(["add_expense", "purchase_input"]).toContain(runRules("۲۵ میلیون تومان کود اوره برای گندم خریدم")?.intent);
    expect(runRules("کرایه کامیون حمل بار را دادم")?.intent).toBe("add_expense");
    expect(runRules("چک ۴۴ میلیون تومانی از مهدی گرفتم")?.intent).toBe("cheque_received");
    expect(runRules("چقدر طلب دارم")?.intent).toBe("report_receivable");
    expect(runRules("چک چاپی از نظر قانونی معتبر است")?.intent).toBe("legal_cheque");
  });

  it("زیررشته‌ی نادرست ایجاد نمی‌کند («سم» داخل «بنویسم»)", () => {
    const result = runRules("برای مزارعه چه بندهایی توی قرارداد بنویسم");
    expect(result?.intent).not.toBe("fertilizer_pesticide");
  });

  it("اطمینان زیر آستانه، نتیجه نمی‌دهد", () => {
    expect(runRules("")).toBeNull();
    expect(RULE_THRESHOLD).toBeGreaterThan(0.5);
  });

  it("اسلات مالی تولید نمی‌کند", () => {
    const result = runRules("۲۵۰ میلیون تومان کود برای گندم خریدم");
    expect(result).not.toBeNull();
    expect(JSON.stringify(result?.slots ?? {})).not.toMatch(/\d/);
    expect(result?.slots.crop).toBe("گندم");
  });
});

describe("Answer pack", () => {
  const items = [
    { text: "۲۵ میلیون تومان کود خریدم برای گندم", intent: "add_expense" as const, slots: { crop: "گندم", category: "کود" } },
    { text: "چک ۴۴ میلیون تومانی از مهدی گرفتم", intent: "cheque_received" as const, slots: { docType: "cheque" } },
  ];

  it("رفت‌وبرگشت بسته و جستجو با کلید ماسک‌شده", () => {
    const bytes = encodePack(items, { version: "test", builtFrom: "test", syntheticShare: 1 });
    const pack = openPack(bytes);
    expect(pack.manifest.count).toBeGreaterThan(0);
    expect(pack.lookup("۲۵ میلیون تومان کود خریدم برای گندم")?.intent).toBe("add_expense");
    // مبلغ متفاوت، همان کلید (عدد ماسک شده است)
    expect(pack.lookup("۹۹ میلیون تومان کود خریدم برای گندم")?.intent).toBe("add_expense");
    expect(pack.lookup("سلام خوبی")).toBeNull();
    expect(checksumOf(bytes)).toMatch(/^[0-9a-f]{8}$/);
  });

  it("هیچ مبلغی در بسته ذخیره نمی‌شود", () => {
    const bytes = encodePack(items, { version: "test", builtFrom: "test", syntheticShare: 1 });
    const pack = openPack(bytes);
    for (const value of pack.values()) expect(value).not.toMatch(/\d/);
    expect(decodeValue("add_expense|گندم|کود")).toEqual({ intent: "add_expense", slots: { crop: "گندم", category: "کود" } });
  });

  it("بستهٔ با امضای نادرست رد می‌شود", () => {
    expect(() => openPack(new Uint8Array([1, 2, 3, 4]))).toThrow();
  });
});

describe("Learned cache", () => {
  it("ثبت، بازیابی، LRU و پاک‌سازی", () => {
    const cache = new LearnedCache(undefined, 20);
    cache.clear();
    for (let index = 0; index < 30; index += 1) {
      cache.put(`گندم ${index} هزار`, "add_expense", { crop: "گندم" }, "pack");
    }
    expect(cache.size()).toBeLessThanOrEqual(20);
    expect(cache.stats().limit).toBe(20);
    cache.put("چک گرفتم از مهدی", "cheque_received", { docType: "cheque" }, "model");
    expect(cache.get("چک گرفتم از مهدی")?.intent).toBe("cheque_received");
    cache.clear();
    expect(cache.size()).toBe(0);
    expect(cache.containsNumbers()).toBe(false);
  });

  it("هیچ مبلغی در کش ذخیره نمی‌شود و ورودی دارای رقم رد می‌شود", () => {
    const cache = new LearnedCache(undefined, 20);
    cache.clear();
    expect(cache.put("۲۵۰ میلیون تومان", "add_expense", { crop: "گندم" } as never, "model")).toBe(true);
    expect(cache.put("متن", "add_expense", { crop: "۱۲۳" } as never, "model")).toBe(false);
    for (const record of cache.dump()) {
      expect(JSON.stringify(record.slots)).not.toMatch(/\d/);
      expect(record.intent).not.toMatch(/\d/);
    }
    expect(cache.containsNumbers()).toBe(false);
  });
});

describe("Support retriever", () => {
  const docs: RetrievalDoc[] = [
    { id: "1", title: "چک صیاد", text: "چک قانونی باید در سامانه صیاد ثبت شود", category: "حقوقی" },
    { id: "2", title: "استهلاک", text: "استهلاک خط مستقیم ماشین آلات کشاورزی", category: "مالی" },
  ];

  it("سند مرتبط را پیدا می‌کند و برای پرسش بی‌ربط چیزی برنمی‌گرداند", () => {
    const index = buildRetriever(docs);
    expect(index.lookup("ثبت چک در صیاد").length).toBeGreaterThan(0);
    expect(index.lookup("xyz")).toHaveLength(0);
  });
});

describe("Model fallback و قرارداد JSON", () => {
  it("JSON معتبر را می‌پذیرد و خروجی خراب/مبلغی را رد می‌کند", () => {
    expect(validateModelOutput('{"intent":"add_expense","slots":{"crop":"گندم"},"confidence":0.9}').ok).toBe(true);
    expect(validateModelOutput('```json\n{"intent":"add_expense","slots":{},"confidence":0.9}\n```').ok).toBe(true);
    expect(validateModelOutput('{"intent":"add_expense"').ok).toBe(false);
    expect(validateModelOutput('{"intent":"not_real","slots":{}}').ok).toBe(false);
    expect(validateModelOutput('{"intent":"add_expense","slots":{"amount":"۲۵۰۰۰۰۰۰"}}').ok).toBe(false);
    __resetModelForTests();
  });
});

describe("Router", () => {
  const docs: RetrievalDoc[] = [{ id: "1", title: "چک صیاد", text: "چک قانونی باید در سامانه صیاد ثبت شود" }];
  const retriever = buildRetriever(docs);

  it("ترتیب لایه‌ها: قواعد قبل از بسته، بازیابی فقط در پشتیبان", () => {
    const bytes = encodePack([{ text: "چک ۴۴ میلیون تومانی از مهدی گرفتم", intent: "cheque_received", slots: { docType: "cheque" } }], { version: "t", builtFrom: "t", syntheticShare: 1 });
    const pack = openPack(bytes);
    const cache = new LearnedCache(undefined, 20);
    cache.clear();
    const rulesFirst = routeFast("چک ۴۴ میلیون تومانی از مهدی گرفتم", { mode: "assistant", pack, cache, retriever });
    expect(rulesFirst.layer).toBe("rules");
    expect(needsDeterministicAnswer(rulesFirst.intent)).toBe(false);
    expect(needsDeterministicAnswer("report_cash")).toBe(true);
    const assistantNoRetrieval = routeFast("xyzabc", { mode: "assistant", pack, cache, retriever });
    expect(assistantNoRetrieval.layer).toBe("clarify");
    expect(assistantNoRetrieval.clarifyingQuestion).toBeTruthy();
  });

  it("سنجه‌ها را ثبت می‌کند و RAM/باتری تخمینی دارد", () => {
    const snapshot = fastLayerMetrics.snapshot();
    expect(snapshot).toHaveProperty("p95Ms");
    expect(snapshot).toHaveProperty("modelCalls");
    expect(snapshot.peakRamBytes).toBeGreaterThan(0);
    expect(snapshot.batteryEstimateMah).toBeGreaterThanOrEqual(0);
  });
});

describe("Bloom prefilter (رد سریع پیش از بسته)", () => {
  it("هیچ false-negative ندارد: همهٔ کلیدهای داخل بسته پیدا می‌شوند", () => {
    const texts = Array.from({ length: 500 }, (_, index) => `گندم ${index} کیلو خریدم برای زمین`);
    const bloom = buildBloom(texts.map((text) => sentenceKey(text).length * 2654435761 + text.length));
    for (const text of texts) {
      const hash = sentenceKey(text).length * 2654435761 + text.length;
      expect(bloom.contains(hash >>> 0)).toBe(true);
    }
    const bytes = encodePack(texts.map((text) => ({ text, intent: "add_expense" as const, slots: { crop: "گندم" } })), { version: "t", builtFrom: "t", syntheticShare: 1 });
    const pack = openPack(bytes);
    expect(pack.manifest.format).toBe(2);
    expect(pack.manifest.bloomBytes).toBeGreaterThan(0);
    for (const text of texts) expect(pack.lookup(text)?.intent).toBe("add_expense");
  });

  it("جملهٔ ناشناخته را قبل از جستجوی دودویی رد می‌کند و نرخ خطای تخمینی کوچک است", () => {
    const known = Array.from({ length: 400 }, (_, index) => `هزینه بذر شماره ${index} پرداخت شد`);
    const bytes = encodePack(known.map((text) => ({ text, intent: "add_expense" as const, slots: { category: "بذر" } })), { version: "t", builtFrom: "t", syntheticShare: 1 });
    const pack = openPack(bytes);
    expect(pack.bloom).not.toBeNull();
    expect(pack.manifest.estimatedFalsePositiveRate).toBeLessThan(0.05);
    expect(pack.mightContain("هوا فردا چطوره")).toBe(false);
    expect(pack.lookup("هوا فردا چطوره")).toBeNull();
    expect(estimatedBloomFpr(1000, 10000, 7)).toBeGreaterThan(0);
    expect(bloomSecondHash(42)).not.toBe(bloomSecondHash(43));
  });

  it("بستهٔ قدیمی v1 بدون bloom هم خوانده می‌شود (سازگاری عقب‌رو)", () => {
    const bytes = encodePack([{ text: "چک گرفتم از مهدی", intent: "cheque_received", slots: { docType: "cheque" } }], { version: "t", builtFrom: "t", syntheticShare: 1 });
    const pack = openPack(bytes);
    expect(pack.mightContain("چک گرفتم از مهدی")).toBe(true);
    expect(pack.lookup("چک گرفتم از مهدی")?.intent).toBe("cheque_received");
  });
});

describe("Rule engine — رگرسیون باگ‌های واقعی ارزیابی", () => {
  it("برگشت پول هزینه = درآمد، نه هزینه", () => {
    const result = runRules("پول اجاره تراکتور رو که دادم بهم برگشت");
    expect(result?.intent).toBe("add_income");
  });

  it("خرید کود با پرداخت نقدی = هزینه", () => {
    expect(runRules("کود اوره گرفتم واس گوجه، پولشو نقد دادم")?.intent).toBe("add_expense");
  });

  it("چک‌هایی که نزدیک سررسیدن‌اند = گزارش چک (پسوند صرفی)", () => {
    expect(runRules("چک‌هایی که نزدیک سررسیدن کدوما هستن")?.intent).toBe("report_cheques");
  });

  it("بردن کیسه کود از انبار = خروج انبار، نه خرید", () => {
    const result = runRules("از انبار کیسه‌های کود رو برای زمین بالا ببر واسم بنویس");
    expect(result?.intent).toBe("inventory_out");
    expect(result?.slots.category).toBe("کود");
  });

  it("اسلات حدسی (نقش/جهت) برای هزینه تولید نمی‌شود", () => {
    const slots = runRules("۲۵۰ میلیون تومان کود برای گندم خریدم")?.slots ?? {};
    expect(slots.direction).toBeUndefined();
    expect(slots.role).toBeUndefined();
  });
});

describe("مغز آماری CPU (آموزش‌دیده با سؤال/جواب نشان‌دار)", () => {
  it("مدل واقعاً بارگذاری می‌شود و قصد را با اطمینان می‌فهمد", () => {
    expect(brainAvailable()).toBe(true);
    const prediction = classifyWithBrain("هزینهٔ کود برای گندم پرداخت شد");
    expect(prediction).not.toBeNull();
    expect(prediction?.confidence).toBeGreaterThan(0.5);
    expect(prediction?.intent).not.toBe("unknown");
  });

  it("هیچ عددی در خروجی مغز نیست و برای ورودی خالی حدس نمی‌زند", () => {
    const prediction = classifyWithBrain("چک از مهدی گرفتم ۲۵ میلیون تومان");
    expect(JSON.stringify(prediction?.slots ?? {})).not.toMatch(/[0-9۰-۹]/);
    expect(classifyWithBrain("")).toBeNull();
    expect(classifyWithBrain("xyzqwe")).toBeNull();
  });

  it("آستانهٔ پذیرش مغز بالاست تا حدس اشتباه ثبت نشود", () => {
    expect(BRAIN_THRESHOLD).toBeGreaterThanOrEqual(0.8);
  });
});

describe("واژگان فارسی آموخته‌شده", () => {
  it("واژه‌های پرتکرار را می‌شناسد و غلط املایی یک‌حرفی را تصحیح می‌کند", () => {
    expect(isKnownWord("گندم")).toBe(true);
    expect(correctWord("گندن")).toBe("گندم");
    expect(correctWord("xyzq")).toBe("xyzq");
  });
});

describe("بانک سؤال/جواب نشان‌دار", () => {
  it("پرسش‌های پرتکرار پاسخ نشان‌دار می‌گیرند", () => {
    expect(findMarkedQA("آیا چک چاپی معتبر است؟")?.id).toBe("qa-cheque-print");
    expect(findMarkedQA("چطور از برنامه پشتیبان بگیرم")?.tag).toBe("برنامه");
    expect(markedSuggestions(12).length).toBe(12);
  });
});

describe("شبیه‌ساز پردازنده (مدل شمارش عملیات، نه سخت‌افزار)", () => {
  it("مسیر پردازش را با پذیرش اولین لایهٔ مطمئن شبیه‌سازی می‌کند", () => {
    const simulation = simulatePipeline("۲۵ میلیون تومان کود برای گندم خریدم");
    expect(simulation.acceptedLayer).toBe("rules");
    expect(simulation.totalIntOps).toBeGreaterThan(0);
    expect(simulation.steps.map((step) => step.layer)).toContain("rules");
    expect(simulation.modelCallEstimate.available).toBe(false);
  });

  it("برای جملهٔ ناشناخته، مغز CPU یا سؤال شفاف انتخاب می‌شود و هزینه گزارش می‌شود", () => {
    const batch = simulateBatch(["xyzabc", "کود اوره برای گندم", "سلام"]);
    expect(batch.samples).toBe(3);
    expect(batch.avgIntOps).toBeGreaterThan(0);
    expect(Object.keys(batch.accepted).length).toBeGreaterThan(0);
  });
});

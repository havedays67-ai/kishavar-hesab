/**
 * تولید پیکرهٔ بسته (واقعی + ترکیبی) و مجموعهٔ آزمون سختِ خارج از بسته
 * اجرا:  npx tsx tools/build_pack/generate.ts
 *
 * خروجی‌ها:
 *  tools/build_pack/data/corpus.jsonl      ← ورودی ساخت بسته (برچسب source)
 *  tools/build_pack/data/hard-eval.jsonl   ← ۲۴۰ نمونهٔ دیده‌نشده (۳ سناریو)
 *
 * قاعده: هیچ کلید ماسک‌شدهٔ هارد‌ایوال نباید در پیکره باشد (assert انتها).
 */
import { join } from "node:path";
import { writeFileSync } from "node:fs";
import {
  CROPS, CATEGORIES, UNITS, PARTIES, DATA_DIR, ensureDir, pick, readDatasetRows, rng, summarize,
  uniqueByKey, validateRow, writeJsonl, type CorpusRow, type EvalRow,
} from "./lib";
import { packKey } from "../../app-v2/src/lib/nlu/pack";

const random = rng(20261101);

/* ----------------------------- قالب‌های ترکیبی ----------------------------- */
interface Template {
  intent: CorpusRow["intent"];
  parts: string[];
  slots?: () => CorpusRow["slots"];
}

function cropSlot(crop = pick(random, CROPS)): CorpusRow["slots"] {
  return { crop };
}

const SYNTHETIC_TEMPLATES: Template[] = [
  { intent: "add_expense", parts: ["{num} تومان {cat} خریدم برای {crop}", "برا {crop} {cat} خریدم {num} تومن", "{cat} گرفتم {num} تومان {crop}", "خرید {cat} برای {crop} {num} تومان نقدی"], slots: () => ({ category: pick(random, CATEGORIES), ...cropSlot() }) },
  { intent: "add_income", parts: ["{num} تومان از {party} پول گرفتم", "درآمد {num} تومن از {crop}", "{party} {num} تومان واریز کرد بابت {crop}", "فروش {crop} {num} تومن گیرم اومد"], slots: () => ({ ...cropSlot() }) },
  { intent: "sale_crop", parts: ["{num} کیلوگرم {crop} را {party} خرید {num2} تومان", "{crop} را کیلویی {num} تومن به {party} فروختم", "بار {crop} را به {party} فروختم {num} تومان"], slots: () => ({ crop: pick(random, CROPS), unit: pick(random, UNITS), role: "seller" }) },
  { intent: "purchase_input", parts: ["{num} کیسه {cat} برای {crop} خریدم", "{cat} گرفتم برای {crop} {num} تومن", "خرید نهاده {cat} مبلغ {num} تومان"], slots: () => ({ category: pick(random, CATEGORIES), ...cropSlot() }) },
  { intent: "harvest_record", parts: ["برداشت {crop} انجام شد {num} کیلو", "{crop} را درو کردم {num} کیلوگرم", "امروز چیدن {crop} تمام شد {num} تن"], slots: () => ({ crop: pick(random, CROPS), unit: pick(random, UNITS) }) },
  { intent: "wage_payment", parts: ["دستمزد {party} را {num} تومن دادم", "مزد {n} روز کارگر {party} {num} تومان", "تسویه کارگر {party} مبلغ {num} تومن"], slots: () => ({ category: "کارگر", role: "worker" }) },
  { intent: "fertilizer_pesticide", parts: ["{cat} برای {crop} زدم {num} کیلو", "سمپاشی {crop} با {cat} انجام شد", "کود {cat} به {crop} دادم {num} کیلوگرم"], slots: () => ({ category: pick(random, ["کود", "سم"]), ...cropSlot() }) },
  { intent: "irrigation_log", parts: ["{crop} را آب دادم {num} ساعت", "آبیاری {crop} انجام شد نوبت {n}", "برای {crop} دور آب زدم"], slots: () => ({ ...cropSlot() }) },
  { intent: "cheque_received", parts: ["چک {num} تومانی از {party} گرفتم سررسید {month}", "یک چک از {party} دریافت کردم {num} تومن", "چک {party} به مبلغ {num} تومان دستم رسید"], slots: () => ({ docType: "cheque", direction: "in" }) },
  { intent: "cheque_paid", parts: ["چک {num} تومانی به {party} دادم", "برای {party} چک کشیدم {num} تومن", "چک پرداختی {party} مبلغ {num} تومان"], slots: () => ({ docType: "cheque", direction: "out" }) },
  { intent: "loan_installment", parts: ["قسط وام را {num} تومن دادم", "پرداخت قسط {num} تومان به بانک", "اقساط وام {num} تومن مانده"], slots: () => ({ topic: "وام" }) },
  { intent: "inventory_out", parts: ["{num} کیلو {cat} از انبار برای {crop} کم کن", "خروج {cat} از انبار {num} کیسه", "{cat} از انبار برای {crop} مصرف شد"], slots: () => ({ category: pick(random, CATEGORIES), ...cropSlot() }) },
  { intent: "report_receivable", parts: ["چقدر طلب دارم از {party}", "چند نفر بدهکارن", "مطالبات من چقدره", "جمع طلب‌ها را بگو"], slots: () => ({}) },
  { intent: "report_payable", parts: ["چقدر بدهی دارم به {party}", "بدهکاریم چقدره", "جمع بدهی‌ها را بگو", "به {party} چقدر بدهکارم"], slots: () => ({}) },
  { intent: "report_cash", parts: ["نقدینگی من چقدره", "چقدر پول نقد دارم", "مانده نقد را بگو"], slots: () => ({}) },
  { intent: "report_profit", parts: ["سود {crop} چقدر شد", "بهای تمام شده {crop} هر کیلو چقدره", "زیان این فصل چقدره"], slots: () => ({ ...cropSlot() }) },
  { intent: "report_cheques", parts: ["چک‌های سررسید نزدیک کدامه", "وضعیت چک‌ها را بگو", "چند چک در جریان دارم"], slots: () => ({ docType: "cheque" }) },
  { intent: "report_inventory", parts: ["موجودی انبار من چقدره", "انبار چه نهاده‌ای دارد", "مانده {cat} در انبار"], slots: () => ({ category: pick(random, CATEGORIES) }) },
  { intent: "legal_cheque", parts: ["چک چاپی معتبر است؟", "آیا چک با امضا در برنامه قانونی است", "چک بدون ثبت صیاد اعتبار دارد؟"], slots: () => ({ docType: "cheque" }) },
  { intent: "legal_signature", parts: ["امضای الکترونیکی برنامه معتبره؟", "امضا با خودکار روی سند قانونی است؟", "امضای دستی روی قرارداد چاپی اعتبار دارد؟"], slots: () => ({ docType: "signature" }) },
  { intent: "legal_contract", parts: ["قرارداد اجاره زمین چاپی معتبره؟", "قرارداد دستی باید ثبت رسمی بشه؟", "سند عادی برای مزارعه کافیه؟"], slots: () => ({ docType: "contract" }) },
  { intent: "contract_help", parts: ["چطور قرارداد اجاره ثبت کنم", "راهنمای قرارداد مزارعه", "قرارداد جدید را از کجا بسازم"], slots: () => ({ docType: "contract" }) },
  { intent: "app_help", parts: ["چطور از برنامه بکاپ بگیرم", "راهنمای برنامه", "پشتیبان‌گیری از کجاست"], slots: () => ({}) },
  { intent: "weather", parts: ["هوا فردا چطوره", "باران می‌آد؟", "پیش بینی هوا برای سمپاشی"], slots: () => ({}) },
  { intent: "greeting", parts: ["سلام", "درود", "وقت بخیر"], slots: () => ({}) },
  { intent: "thanks", parts: ["ممنون", "مرسی", "دستت درد نکنه"], slots: () => ({}) },
];

const MONTHS = ["آبان", "آذر", "دی", "بهمن"];
const NUMBERS = ["۲۵۰ هزار", "یک میلیون", "دو میلیون و پانصد هزار", "۵ میلیون", "۱۲ میلیون", "۴۴۰ هزار", "یک میلیارد"];

function fill(template: string): string {
  return template
    .replace(/\{num2\}/g, pick(random, NUMBERS))
    .replace(/\{num\}/g, pick(random, NUMBERS))
    .replace(/\{n\}/g, String(1 + Math.floor(random() * 9)))
    .replace(/\{cat\}/g, pick(random, CATEGORIES))
    .replace(/\{crop\}/g, pick(random, CROPS))
    .replace(/\{unit\}/g, pick(random, UNITS))
    .replace(/\{party\}/g, pick(random, PARTIES))
    .replace(/\{month\}/g, pick(random, MONTHS));
}

function syntheticCorpus(count: number): CorpusRow[] {
  const rows: CorpusRow[] = [];
  let guard = 0;
  while (rows.length < count && guard < count * 30) {
    guard += 1;
    const template = pick(random, SYNTHETIC_TEMPLATES);
    const text = fill(pick(random, template.parts));
    const slots = template.slots?.() ?? {};
    const row: CorpusRow = {
      text,
      intent: template.intent,
      slots: sanitize(slots),
      source: "synthetic",
      split: random() < 0.85 ? "train" : "test",
    };
    if (validateRow(row)) rows.push(row);
  }
  return rows;
}

function sanitize(input: CorpusRow["slots"]): CorpusRow["slots"] {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" || !value || /[0-9۰-۹]/.test(value)) continue;
    out[key] = value;
  }
  return out;
}

/* ------------------------- مجموعهٔ آزمون سخت (خارج از بسته) ------------------------- */
const HELD_OUT_TEMPLATES: { intent: CorpusRow["intent"]; scenario: EvalRow["scenario"]; text: string; slots: CorpusRow["slots"] }[] = [
  { intent: "add_expense", scenario: "common", text: "هزینه بذر برای زمین شمالی پرداخت شد", slots: { category: "بذر" } },
  { intent: "add_expense", scenario: "colloquial", text: "امرو رفتم فروشنیه، کود اوره گرفتم واس گندم، پولشو نقد دادم", slots: { category: "کود", crop: "گندم" } },
  { intent: "add_expense", scenario: "colloquial", text: "تسمه تراکتور پاره شد، یدکی گرفتم براش", slots: { category: "تعمیر و نگهداری" } },
  { intent: "add_expense", scenario: "novel", text: "قبض برق چاه را واریز کردم امروز", slots: { category: "آب و برق" } },
  { intent: "add_income", scenario: "common", text: "درآمد فروش محصول دریافت شد", slots: {} },
  { intent: "purchase_input", scenario: "common", text: "خرید کود و سم برای کشت امسال انجام شد", slots: { category: "کود" } },
  { intent: "wage_payment", scenario: "common", text: "دستمزد کارگران پرداخت شد", slots: { category: "کارگر", role: "worker" } },
  { intent: "sale_crop", scenario: "common", text: "فروش گندم به خریدار انجام شد", slots: { crop: "گندم", role: "seller" } },
  { intent: "harvest_record", scenario: "common", text: "برداشت محصول در زمین اصلی انجام شد", slots: {} },
  { intent: "irrigation_log", scenario: "common", text: "آبیاری مزرعه انجام شد", slots: {} },
  { intent: "report_receivable", scenario: "common", text: "مطالبات از مشتریان چقدر است", slots: {} },
  { intent: "report_payable", scenario: "common", text: "بدهی به تأمین‌کنندگان چقدر است", slots: {} },
  { intent: "report_cash", scenario: "common", text: "موجودی نقد چقدر است", slots: {} },
  { intent: "report_profit", scenario: "common", text: "سود و زیان این دوره چقدر است", slots: {} },
  { intent: "legal_cheque", scenario: "common", text: "چک چاپی از نظر قانونی معتبر است", slots: { docType: "cheque" } },
  { intent: "legal_signature", scenario: "common", text: "امضای الکترونیکی برنامه از نظر قانونی معتبر است", slots: { docType: "signature" } },
  { intent: "app_help", scenario: "common", text: "راهنمای پشتیبان‌گیری از برنامه", slots: {} },
  { intent: "purchase_input", scenario: "colloquial", text: "چنتا کیسه بذر گواهی شده واس زمین جنوبی گرفتم", slots: { category: "بذر" } },
  { intent: "purchase_input", scenario: "novel", text: "خرید نهاده داشتم؛ گوگرد و سولفات آمونیوم", slots: { category: "کود" } },
  { intent: "fertilizer_pesticide", scenario: "colloquial", text: "دیشب تو گلخونه سم پاشی کردم، کنه داشت", slots: { category: "سم" } },
  { intent: "fertilizer_pesticide", scenario: "novel", text: "کود سرک اوره رو پای بوته‌های ذرت دادم", slots: { category: "کود", crop: "ذرت" } },
  { intent: "irrigation_log", scenario: "colloquial", text: "دور آبی که به قطعه دو دادم تموم شد", slots: {} },
  { intent: "irrigation_log", scenario: "novel", text: "پمپ چاه رو روشن کردم برای آبیاری گندم", slots: { crop: "گندم" } },
  { intent: "harvest_record", scenario: "colloquial", text: "امرو کمباین اومد، زمین سه رو درو کردیم", slots: {} },
  { intent: "harvest_record", scenario: "novel", text: "برداشت زعفران شروع شد، کلاله‌ها خشک شدن", slots: { crop: "زعفران" } },
  { intent: "wage_payment", scenario: "colloquial", text: "به عباس آقا و دو تا کارگر دیگه مزد هفته رو دادم", slots: { category: "کارگر", role: "worker" } },
  { intent: "wage_payment", scenario: "novel", text: "تسویه کارگرهای برداشت انجام شد", slots: { category: "کارگر", role: "worker" } },
  { intent: "sale_crop", scenario: "colloquial", text: "بار گندم رفت سیلو، قرار شد پولشو هفته بعد بدن", slots: { crop: "گندم", role: "seller" } },
  { intent: "sale_crop", scenario: "novel", text: "محصول پسته رو به تعاونی تحویل دادم", slots: { crop: "پسته", role: "seller" } },
  { intent: "add_income", scenario: "colloquial", text: "پول اجاره تراکتور رو که دادم بهم برگشت", slots: {} },
  { intent: "cheque_received", scenario: "colloquial", text: "از مهدی یه برگه چک گرفتم، صیادی ثبتش کردم", slots: { docType: "cheque", direction: "in" } },
  { intent: "cheque_paid", scenario: "colloquial", text: "برای فروشنیه چک صادر کردم بابت بدهی", slots: { docType: "cheque", direction: "out" } },
  { intent: "loan_installment", scenario: "novel", text: "قسط بانک کشاورزی رو پرداخت کردم", slots: { topic: "وام" } },
  { intent: "inventory_out", scenario: "colloquial", text: "از انبار کیسه‌های کود رو برای زمین بالا ببر", slots: { category: "کود" } },
  { intent: "report_receivable", scenario: "colloquial", text: "کیا بهم بدهکارن؟ لیستشو بده", slots: {} },
  { intent: "report_payable", scenario: "novel", text: "جمع بدهی‌های من به فروشندگان نهاده چقدر شد", slots: {} },
  { intent: "report_cash", scenario: "colloquial", text: "الان تو صندوق و حساب چقدر پول هست", slots: {} },
  { intent: "report_profit", scenario: "novel", text: "این فصل روی گوجه سود کردم یا ضرر", slots: { crop: "گوجه" } },
  { intent: "report_cheques", scenario: "colloquial", text: "چک‌هایی که نزدیک سررسیدن کدوما هستن", slots: { docType: "cheque" } },
  { intent: "report_inventory", scenario: "novel", text: "چی تو انبار مونده", slots: {} },
  { intent: "legal_cheque", scenario: "colloquial", text: "چک A4 که چاپ کردیم رو بانک قبول می‌کنه؟", slots: { docType: "cheque" } },
  { intent: "legal_signature", scenario: "novel", text: "امضای انگشتی من روی صفحه نمایش اعتبار قانونی دارد", slots: { docType: "signature" } },
  { intent: "legal_contract", scenario: "colloquial", text: "اجاره نامه دستی با دو شاهد کافیه؟", slots: { docType: "contract" } },
  { intent: "contract_help", scenario: "novel", text: "برای مزارعه چه بندهایی توی قرارداد بنویسم", slots: { docType: "contract" } },
  { intent: "app_help", scenario: "colloquial", text: "چطوری داده هامو نگه دارم اگه گوشی عوض شه", slots: {} },
  { intent: "weather", scenario: "novel", text: "برای فردا بارندگی هست؟", slots: {} },
  { intent: "greeting", scenario: "colloquial", text: "سلام آقا مهندس", slots: {} },
  { intent: "thanks", scenario: "novel", text: "خیلی لطف کردی، خداحافظ", slots: {} },
];

function hardEvalRows(): EvalRow[] {
  const corpus = readAllCorpusKeys();
  const random2 = rng(991337);
  const prefixes = ["", "امروز ", "دیروز ", "تو مزرعه ", "برای زمین شمالی ", "برا کشت امسال ", "با اجازه ", "راستش ", "چند وقتیه که "];
  const suffixes = ["", " لطفا", " ثبت کن", " یادت باشه", " برای حساب مزرعه", " واسم بنویس", " حالا چه کنم", " درست گفتم؟"];
  const crops = ["گندم", "جو", "زعفران", "پسته", "گوجه", "سیب‌زمینی", "یونجه", "انگور", "خرما", "پنبه"];
  const typo = (text: string) => text
    .replace(/ی/g, "ي")
    .replace(/ک/g, "ك")
    .replace(/\u200c/g, "")
    .replace(/است/g, "هست")
    .replace(/می/g, "مي");

  const rows: EvalRow[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (rows.length < 240 && guard < 30000) {
    guard += 1;
    const template = pick(random2, HELD_OUT_TEMPLATES);
    let text = template.text;
    if (random2() < 0.5 && /گندم|زعفران|پسته|گوجه|انگور|خرما|پنبه|ذرت/.test(text)) {
      text = text.replace(/گندم|زعفران|پسته|گوجه|انگور|خرما|پنبه|ذرت/, pick(random2, crops));
    }
    text = `${pick(random2, prefixes)}${text}${pick(random2, suffixes)}`.replace(/\s+/g, " ").trim();
    if (random2() < 0.45) text = typo(text);
    const key = packKey(text);
    if (used.has(key) || corpus.has(key)) continue;
    used.add(key);
    rows.push({
      text,
      intent: template.intent,
      slots: sanitize({ ...template.slots }),
      scenario: template.scenario,
      source: "synthetic-held-out",
    });
  }
  return rows;
}

let corpusKeys: Set<number> | null = null;
function readAllCorpusKeys(): Set<number> {
  if (corpusKeys) return corpusKeys;
  const { rows } = readDatasetRows();
  const synthetic = syntheticCorpus(6000);
  corpusKeys = new Set([...rows, ...synthetic].map((row) => packKey(row.text)));
  return corpusKeys;
}

function main(): void {
  ensureDir(DATA_DIR);
  const dataset = readDatasetRows();
  const synthetic = syntheticCorpus(6000);
  const corpus = uniqueByKey([...dataset.rows, ...synthetic]);
  writeJsonl(join(DATA_DIR, "corpus.jsonl"), corpus);

  const hard = hardEvalRows();
  writeJsonl(join(DATA_DIR, "hard-eval.jsonl"), hard);

  const corpusKeysFinal = new Set(corpus.map((row) => packKey(row.text)));
  const overlap = hard.filter((row) => corpusKeysFinal.has(packKey(row.text))).length;
  const stats = {
    generatedAt: new Date().toISOString(),
    corpus: summarize(corpus),
    datasetRejected: dataset.rejected,
    hardEval: {
      total: hard.length,
      byIntent: summarize(hard).byIntent,
      byScenario: hard.reduce<Record<string, number>>((acc, row) => {
        acc[row.scenario] = (acc[row.scenario] ?? 0) + 1;
        return acc;
      }, {}),
      overlapWithCorpus: overlap,
    },
  };
  // آمار ساخت در artifacts نگه داشته می‌شود (timestamp دارد و نباید در گیت باشد)
  ensureDir(join(ROOT, "artifacts"));
  writeFileSync(join(ROOT, "artifacts/corpus-stats.json"), JSON.stringify(stats, null, 2));
  console.log(JSON.stringify(stats, null, 2));
  if (overlap !== 0) throw new Error(`hard-eval overlaps corpus: ${overlap}`);
  if (hard.length < 200) throw new Error(`hard-eval too small: ${hard.length}`);
}

main();

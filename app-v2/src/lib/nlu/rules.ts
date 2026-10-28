/**
 * موتور قواعد قطعی (Rule Engine) — سریع‌ترین سطح فهم
 * ------------------------------------------------------------
 * خروجی: intent + slots + confidence. هیچ عدد مالی محاسبه یا ذخیره
 * نمی‌شود؛ slots فقط برچسب‌های متنی‌اند (محصول، دسته، واحد، نوع سند).
 * اگر بهترین قاعده به آستانهٔ اطمینان نرسد، null برمی‌گردد تا سطح
 * بعدی (بستهٔ پاسخ / کش / بازیابی / مدل) اجرا شود.
 *
 * آماری که این فایل با آن کالیبره شده (tools/build_pack/eval.ts):
 * نرخ پوشش قواعد و دقت intent روی ۲۴۰ نمونهٔ دیده‌نشده در
 * `eval_report.json` ثبت می‌شود؛ هیچ درصدی در کامنت ادعا نمی‌شود.
 */
import { hashKey, normalizePersian, normalizeUnits, sentenceKey } from "./normalizer";

export type NluIntent =
  | "add_expense"
  | "add_income"
  | "sale_crop"
  | "purchase_input"
  | "harvest_record"
  | "wage_payment"
  | "fertilizer_pesticide"
  | "irrigation_log"
  | "cheque_received"
  | "cheque_paid"
  | "loan_installment"
  | "inventory_out"
  | "report_receivable"
  | "report_payable"
  | "report_cash"
  | "report_profit"
  | "report_cheques"
  | "report_inventory"
  | "legal_cheque"
  | "legal_signature"
  | "legal_contract"
  | "contract_help"
  | "app_help"
  | "weather"
  | "greeting"
  | "thanks"
  | "unknown";

export interface NluSlots {
  crop?: string;
  category?: string;
  unit?: string;
  docType?: string;
  topic?: string;
  direction?: "in" | "out";
  role?: "landlord" | "tenant" | "worker" | "buyer" | "seller";
}

export interface RuleResult {
  intent: NluIntent;
  confidence: number;
  slots: NluSlots;
  matched: string;
  /** جملهٔ کلیدی ماسک‌شده — بدون هیچ عددی */
  key: string;
}

export const RULE_THRESHOLD = 0.62;

export const CROPS = [
  "گندم", "جو", "برنج", "ذرت", "کلزا", "پنبه", "چغندرقند", "سیب‌زمینی", "پیاز", "سیر",
  "گوجه", "خیار", "فلفل", "بادمجان", "کدو", "هندوانه", "خربزه", "زعفران", "پسته", "بادام",
  "گردو", "انار", "انگور", "سیب", "زیتون", "خرما", "مرکبات", "پرتقال", "لیمو", "انجیر",
  "یونجه", "شبدر", "کاهو", "اسفناج", "هویج", "لوبیا", "نخود", "عدس", "آفتابگردان", "کنجد",
];

export const EXPENSE_CATEGORIES: { label: string; words: string[] }[] = [
  { label: "بذر", words: ["بذر", "بزر", "seed", "تخم"] },
  { label: "کود", words: ["کود", "اوره", "فسفات", "پتاس", "نیترات", "سولفات", "کوددهی"] },
  { label: "سم", words: ["سم", "حشره کش", "قارچ کش", "علف کش", "کنه کش", "سمپاشی"] },
  { label: "آب و برق", words: ["آب", "برق", "پمپ", "آبیاری", "حقابه", "قبض"] },
  { label: "کارگر", words: ["کارگر", "دستمزد", "مزد", "نفرروز", "وجین"] },
  { label: "ماشین‌آلات", words: ["تراکتور", "کمباین", "ادوات", "سوخت", "گازوئیل", "اجاره ماشین", "خرمنکوب"] },
  { label: "حمل و نقل", words: ["حمل", "کرایه", "باربری", "کامیون", "نقل"] },
  { label: "اجاره زمین", words: ["اجاره زمین", "مالیالاجاره", "مال الاجاره"] },
  { label: "تعمیر و نگهداری", words: ["تعمیر", "سرویس", "یدکی", "قطعه"] },
  { label: "عوارض و مالیات", words: ["مالیات", "عوارض", "بیمه"] },
];

interface Rule {
  intent: NluIntent;
  /** AND بین گروه‌ها؛ OR داخل هر گروه */
  groups: string[][];
  block?: string[];
  score: number;
  matched: string;
}

const RULES: Rule[] = [
  {
    intent: "add_expense",
    groups: [["خریدم", "خرید کردم", "پرداخت کردم", "پرداخت شد", "دادم", "خرج", "هزینه", "هزینه کردم", "گرفتم برام", "فاکتور خرید", "واریز کردم", "پولشو دادم", "پول دادم", "یدکی", "گرفتم براش", "قطعه", "تعمیر"]],
    block: ["فروختم", "درآمد", "دور آب", "دور آبی", "نوبت آب", "آبی که", "برگشت", "برگشتن", "بهم برگشت", "پس داد"],
    score: 2.6,
    matched: "expense-verb",
  },
  {
    intent: "add_income",
    groups: [["فروختم", "فروش", "درآمد", "دریافت کردم", "دریافت شد", "گرفتم از", "واریز شد", "پول فروش", "گیرم اومد", "به دستم رسید", "بهم برگشت", "برگشت", "پس داد", "عودت", "برگشتن"]],
    block: ["خریدم", "خرید کردم", "هزینه"],
    score: 2.6,
    matched: "income-verb",
  },
  {
    intent: "sale_crop",
    groups: [["فروش", "فروختم", "بار کردم", "تحویل دادم", "قرارداد فروش", "سیلو", "رفت سیلو"], ["گندم", "جو", "برنج", "محصول", "زعفران", "پسته", "ذرت", "پنبه", "محصولم", "بار", "سیلو", "خریدار"]],
    block: ["درآمد", "حمل", "کرایه"],
    score: 3.2,
    matched: "sale-crop",
  },
  {
    intent: "purchase_input",
    groups: [["خرید", "خریدم", "خریداری", "تهیه کردم", "گرفتم"], ["کود", "سم", "بذر", "نهاده", "سوخت", "کیسه", "ادوات", "قارچ کش", "علف کش"]],
    // اگر پرداخت صریح ذکر شده، intent درست «هزینه» است نه «خرید نهاده»
    block: ["پولشو", "نقد دادم", "پول دادم", "واریز کردم"],
    score: 3.2,
    matched: "purchase-input",
  },
  {
    intent: "harvest_record",
    groups: [["برداشت", "درو کردم", "درو کردیم", "خرمن", "چیدن", "برداشتم", "برداشت کردم", "کمباین", "تمام شد"]],
    score: 2.9,
    matched: "harvest",
  },
  {
    intent: "wage_payment",
    groups: [["دستمزد", "مزد", "کارگر", "کارگرها", "کارگرهای", "نفرروز", "حقوق", "کارگری"], ["دادم", "پرداخت", "تسویه", "ثبت", "روز", "کار کرد", "انجام شد", "هفته", "ماه"]],
    score: 3.0,
    matched: "wage",
  },
  {
    intent: "fertilizer_pesticide",
    groups: [["کود", "سم", "قارچ کش", "علف کش", "کوددهی", "سمپاشی", "اوره", "سولفات"]],
    block: ["قرارداد", "خریدم", "خرید", "پولشو", "نقد دادم", "فاکتور", "واریز کردم", "پول دادم", "از انبار", "خروج انبار"],
    score: 2.9,
    matched: "fertilizer",
  },
  {
    intent: "irrigation_log",
    groups: [["آبیاری", "آب دادم", "آب بدم", "دور آب", "دور آبی", "نوبت آب", "پمپ", "قطره‌ای", "قطره ای", "روشن کردم", "چاه"]],
    score: 2.5,
    matched: "irrigation",
  },
  {
    intent: "cheque_received",
    groups: [["چک", "برگه"], ["گرفتم", "دریافتم", "دریافتی", "وصول", "به دستم رسید", "در جریان", "دستم رسید"]],
    score: 3.45,
    matched: "cheque-in",
  },
  {
    intent: "cheque_paid",
    groups: [["چک"], ["دادم", "پرداختی", "کشیدم", "صادر کردم", "بدهکار"]],
    score: 3.0,
    matched: "cheque-out",
  },
  {
    intent: "loan_installment",
    groups: [["وام", "قسط", "اقساط", "تسهیلات"]],
    score: 2.9,
    matched: "loan",
  },
  {
    intent: "inventory_out",
    groups: [["از انبار", "انبار"], ["کم کن", "خروج", "مصرف", "کم شد", "برداشتم", "ببر"]],
    score: 3.05,
    matched: "inventory-out",
  },
  {
    intent: "report_receivable",
    groups: [["طلب", "مطالبات", "دریافتنی", "بدهکار", "بدهکارن", "طلبکار"], ["چقدر", "چند", "جمع", "مانده", "فهرست", "کیا", "کی", "چیه", "وضعیت", "دارم", "لیست"]],
    score: 3.1,
    matched: "receivable",
  },
  {
    intent: "report_payable",
    groups: [["بدهی", "بدهکارم", "پرداختنی", "بستانکار"], ["چقدر", "چند", "جمع", "مانده", "فهرست", "کی", "چیه", "وضعیت", "دارم"]],
    score: 3.1,
    matched: "payable",
  },
  {
    intent: "report_cash",
    groups: [["نقدینگی", "موجودی نقد", "پول نقد", "مانده نقد", "نقد دارم", "دستم خالی", "صندوق", "چقدر پول"]],
    score: 2.85,
    matched: "cash",
  },
  {
    intent: "report_profit",
    groups: [["سود", "زیان", "ضرر", "سربه سر", "سر به سر", "بهای تمام شده", "قیمت تمام شده", "حاشیه سود"]],
    score: 2.8,
    matched: "profit",
  },
  {
    intent: "report_cheques",
    groups: [["چک"], ["سررسید", "وضعیت", "در جریان", "فهرست", "چقدر", "چند", "چیست", "چیه", "کدوما"]],
    score: 2.75,
    matched: "cheque-report",
  },
  {
    intent: "report_inventory",
    groups: [["انبار", "موجودی", "نهاده"], ["چقدر", "چند", "وضعیت", "مانده", "فهرست", "چی", "مونده"]],
    score: 2.75,
    matched: "inventory-report",
  },
  {
    intent: "legal_cheque",
    groups: [["چک", "برگه"], ["قانون", "قانونی", "معتبر", "اعتبار", "برگشت", "وصول", "چاپ", "امضا", "شکایت", "دادگاه", "قبول"]],
    score: 3.1,
    matched: "legal-cheque",
  },
  {
    intent: "legal_signature",
    groups: [["امضا"], ["قانون", "قانونی", "معتبر", "اعتبار", "الکترونیکی", "گواهی", "سند", "چاپ", "انگشتی"]],
    score: 3.3,
    matched: "legal-signature",
  },
  {
    intent: "legal_contract",
    groups: [["قرارداد", "اجاره نامه", "مزارعه"], ["قانون", "قانونی", "معتبر", "اعتبار", "سند", "رسمی", "امضا", "ثبت", "کافیه", "کافی"]],
    block: ["چه بند", "بنویسم", "بندها"],
    score: 3.0,
    matched: "legal-contract",
  },
  {
    intent: "contract_help",
    groups: [["قرارداد", "اجاره", "مزارعه", "سند", "بند"], ["چطور", "نحوه", "راهنما", "چیست", "بسازم", "وارد کنم", "بنویسم", "بندها"]],
    score: 3.05,
    matched: "contract-help",
  },
  {
    intent: "app_help",
    groups: [["برنامه", "اپ", "نرم افزار", "کشاورز حساب", "کشاورزحساب", "اپلیکیشن", "داده هام", "گوشی"], ["چطور", "چطوری", "راهنما", "کجاست", "چگونه", "آموزش", "بکاپ", "پشتیبان", "نصب", "نگه دارم", "عوض شد"]],
    score: 2.6,
    matched: "app-help",
  },
  {
    intent: "weather",
    groups: [["هوا", "باران", "بارندگی", "دما", "هواشناسی", "پیش بینی", "سرما", "یخبندان"]],
    block: ["مبلغ", "هزینه"],
    score: 2.8,
    matched: "weather",
  },
  { intent: "greeting", groups: [["سلام", "درود", "وقت بخیر", "صبح بخیر", "شب بخیر", "سلام علیکم"]], score: 3.5, matched: "greeting" },
  { intent: "thanks", groups: [["ممنون", "متشکرم", "مرسی", "خداحافظ", "دستت درد نکنه", "عالی بود"]], score: 3.5, matched: "thanks" },
];

/** تطبیق واژه‌ای (نه زیررشته‌ای): «سم» نباید داخل «بنویسم» پیدا شود. */
function matcher(text: string): (word: string) => boolean {
  const tokens = text.split(" ");
  return (word: string) => {
    const normalized = normalizePersian(word);
    if (!normalized) return false;
    if (normalized.includes(" ")) return text.includes(normalized);
    // تطبیق واژه‌ای با پسوندهای صرفی رایج («چکهایی»، «سررسیدن»):
    // فقط از ابتدای توکن و برای واژه‌های ۳ حرف و بیشتر؛ «سم» در «بنویسم» پیدا نمی‌شود.
    return tokens.some((token) => token === normalized || (normalized.length >= 3 && token.startsWith(normalized)));
  };
}

export function detectCrop(text: string): string | undefined {
  const has = matcher(normalizePersian(text));
  return CROPS.find((crop) => has(crop));
}

export function detectCategory(text: string): string | undefined {
  const has = matcher(normalizePersian(text));
  return EXPENSE_CATEGORIES.find((category) => category.words.some((word) => has(word)))?.label;
}

export function detectUnit(text: string): string | undefined {
  const normalized = normalizeUnits(normalizePersian(text));
  const units = ["کیلوگرم", "تن", "هکتار", "مترمربع", "کیسه", "سبد", "کارتن", "خروار", "من", "حلب", "بشکه", "نفرروز"];
  return units.find((unit) => normalized.includes(unit));
}

/** فقط اسلات‌های مرتبط با intent؛ از تولید اسلات نادرست جلوگیری می‌کند. */
export function detectSlots(raw: string, intent: NluIntent): NluSlots {
  const slots: NluSlots = {};
  const RECORD = new Set<NluIntent>([
    "add_expense", "add_income", "sale_crop", "purchase_input", "harvest_record", "wage_payment",
    "fertilizer_pesticide", "irrigation_log", "inventory_out", "report_profit",
  ]);
  const CHEQUE = new Set<NluIntent>(["cheque_received", "cheque_paid", "legal_cheque", "report_cheques"]);

  if (CHEQUE.has(intent)) slots.docType = "cheque";
  if (intent === "legal_signature") slots.docType = "signature";
  if (intent === "legal_contract" || intent === "contract_help") slots.docType = "contract";
  if (intent === "loan_installment") slots.topic = "وام";

  if (RECORD.has(intent)) {
    const crop = detectCrop(raw);
    if (crop) slots.crop = crop;
    const category = detectCategory(raw);
    if (category) slots.category = category;
    const unit = detectUnit(raw);
    if (unit) slots.unit = unit;
  }
  // فقط نقش/جهتی که صریحاً از intent برمی‌آید و در قرارداد داده انتظار می‌رود.
  // اسلات‌های حدسی حذف شدند تا هشدارهای اشتباه ساخته نشود (دقت اسلات).
  if (intent === "sale_crop") slots.role = "seller";
  if (intent === "wage_payment") slots.role = "worker";
  if (intent === "cheque_paid") slots.direction = "out";
  if (intent === "cheque_received") slots.direction = "in";
  for (const key of Object.keys(slots) as (keyof NluSlots)[]) if (!slots[key]) delete slots[key];
  return slots;
}

function confidenceOf(best: number, runnerUp: number): number {
  if (best <= 0) return 0;
  const separation = (best - runnerUp * 0.75) / best;
  return Math.max(0, Math.min(0.99, 0.55 + separation * 0.42));
}

/**
 * تشخیص قاعدهٔ برنده. امتیاز = بیشترین قاعدهٔ منطبق برای هر intent؛
 * اطمینان از فاصلهٔ بهترین تا دومی محاسبه می‌شود.
 */
export function runRules(raw: string): RuleResult | null {
  const text = normalizePersian(raw);
  if (!text) return null;
  const has = matcher(text);
  const key = sentenceKey(raw);
  const byIntent = new Map<NluIntent, { score: number; matched: string }>();

  for (const rule of RULES) {
    if (rule.block?.some((word) => has(word))) continue;
    if (!rule.groups.every((group) => group.some((word) => has(word)))) continue;
    const current = byIntent.get(rule.intent);
    if (!current || current.score < rule.score) byIntent.set(rule.intent, { score: rule.score, matched: rule.matched });
  }

  if (byIntent.size === 0) return null;
  const ranked = [...byIntent.entries()].sort((a, b) => b[1].score - a[1].score);
  const [bestIntent, best] = ranked[0];
  const confidence = Number(confidenceOf(best.score, ranked[1]?.[1].score ?? 0).toFixed(3));
  if (confidence < RULE_THRESHOLD) return null;
  return { intent: bestIntent, confidence, slots: detectSlots(raw, bestIntent), matched: best.matched, key };
}

/** برای کالیبراسیون: نتیجه بدون اعمال آستانه. */
export function runRulesRaw(raw: string): { intent: NluIntent; confidence: number; matched: string; key: string } | null {
  const text = normalizePersian(raw);
  if (!text) return null;
  const has = matcher(text);
  const key = sentenceKey(raw);
  const candidates: { intent: NluIntent; score: number; matched: string }[] = [];
  for (const rule of RULES) {
    if (rule.block?.some((word) => has(word))) continue;
    if (!rule.groups.every((group) => group.some((word) => has(word)))) continue;
    candidates.push({ intent: rule.intent, score: rule.score, matched: rule.matched });
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) => b.score - a.score);
  return {
    intent: candidates[0].intent,
    confidence: Number(confidenceOf(candidates[0].score, candidates[1]?.score ?? 0).toFixed(3)),
    matched: candidates[0].matched,
    key,
  };
}

export function ruleHash(raw: string): number {
  return hashKey(sentenceKey(raw));
}

export const RULE_ENGINE_VERSION = "1.0.0";
export const RULE_COUNT = RULES.length;

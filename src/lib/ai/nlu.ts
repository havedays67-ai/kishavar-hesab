/* Persian natural-language helpers for the farm assistant. */
import { toEnDigits } from "@/lib/format";

export function normalizeFa(input: string): string {
  return toEnDigits(String(input ?? ""))
    .replace(/[يیۍ]/g, "ی")
    .replace(/[كک]/g, "ک")
    .replace(/[ۀهٔ]/g, "ه")
    .replace(/[أإآا]/g, "ا")
    .replace(/[ؤو]/g, "و")
    .replace(/\u200c/g, " ")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/[^\p{L}\p{N}\s.,:/\-+٪%]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export { parseAmount } from "@/lib/engine/money";

export function parseQuantity(text: string): number | null {
  const t = normalizeFa(text);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(کیلو|کیلوگرم|لیتر|عدد|بوته|تن|هکتار|کیسه|شاخه|روز|نفر)?/u);
  if (!m) return null;
  let value = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;
  if (m[2] === "تن") value *= 1000;
  return value;
}

export function parseDays(text: string): number | null {
  const t = normalizeFa(text);
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(روز|نفر ?روز|نفر)/u);
  if (!m) return null;
  const v = Number(m[1].replace(/,/g, ""));
  return Number.isFinite(v) ? v : null;
}

export function containsAny(text: string, words: string[]): boolean {
  const t = normalizeFa(text);
  return words.some((w) => t.includes(normalizeFa(w)));
}

const JALALI_MONTH_NAMES = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

function jalaliToGregorian(jy: number, jm: number, jd: number): { gy: number; gm: number; gd: number } {
  let jy2 = jy - 979;
  const jm2 = jm - 1;
  const jd2 = jd - 1;
  let j_day_no = 365 * jy2 + Math.floor(jy2 / 33) * 8 + Math.floor(((jy2 % 33) + 3) / 4);
  for (let i = 0; i < jm2; i += 1) j_day_no += i < 6 ? 31 : 30;
  j_day_no += jd2;
  let g_day_no = j_day_no + 79;
  let gy = 1600 + 400 * Math.floor(g_day_no / 146097);
  g_day_no %= 146097;
  let leap = true;
  if (g_day_no >= 36525) {
    g_day_no -= 1;
    gy += 100 * Math.floor(g_day_no / 36524);
    g_day_no %= 36524;
    if (g_day_no >= 365) g_day_no += 1;
    else leap = false;
  }
  gy += 4 * Math.floor(g_day_no / 1461);
  g_day_no %= 1461;
  if (g_day_no >= 366) {
    leap = false;
    g_day_no -= 1;
    gy += Math.floor(g_day_no / 365);
    g_day_no %= 365;
  }
  const gd_m = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  while (gm < 12 && g_day_no >= gd_m[gm]) {
    g_day_no -= gd_m[gm];
    gm += 1;
  }
  jy2 = 0;
  return { gy, gm: gm + 1, gd: g_day_no + 1 };
}

const isoOf = (d: Date) => d.toISOString().slice(0, 10);
const shift = (days: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return isoOf(d);
};

/** Understands امروز/فردا/دیروز/«۱۰ روز بعد»/«۱۵ آبان»/«1404/08/15». */
export function parseDueDate(text: string): string | null {
  const t = normalizeFa(text);
  if (!t) return null;
  if (/(پس ?فردا)/u.test(t)) return shift(2);
  if (/(فردا)/u.test(t)) return shift(1);
  if (/(دیروز)/u.test(t)) return shift(-1);
  if (/(امروز|همین امروز)/u.test(t)) return shift(0);

  const rel = t.match(/(\d+)\s*(روز|هفته|ماه)\s*(بعد|دیگر|اینده|بعدا)/u);
  if (rel) {
    const n = Number(rel[1]);
    const days = rel[2] === "هفته" ? n * 7 : rel[2] === "ماه" ? n * 30 : n;
    return shift(days);
  }
  const rel2 = t.match(/(تا|در)\s*(\d+)\s*(روز|هفته|ماه)/u);
  if (rel2) {
    const n = Number(rel2[2]);
    const days = rel2[3] === "هفته" ? n * 7 : rel2[3] === "ماه" ? n * 30 : n;
    return shift(days);
  }

  const numeric = t.match(/(1[34]\d{2})[/\-](\d{1,2})[/\-](\d{1,2})/u);
  if (numeric) {
    const g = jalaliToGregorian(Number(numeric[1]), Number(numeric[2]), Number(numeric[3]));
    return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
  }

  const monthMatch = JALALI_MONTH_NAMES.findIndex((m) => t.includes(normalizeFa(m)));
  if (monthMatch >= 0) {
    const dayMatch = t.match(/(\d{1,2})/u);
    const day = dayMatch ? Number(dayMatch[1]) : 15;
    const now = new Date();
    const jalaliYear = Number(new Intl.DateTimeFormat("en-US-u-ca-persian", { year: "numeric" }).format(now).replace(/\D/g, ""));
    const g = jalaliToGregorian(jalaliYear, monthMatch + 1, Math.min(Math.max(day, 1), 30));
    return `${g.gy}-${String(g.gm).padStart(2, "0")}-${String(g.gd).padStart(2, "0")}`;
  }
  return null;
}

export type AssistIntent =
  | "add_expense"
  | "add_income"
  | "add_debt"
  | "add_receivable"
  | "add_cheque"
  | "add_task"
  | "add_labor"
  | "inventory_out"
  | "inventory_in"
  | "settle_cheque"
  | "settle_debt"
  | "add_land"
  | "report"
  | "learn"
  | "unknown";

export function detectIntent(text: string): AssistIntent {
  const t = normalizeFa(text);
  if (!t) return "unknown";
  // یادآوری و کار
  if (/(یادداشت|یادم باشه|یاداوری|کار جدید|کار برام|تسک|وظیفه|اضافه کن به کارها|todo)/u.test(t)) return "add_task";
  // چک: تسویه یا ثبت
  if (/(چک|برگه چک)/u.test(t)) {
    if (/(پاس شد|پاس کن|نقد شد|نقد کن|تسویه|وامونده|انجام شد|برگشت خورد)/u.test(t)) return "settle_cheque";
    return "add_cheque";
  }
  // تسویه بدهی/طلب
  if (/(بدهی|بدهکار|طلب|قرض)/u.test(t) && /(تسویه|پرداخت کردم|دریافت کردم|دادم|گرفتم|بسته|تصفیه)/u.test(t)) return "settle_debt";
  const hasTransactionVerb = /(خریدم|خرید کردم|فروختم|فروش کردم|پرداخت کردم|ثبت کن|بدهکارم|طلب دارم|کم کن|وارد کردم|کار کرد|روز کار|بنویس|بکش)/u.test(t);
  if (!hasTransactionVerb) {
    if (/(چیست|چطور|چگونه|یعنی|فرق|تفاوت|اموزش|یاد بده|محاسبه|تعریف)/u.test(t)) return "learn";
    if (/(گزارش|چقدر|سود|زیان|وضعیت|جمع|خلاصه|بهای تمام|تعادل|موجودی)/u.test(t)) return "report";
  }
  // انبار: فقط وقتی صریحاً از انبار صحبت شود
  if (/(انبار|موجودی|نهاده)/u.test(t)) {
    if (/(خروج|مصرف|کم کن|بردار|کسر|استفاده کردم)/u.test(t)) return "inventory_out";
    if (/(وارد|اضافه کن|رسید انبار|ورود|تحویل گرفتم)/u.test(t)) return "inventory_in";
  }
  // بدهی و طلب
  if (/(بدهکار|بدهی|بدهیم|قرض دارم|قرض گرفتم)/u.test(t)) return "add_debt";
  if (/(طلبکار|طلب دارم|طلبم|از .{0,20} طلب)/u.test(t)) return "add_receivable";
  // دستمزد
  if (/(کارگر|دستمزد|نفر روز|نفرروز|روزمزد|گل چین|گلچین)/u.test(t)) return "add_labor";
  // زمین جدید
  if (/(زمین جدید|قطعه جدید|مزرعه جدید|زمین خریدم|زمین اجاره کردم|اضافه کردن زمین)/u.test(t)) return "add_land";
  // درآمد
  if (/(درامد|فروختم|فروش داشتم|فروش محصول|فروش گندم|فروش زعفران|فروش گردو|فروش گوجه|فروش کلزا|(^|\s)فروش(\s|$)|دریافت کردم|گرفتم|وصول|یارانه|اجاره دادم)/u.test(t)) return "add_income";
  // هزینه
  if (/(هزینه|خریدم|خرید|پرداخت|دادم|خرج|کردم|گازوییل|گازوئیل|کود|سم|بذر|نشا|سوخت|تعمیر|کرایه|حمل|بیمه|بسته بندی)/u.test(t)) return "add_expense";
  // گزارش و پرسش
  if (/(گزارش|سود|زیان|چقدر|چند|تحلیل|جمع|خلاصه|بهای تمام|تعادل|وضعیت|موجودی|بدهی|طلب|چک)/u.test(t)) return "report";
  if (/(چطور|چگونه|اموزش|یاد بده|یعنی|فرق|تفاوت|تعریف|راهنما|حسابداری|محاسبه)/u.test(t)) return "learn";
  return "unknown";
}

export function matchByName<T extends { name: string }>(text: string, items: T[]): T | null {
  const t = normalizeFa(text);
  let best: { item: T; score: number } | null = null;
  for (const item of items) {
    const name = normalizeFa(item.name);
    if (!name) continue;
    let score = 0;
    if (t.includes(name)) {
      score = name.length + 20;
    } else {
      const tokens = name.split(" ").filter((w) => w.length > 2);
      tokens.forEach((token, index) => {
        if (!t.includes(token)) return;
        // the first word of a name (e.g. «حسن» in «حسن رضایی») is far more identifying
        if (index === 0) score += 12;
        else score += token.length >= 4 ? 3 : 2;
      });
    }
    if (score > 0 && (!best || score > best.score)) best = { item, score };
  }
  return best?.item ?? null;
}

const CATEGORY_ALIASES: { match: RegExp; name: string }[] = [
  { match: /(دستمزد|کارگر|کارگری|نفر ?روز|گل ?چین)/u, name: "دستمزد کارگر" },
  { match: /(کود|سم|حشره ?کش|علف ?کش|پتاس|اوره|سولفات)/u, name: "کود و سم" },
  { match: /(بذر|نشا|نهال|پیاز)/u, name: "بذر و نهال" },
  { match: /(گازوییل|گازوئیل|سوخت|بنزین|برق|انرژی|گاز)/u, name: "سوخت و انرژی" },
  { match: /(اب|ابیاری|قطره|چاه|پمپ)/u, name: "آبیاری و آب" },
  { match: /(اجاره زمین|اجاره قطعه|اجاره سالانه)/u, name: "اجاره زمین" },
  { match: /(تعمیر|سرویس|لاستیک|مکانیک)/u, name: "تعمیر ماشین‌آلات" },
  { match: /(حمل|کرایه|باربری|تریلر)/u, name: "حمل و نقل" },
  { match: /(بیمه|عوارض|مالیات|مجوز)/u, name: "بیمه و عوارض" },
  { match: /(بسته ?بندی|کارتن|جعبه|سلفون)/u, name: "بسته‌بندی" },
  { match: /(علوفه|دام|گوسفند|گاو|طیور|مرغ)/u, name: "خرید دام و علوفه" },
  { match: /(فروش محصول|فروختم|فروش گندم|فروش زعفران|فروش گردو|فروش گوجه|فروش کلزا)/u, name: "فروش محصول" },
  { match: /(یارانه|کمک دولتی|جهاد)/u, name: "یارانه و کمک دولتی" },
  { match: /(اجاره ماشین|اجاره تراکتور|اجاره کمباین)/u, name: "اجاره ماشین‌آلات" },
  { match: /(ضایعات|اوراق)/u, name: "فروش ضایعات" },
  { match: /(دام و طیور|فروش دام|فروش مرغ)/u, name: "فروش دام و طیور" },
];

export function guessCategoryName(text: string): string | null {
  const t = normalizeFa(text);
  for (const alias of CATEGORY_ALIASES) {
    const words = alias.match.source
      .replace(/[()?\\]/g, "")
      .split("|")
      .map((w) => normalizeFa(w))
      .filter((w) => w.length > 1);
    if (words.some((w) => t.includes(w))) return alias.name;
  }
  return null;
}

export function isConfirm(text: string): boolean {
  return containsAny(text, ["بله", "تایید", "تأیید", "اره", "آره", "اوکی", "ثبت کن", "درسته", "بزن", "انجام بده", "yes"]);
}

export function isCancel(text: string): boolean {
  return containsAny(text, ["لغو", "نه ", "نمیخوام", "کنسل", "بیخیال", "انصراف"]);
}

/**
 * موتور قطعی پول و اعداد فارسی — هیچ محاسبه‌ای به مدل زبانی سپرده نمی‌شود.
 * همه مبالغ به «تومان» و عدد صحیح ذخیره می‌شوند.
 */

const FA_DIGITS: Record<string, string> = {
  "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4",
  "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export function normalizeDigits(input: string): string {
  return String(input ?? "").replace(/[۰-۹٠-٩]/g, (d) => FA_DIGITS[d] ?? d);
}

export function normalizePersian(input: string): string {
  return normalizeDigits(String(input ?? ""))
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ۀ/g, "ه")
    .replace(/[\u0654\u0655\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/\u200c/g, " ")
    .replace(/[ًٌٍَُِّْ]/g, "")
    .replace(/[«»"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ONES: Record<string, number> = {
  صفر: 0, یک: 1, یکم: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, شیش: 6, هفت: 7, هشت: 8, نه: 9,
  ده: 10, یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, پونزده: 15, شانزده: 16, شونزده: 16,
  هفده: 17, هجده: 18, هیجده: 18, نوزده: 19, بیست: 20, سی: 30, چهل: 40, پنجاه: 50, شصت: 60,
  هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, یکصد: 100, دویست: 200, سیصد: 300, چهارصد: 400,
  پانصد: 500, پونصد: 500, ششصد: 600, شصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900,
};

const SCALES: Record<string, number> = {
  هزار: 1_000,
  میلیون: 1_000_000,
  ملیون: 1_000_000,
  میلیارد: 1_000_000_000,
  ملیارد: 1_000_000_000,
  تریلیون: 1_000_000_000_000,
};

/**
 * «دو میلیون و پانصد هزار» → 2,500,000
 * «یک و نیم میلیون» → 1,500,000
 * «نیم میلیون» → 500,000
 */
export function parsePersianWords(input: string): number | null {
  const text = normalizePersian(input)
    .replace(/[،,]/g, " ")
    .replace(/ و /g, " ");
  const tokens = text.split(" ").filter(Boolean);
  if (!tokens.length) return null;

  let total = 0;
  let current = 0;
  let matched = false;
  let halfNext = false;
  let lastScale = 1_000_000;

  for (const raw of tokens) {
    const token = raw.replace(/[.؛:!?()]/g, "");
    if (!token) continue;
    if (token === "نیم") {
      halfNext = true;
      matched = true;
      continue;
    }
    if (token === "و") continue;
    const scale = SCALES[token];
    if (scale) {
      const base = current + (halfNext ? 0.5 : 0);
      total += (base === 0 ? 1 : base) * scale;
      lastScale = scale;
      current = 0;
      halfNext = false;
      matched = true;
      continue;
    }
    const value = ONES[token];
    if (value !== undefined) {
      current += value;
      matched = true;
      continue;
    }
    if (matched) break;
    return null;
  }

  if (!matched) return null;
  if (halfNext) total += lastScale * 0.5;
  return Math.round(total + current);
}

export interface AmountParse {
  amount: number;
  currency: "toman" | "rial";
  source: "digits" | "words" | "mixed";
  multiplierApplied: number;
}

/**
 * تحلیل قطعی مبلغ از متن فارسی محاوره‌ای و رسمی.
 * پشتیبانی: «۲۵ میلیون»، «دو میلیون و پانصد هزار»، «۱.۵ میلیارد»، «۲ میلیارد و ۳۰۰ میلیون»،
 * «نیم میلیون»، «۵٬۰۰۰٬۰۰۰»، «۲۵۰۰۰۰۰۰ ریال».
 */
export function parseAmount(input: string): AmountParse | null {
  const raw = normalizePersian(input);
  if (!raw) return null;

  const currency: "toman" | "rial" = /ریال/.test(raw) ? "rial" : "toman";
  const cleaned = raw
    .replace(/تومان|تومن|ریال|هزارتومان|هزارتومن/g, " ")
    .replace(/[()،,]/g, " ")
    .replace(/[٬\u066c]/g, "");

  const tokenRe = /(\d+(?:[.,/]\d+)?)|(نیم)|(تریلیون|میلیارد|ملیارد|میلیون|ملیون|هزار)|([\p{L}]+)/gu;
  let total = 0;
  let pending: number | null = null;
  let half = false;
  let sawHalf = false;
  let lastScale = 0;
  let sawScale = false;
  let sawWordNumber = false;
  let sawDigit = false;

  let match: RegExpExecArray | null;
  while ((match = tokenRe.exec(cleaned))) {
    const [, digit, halfToken, scaleToken, word] = match;
    if (digit) {
      const value = Number(digit.replace(/[\/,]/g, "."));
      if (!Number.isFinite(value)) continue;
      pending = (pending ?? 0) + value;
      sawDigit = true;
      continue;
    }
    if (halfToken) {
      half = true;
      sawHalf = true;
      continue;
    }
    if (scaleToken) {
      const scale = SCALES[scaleToken] ?? 1;
      const base = pending === null ? (half ? 0.5 : 1) : pending + (half ? 0.5 : 0);
      total += (base === 0 ? 1 : base) * scale;
      lastScale = scale;
      pending = null;
      half = false;
      sawScale = true;
      continue;
    }
    if (word) {
      const token = word.replace(/[.؛:!?]/g, "");
      if (token === "و") continue;
      const value = ONES[token];
      if (value !== undefined) {
        pending = (pending ?? 0) + value;
        sawWordNumber = true;
      }
      continue;
    }
  }

  if (pending !== null) total += pending;
  else if (half) total += (lastScale || 1_000_000) * 0.5;

  const finalValue = Math.round(total);
  if (!Number.isFinite(finalValue) || finalValue < 100) return null;

  const source: AmountParse["source"] =
    (sawDigit && (sawWordNumber || sawHalf)) || (sawWordNumber && sawHalf)
      ? "mixed"
      : sawDigit
        ? "digits"
        : "words";

  const amount = Math.round(currency === "rial" ? finalValue / 10 : finalValue);
  return { amount, currency, source, multiplierApplied: sawScale ? lastScale : 1 };
}

/** مبلغ بر اساس درصد سهم شریک (مزارعه) */
export function applyShare(amount: number, sharePercent: number): number {
  if (!Number.isFinite(amount) || !Number.isFinite(sharePercent)) return 0;
  const clamped = Math.min(100, Math.max(0, sharePercent));
  return Math.round((amount * clamped) / 100);
}

/** تبدیل ریال به تومان و برعکس (بدون اعشار) */
export const rialToToman = (rial: number): number => Math.round(rial / 10);
export const tomanToRial = (toman: number): number => Math.round(toman * 10);

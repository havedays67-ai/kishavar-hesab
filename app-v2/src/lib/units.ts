/**
 * واحدهای وزنی و نمایش دوگانه (کیلوگرم و تن)
 * ------------------------------------------------
 * قاعده: همهٔ محاسبات داخلی روی «کیلوگرم» انجام می‌شود و نمایش، هر دو شکل
 * (کیلوگرم و تن) را می‌دهد؛ هم با رقم و هم با حروف. این کار از خطای تبدیل
 * واحد و از سردرگمی کاربر در قراردادهایی مثل فروش تخم آفتابگردان جلوگیری می‌کند.
 *
 * هیچ ورودی نامعتبری حدس زده نمی‌شود: مقدار منفی/غیرعددی → null.
 */
import { numberToPersianWords, toPersianDigits } from "./fa-number";
import { formatTomanAmount } from "./money-format";

export type WeightUnit = "kg" | "ton";

export const WEIGHT_UNITS: { id: WeightUnit; label: string; short: string }[] = [
  { id: "kg", label: "کیلوگرم", short: "کیلو" },
  { id: "ton", label: "تن", short: "تن" },
];

/** سقف منطقی: ۱۰٬۰۰۰ تن (از این بیشتر تقریباً همیشه اشتباه تایپی است) */
export const MAX_KG = 10_000_000;

/** جداکننده‌های فارسی/عربی و ارقام را پاک می‌کند و عدد می‌دهد (بدون NaN). */
export function parseNumericInput(input: string): number | null {
  if (typeof input !== "string") return null;
  const normalized = input
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬\u066c,،]/g, "")
    .replace(/٫/g, ".")
    .replace(/\s+/g, "");
  if (!normalized) return null;
  if (!/^-?\d*\.?\d+$/.test(normalized) && !/^-?\d+\.$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** گِرد کردن به میلی‌گرم (۳ رقم اعشار کیلوگرم) بدون خطای ممیز شناور محسوس. */
export function roundKg(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function toKg(value: number, unit: WeightUnit): number {
  if (!Number.isFinite(value)) return 0;
  return roundKg(unit === "ton" ? value * 1000 : value);
}

export function toTon(kg: number): number {
  if (!Number.isFinite(kg)) return 0;
  return Math.round((kg / 1000 + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  const kg = toKg(value, from);
  return to === "kg" ? kg : toTon(kg);
}

export interface WeightDisplay {
  kg: number;
  ton: number;
  /** «۲٬۰۰۰ کیلوگرم» */
  kgLabel: string;
  /** «۲ تن» */
  tonLabel: string;
  /** «۲٬۰۰۰ کیلوگرم (۲ تن)» */
  both: string;
  /** «دو هزار کیلوگرم» */
  kgWords: string;
  /** «دو تن» (یا برای کسر تن: «یک تن و پانصد کیلوگرم») */
  tonWords: string;
  /** «دو هزار کیلوگرم (دو تن)» */
  bothWords: string;
}

const numberLabel = (value: number): string => toPersianDigits(value.toLocaleString("en-US"));

/** نمایش کیلوگرم با حداکثر ۳ رقم اعشار و جداکنندهٔ هزارگان. */
export function formatKg(kg: number): string {
  const safe = roundKg(kg);
  const label = Number.isInteger(safe)
    ? numberLabel(safe)
    : toPersianDigits(safe.toLocaleString("en-US", { maximumFractionDigits: 3 })).replace(/\./g, "٫");
  return `${label} کیلوگرم`;
}

export function formatTon(kg: number): string {
  const ton = toTon(kg);
  const label = Number.isInteger(ton)
    ? numberLabel(ton)
    : toPersianDigits(ton.toLocaleString("en-US", { maximumFractionDigits: 6 })).replace(/\./g, "٫");
  return `${label} تن`;
}

/**
 * «۲ تن و پانصد کیلوگرم» برای مقدارهای ترکیبی.
 * باگ‌های رفع‌شده:
 *  • ۰٫۲۵ کیلوگرم قبلاً «صفر کیلوگرم» می‌شد (کسر زیر نیم کیلو کامل گم می‌شد).
 *  • ۱۰۰۰٫۵ کیلوگرم «یک تن و یک کیلوگرم» می‌شد (نیم کیلو گرد می‌شد).
 * اکنون گرم‌ها هم نوشته می‌شوند و هیچ بخشی گم نمی‌شود.
 */
export function tonWordsOf(kg: number): string {
  const safe = roundKg(kg);
  const wholeTon = Math.floor(toTon(safe));
  const remainderKg = roundKg(safe - wholeTon * 1000);
  const wholeKg = Math.floor(remainderKg);
  const grams = Math.round((remainderKg - wholeKg) * 1000);
  const parts: string[] = [];
  if (wholeTon > 0) parts.push(`${numberToPersianWords(wholeTon)} تن`);
  if (wholeKg > 0) parts.push(`${numberToPersianWords(wholeKg)} کیلوگرم`);
  if (grams > 0) parts.push(`${numberToPersianWords(grams)} گرم`);
  if (!parts.length) return "صفر تن";
  return parts.join(" و ");
}

/** «یک هزار کیلوگرم و پانصد گرم»؛ برای کمتر از یک کیلو فقط گرم نوشته می‌شود. */
export function kgWordsOf(kg: number): string {
  const safe = roundKg(kg);
  const whole = Math.floor(safe);
  const grams = Math.round((safe - whole) * 1000);
  if (grams > 0) {
    if (whole === 0) return `${numberToPersianWords(grams)} گرم`;
    return `${numberToPersianWords(whole)} کیلوگرم و ${numberToPersianWords(grams)} گرم`;
  }
  return `${numberToPersianWords(whole)} کیلوگرم`;
}

/** نمایش کامل: رقم هر دو واحد + حروف هر دو واحد. */
export function describeWeight(kg: number): WeightDisplay {
  const safeKg = roundKg(Math.max(0, kg));
  return {
    kg: safeKg,
    ton: toTon(safeKg),
    kgLabel: formatKg(safeKg),
    tonLabel: formatTon(safeKg),
    both: `${formatKg(safeKg)} (${formatTon(safeKg)})`,
    kgWords: kgWordsOf(safeKg),
    tonWords: tonWordsOf(safeKg),
    bothWords: `${kgWordsOf(safeKg)} (${tonWordsOf(safeKg)})`,
  };
}

/** مبلغ پول با حروف (تومان) — منفی و بزرگ هم پشتیبانی می‌شود. */
export function moneyWords(toman: number): string {
  if (!Number.isFinite(toman)) return "";
  const rounded = Math.round(toman);
  // خارج از محدودهٔ عدد صحیح ایمن، هیچ حروفی نوشته نمی‌شود (به‌جای متن نادرست)
  if (!Number.isSafeInteger(rounded)) return "";
  const words = numberToPersianWords(rounded);
  return words ? `${words} تومان` : "";
}

/** نمایش مبلغ با جداکنندهٔ هزارگان لاتین: «100,000,000 تومان» */
export function formatTomanLabel(toman: number): string {
  if (!Number.isFinite(toman)) return "—";
  return formatTomanAmount(toman, true);
}

/** اعتبارسنجی مقدار وزن؛ پیام خطای شفاف برمی‌گرداند (نه حدس). */
export function validateWeight(value: number | null, unit: WeightUnit): string | null {
  if (value === null || !Number.isFinite(value)) return "مقدار وزن را با رقم وارد کنید.";
  if (value <= 0) return "مقدار وزن باید بزرگ‌تر از صفر باشد.";
  const kg = toKg(value, unit);
  if (kg > MAX_KG) return `مقدار بیش از سقف مجاز (${toPersianDigits((MAX_KG / 1000).toLocaleString("en-US"))} تن) است.`;
  return null;
}

export const UNITS_VERSION = "1.0.0";

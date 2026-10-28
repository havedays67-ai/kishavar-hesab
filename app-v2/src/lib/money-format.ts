/**
 * قالب‌بندی یکسان مبلغ/عدد در کل برنامه
 * ---------------------------------------------
 * قاعدهٔ ثابت: نمایش پول همیشه با ارقام لاتین + جداکنندهٔ هزارگان (`100,000,000`)
 * است؛ ورودی کاربر هر شکلی باشد (فارسی، عربی، جداکنندهٔ فارسی، نقطه/ممیز) اول
 * به ارقام لاتین و سپس به قالب استاندارد تبدیل می‌شود.
 *
 * چرا `Intl.NumberFormat` مستقیم استفاده نمی‌شود: در بعضی محیط‌ها (WebView قدیمی،
 * ICU محدود) ممکن است ارقام محلی یا NBSP بدهد؛ اینجا خروجی قطعی است.
 */
export const MONEY_GROUP_SEPARATOR = ",";
export const DECIMAL_SEPARATOR = ".";

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

/** ارقام فارسی/عربی → لاتین (بدون دست‌زدن به بقیهٔ متن). */
export function toLatinDigits(input: string): string {
  return String(input ?? "")
    .replace(/[۰-۹]/g, (digit) => String(FA_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

/** جداکننده‌های فارسی/عربی → لاتین. */
export function normalizeSeparators(input: string): string {
  return String(input ?? "")
    .replace(/[٬\u066c،]/g, ",")
    .replace(/٫/g, ".");
}

/**
 * عدد را با جداکنندهٔ هزارگان و ارقام لاتین برمی‌گرداند.
 * «۱۰۰۰۰۰۰۰۰» → «100,000,000» · «-2500» → «-2,500» · اعشار تا ۳ رقم حفظ می‌شود.
 */
export function formatAmount(value: number, options: { decimals?: number; grouping?: boolean } = {}): string {
  const { decimals = 3, grouping = true } = options;
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value * 10 ** decimals) / 10 ** decimals;
  const negative = rounded < 0;
  const [wholePart, fractionPart = ""] = Math.abs(rounded).toFixed(decimals).split(".");
  const trimmedFraction = fractionPart.replace(/0+$/, "");
  const groupedWhole = grouping ? wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, MONEY_GROUP_SEPARATOR) : wholePart;
  const body = trimmedFraction ? `${groupedWhole}${DECIMAL_SEPARATOR}${trimmedFraction}` : groupedWhole;
  return negative ? `-${body}` : body;
}

/** مبلغ تومان با واحد و جداکننده: «100,000,000 تومان» */
export function formatTomanAmount(value: number, withUnit = true): string {
  const formatted = formatAmount(value, { decimals: 0 });
  return withUnit ? `${formatted} تومان` : formatted;
}

/** فقط رقم و جداکننده/ممیز نگه می‌دارد (برای ورودی‌های پول). */
export function digitsOnly(input: string): string {
  return toLatinDigits(normalizeSeparators(input)).replace(/[^\d.-]/g, "");
}

/**
 * متن ورودی کاربر را به «قالب نمایش استاندارد» تبدیل می‌کند تا همان‌طور که
 * تایپ می‌کند جداکننده اضافه/اصلاح شود: «100000000» → «100,000,000».
 * فقط سال صحیح (integer) را پشتیبانی می‌کند؛ برای مبالغ و قیمت‌ها همین کافی است.
 */
export function formatAmountInput(raw: string): string {
  const latin = toLatinDigits(normalizeSeparators(raw)).replace(/[^\d-]/g, "");
  if (!latin || latin === "-") return "";
  const negative = latin.startsWith("-");
  const digits = latin.replace(/-/g, "").replace(/^0+(?=\d)/, "").slice(0, 18);
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, MONEY_GROUP_SEPARATOR);
  return negative ? `-${grouped}` : grouped;
}

/**
 * ورودی قالب‌بندی‌شده (`100,000,000`) یا خام (`۱۰۰۰۰۰۰۰۰`) را به عدد امن
 * تبدیل می‌کند. برای مبلغ رسید/پرداخت که فقط عدد صحیح و نامنفی است.
 * ورودی نامعتبر یا بزرگ‌تر از `Number.MAX_SAFE_INTEGER` → null.
 */
export function parseAmountInput(raw: string): number | null {
  const latin = toLatinDigits(normalizeSeparators(raw)).replace(/[^\d]/g, "");
  if (!latin) return null;
  const normalized = latin.replace(/^0+(?=\d)/, "");
  if (normalized.length > 15) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/** نمایش وزن اعشاری بدون صفر اضافی: «2,500»، «2.5»، «0.25» */
export function formatQuantity(value: number): string {
  return formatAmount(value, { decimals: 3 });
}

export const MONEY_FORMAT_VERSION = "1.0.0";

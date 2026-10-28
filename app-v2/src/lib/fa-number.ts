/**
 * ابزارهای عددی فارسی — مستقل و بدون وابستگی خارجی
 * ----------------------------------------------------
 * چرا: units/quick-sale در تست‌های ریشه و CI استفاده می‌شوند؛ ایمپورت
 * format.ts آن‌ها را به jalaali-js (نصب‌شده فقط در app-v2) گره می‌زد و
 * CI را قرمز می‌کرد. این فایل هیچ ایمپورتی ندارد.
 */
const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(value: string | number): string {
  return String(value ?? "").replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

/** ارقام فارسی/عربی و جداکننده‌ها → لاتین (بدون NaN). */
export function toEnglishDigits(value: string): string {
  return String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[٬\u066c،]/g, ",")
    .replace(/٫/g, ".");
}

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", " هزار", " میلیون", " میلیارد", " هزار میلیارد", " میلیون میلیارد", " میلیارد میلیارد"];

function threeDigitsToWords(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (remainder >= 10 && remainder < 20) parts.push(TEENS[remainder - 10]);
  else {
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    if (tens) parts.push(TENS[tens]);
    if (ones) parts.push(ONES[ones]);
  }
  return parts.filter(Boolean).join(" و ");
}

/** عدد → حروف فارسی؛ ورودی نامعتبر یا بزرگ‌تر از ۱۰^۱۸ رشتهٔ خالی می‌دهد. */
export function numberToPersianWords(value: number): string {
  if (!Number.isFinite(value)) return "";
  const negative = value < 0;
  const safe = Math.abs(Math.floor(value));
  if (safe === 0) return "صفر";
  if (safe >= 1e18) return "";
  const groups: number[] = [];
  let remaining = safe;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  const words = groups
    .map((group, index) => (group ? `${threeDigitsToWords(group)}${SCALES[index] ?? ""}` : ""))
    .filter(Boolean)
    .reverse()
    .join(" و ");
  return negative ? `منفی ${words}` : words;
}

export const FA_NUMBER_VERSION = "1.0.0";

import {
  jalaaliMonthLength,
  jalaaliToDateObject,
  toGregorian,
  toJalaali,
} from "jalaali-js";

export type JDate = {
  jy: number;
  jm: number;
  jd: number;
};

export const JALALI_MONTHS = [
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
] as const;

export const JALALI_WEEKDAYS = ["شنبه", "یک‌شنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنج‌شنبه", "جمعه"] as const;

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/\d/g, (digit) => FA_DIGITS[Number(digit)]);
}

export function toEnglishDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
}

export function normalizeSearch(value: string): string {
  return value
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .trim()
    .toLowerCase();
}

export function todayJalali(): JDate {
  const result = toJalaali(new Date());
  return { jy: result.jy, jm: result.jm, jd: result.jd };
}

export function dateToJalali(date: Date): JDate {
  const result = toJalaali(date);
  return { jy: result.jy, jm: result.jm, jd: result.jd };
}

export function jalaliToDate(date: JDate): Date {
  const result = toGregorian(date.jy, date.jm, date.jd);
  return new Date(result.gy, result.gm - 1, result.gd);
}

export function addJalaliYears(date: JDate, years: number): JDate {
  const targetYear = date.jy + years;
  const maxDay = jalaaliMonthLength(targetYear, date.jm);
  return { jy: targetYear, jm: date.jm, jd: Math.min(date.jd, maxDay) };
}

export function addJalaliMonths(date: JDate, months: number): JDate {
  const total = date.jy * 12 + (date.jm - 1) + months;
  const jy = Math.floor(total / 12);
  const jm = (total % 12) + 1;
  const maxDay = jalaaliMonthLength(jy, jm);
  return { jy, jm, jd: Math.min(date.jd, maxDay) };
}

export function monthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm);
}

export function jalaliWeekdayIndex(date: JDate): number {
  // Saturday = 0, Sunday = 1, …, Friday = 6
  return (jalaaliToDateObject(date.jy, date.jm, date.jd).getDay() + 1) % 7;
}

export function datesEqual(a: JDate | null, b: JDate | null): boolean {
  return Boolean(a && b && a.jy === b.jy && a.jm === b.jm && a.jd === b.jd);
}

export function formatJalali(date: JDate, style: "short" | "long" | "weekday" = "short"): string {
  if (style === "short") {
    return toPersianDigits(
      `${date.jy}/${String(date.jm).padStart(2, "0")}/${String(date.jd).padStart(2, "0")}`
    );
  }
  const base = toPersianDigits(`${date.jd} ${JALALI_MONTHS[date.jm - 1]} ${date.jy}`);
  if (style === "weekday") {
    return `${JALALI_WEEKDAYS[jalaliWeekdayIndex(date)]}، ${base}`;
  }
  return base;
}

export function formatIsoInJalali(iso: string, style: "short" | "long" = "long"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "نامشخص";
  return formatJalali(dateToJalali(date), style);
}

export function daysBetween(start: JDate, end: JDate): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((jalaliToDate(end).getTime() - jalaliToDate(start).getTime()) / oneDay));
}

export function formatDuration(start: JDate, end: JDate): string {
  const days = daysBetween(start, end);
  if (days === 0) return "بدون مدت";
  if (days % 365 === 0) return `${toPersianDigits(days / 365)} سال`;
  if (days % 30 === 0) return `${toPersianDigits(days / 30)} ماه`;
  return `${toPersianDigits(days)} روز`;
}

export function formatNumber(value: number): string {
  return Number.isFinite(value) ? value.toLocaleString("en-US") : "0";
}

export function formatToman(value: number, withUnit = true): string {
  return `${formatNumber(value)}${withUnit ? " تومان" : ""}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return "نامشخص";
  const mb = bytes / (1024 * 1024);
  return `${toPersianDigits(mb.toFixed(1).replace(".", "٫"))} مگابایت`;
}

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "یکصد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", " هزار", " میلیون", " میلیارد", " هزار میلیارد"];

function threeDigitsToWords(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (remainder >= 10 && remainder < 20) {
    parts.push(TEENS[remainder - 10]);
  } else {
    const tens = Math.floor(remainder / 10);
    const ones = remainder % 10;
    if (tens) parts.push(TENS[tens]);
    if (ones) parts.push(ONES[ones]);
  }
  return parts.filter(Boolean).join(" و ");
}

export function numberToPersianWords(value: number): string {
  const safe = Math.max(0, Math.floor(value));
  if (safe === 0) return "صفر";
  const groups: number[] = [];
  let remaining = safe;
  while (remaining > 0) {
    groups.push(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }
  return groups
    .map((group, index) => (group ? `${threeDigitsToWords(group)}${SCALES[index] ?? ""}` : ""))
    .filter(Boolean)
    .reverse()
    .join(" و ");
}

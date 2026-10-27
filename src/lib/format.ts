/* Persian-aware formatting helpers (pure, no dependencies) */

const FA_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];

export function toFa(input: string | number): string {
  return String(input).replace(/\d/g, (d) => FA_DIGITS[Number(d)]);
}

export function toEnDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return toFa("0");
  return toFa(
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(value),
  );
}

/** Latin digits + thousands separators (as requested: 100,000,000). */
export function formatLatin(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

/**
 * همه مبالغ در پایگاه داده به «تومان» ذخیره می‌شوند.
 * نمایش رسمی به «ریال» و با جداکننده هزارگان است: 100,000,000 ریال
 */
export function formatRialNumber(valueInToman: number): string {
  return formatLatin(Math.round(valueInToman || 0) * 10);
}

/** مبلغ ذخیره‌شده (تومان) → «100,000,000 ریال» */
export function formatMoney(value: number, opts?: { sign?: boolean }): string {
  const v = Math.round(value || 0);
  const sign = opts?.sign && v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${formatRialNumber(Math.abs(v))} ریال`;
}

const WORD_ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const WORD_TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const WORD_TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const WORD_HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const WORD_SCALES = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

function threeDigitsToWords(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  if (hundreds) parts.push(WORD_HUNDREDS[hundreds]);
  const rest = value % 100;
  if (rest >= 10 && rest < 20) {
    parts.push(WORD_TEENS[rest - 10]);
  } else {
    const tens = Math.floor(rest / 10);
    const ones = rest % 10;
    if (tens) parts.push(WORD_TENS[tens]);
    if (ones) parts.push(WORD_ONES[ones]);
  }
  return parts.filter(Boolean).join(" و ");
}

/** 25_000_000 → «بیست و پنج میلیون» */
export function numberToPersianWords(value: number): string {
  let rest = Math.round(Math.abs(value || 0));
  if (!rest) return "صفر";
  const groups: string[] = [];
  let scale = 0;
  while (rest > 0 && scale < WORD_SCALES.length) {
    const group = rest % 1000;
    if (group) {
      const words = threeDigitsToWords(group);
      groups.unshift(`${words}${scale ? ` ${WORD_SCALES[scale]}` : ""}`);
    }
    rest = Math.floor(rest / 1000);
    scale += 1;
  }
  return groups.join(" و ");
}

/**
 * حروفی مبلغ به «تومان» نوشته می‌شود (مثلاً ۱۰۰ میلیون ریال → «ده میلیون تومان»).
 */
export function formatMoneyWords(valueInToman: number): string {
  const v = Math.round(valueInToman || 0);
  return `${v < 0 ? "منفی " : ""}${numberToPersianWords(v)} تومان`;
}

/** دو خط نمایش مبلغ: عدد ریالی مرتب + حروفی تومانی */
export function moneyLines(valueInToman: number): { rial: string; words: string } {
  return { rial: formatMoney(valueInToman), words: formatMoneyWords(valueInToman) };
}

export function formatCompactMoney(value: number): string {
  const v = Math.abs(Math.round(value || 0));
  const sign = value < 0 ? "−" : "";
  if (v >= 1_000_000_000) return `${sign}${formatNumber(v / 1_000_000_000, 1)} میلیارد`;
  if (v >= 1_000_000) return `${sign}${formatNumber(v / 1_000_000, 1)} میلیون`;
  if (v >= 1_000) return `${sign}${formatNumber(v / 1_000, 0)} هزار`;
  return `${sign}${formatNumber(v)}`;
}

export function formatMoneyUnit(value: number): string {
  return `${formatMoney(value)} تومان`;
}

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
];

/** Gregorian ISO date -> Jalali parts without external deps. */
export function gregorianToJalali(gy: number, gm: number, gd: number) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy = gy <= 1600 ? 0 : 979;
  const gy2 = gy <= 1600 ? gy - 621 : gy - 1600;
  const gm2 = gm > 2 ? gm : gm;
  const days =
    365 * gy2 +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm2 - 1] +
    (gm2 > 2 && ((gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0) ? 1 : 0);
  jy += 33 * Math.floor(days / 12053);
  let rest = days % 12053;
  jy += 4 * Math.floor(rest / 1461);
  rest %= 1461;
  if (rest > 365) {
    jy += Math.floor((rest - 1) / 365);
    rest = (rest - 1) % 365;
  }
  const month = rest < 186 ? 1 + Math.floor(rest / 31) : 7 + Math.floor((rest - 186) / 30);
  const day = 1 + (rest < 186 ? rest % 31 : (rest - 186) % 30);
  return { jy, jm: month, jd: day };
}

function parseISO(iso: string | Date | null | undefined) {
  if (!iso) return null;
  const d = typeof iso === "string" ? new Date(`${iso.slice(0, 10)}T00:00:00Z`) : iso;
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatDate(iso: string | Date | null | undefined): string {
  const d = parseISO(iso);
  if (!d) return "—";
  const { jy, jm, jd } = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return `${toFa(jd)} ${JALALI_MONTHS[jm - 1]} ${toFa(jy)}`;
}

export function formatShortDate(iso: string | Date | null | undefined): string {
  const d = parseISO(iso);
  if (!d) return "—";
  const { jy, jm, jd } = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return `${toFa(jd)} ${JALALI_MONTHS[jm - 1]} ${toFa(String(jy).slice(2))}`;
}

export function monthKey(iso: string): string {
  const d = parseISO(iso);
  if (!d) return "";
  const { jy, jm } = gregorianToJalali(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  return `${jy}-${String(jm).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${JALALI_MONTHS[Number(m) - 1] ?? ""} ${toFa(String(y).slice(2))}`;
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysUntil(iso: string | null | undefined): number | null {
  const d = parseISO(iso);
  if (!d) return null;
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((d.getTime() - today) / 86_400_000);
}

export function pct(part: number, total: number): string {
  if (!total) return toFa("۰٪");
  return `${formatNumber(Math.round((part / total) * 100), 0)}٪`;
}

export function safeNum(value: unknown, fallback = 0): number {
  const n = Number(toEnDigits(String(value ?? "")).replace(/[,٬\s]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    planned: "برنامه‌ریزی‌شده",
    in_progress: "در حال کشت",
    harvested: "برداشت‌شده",
    pending: "در انتظار",
    passed: "پاس‌شده",
    bounced: "برگشتی",
    open: "باز",
    done: "انجام‌شده",
    payable: "بدهی ما",
    receivable: "طلب ما",
    issued: "صادره",
    received: "دریافتی",
    cash: "نقدی",
    bank: "بانکی",
    credit: "اعتباری",
    income: "درآمد",
    expense: "هزینه",
    low: "کم",
    normal: "معمولی",
    high: "زیاد",
  };
  return map[status] ?? status;
}

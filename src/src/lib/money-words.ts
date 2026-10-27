/**
 * تبدیل عدد به حروف فارسی (برای نمایش مبالغ به تومان).
 * هیچ وابستگی خارجی ندارد و کاملاً قطعی محاسبه می‌شود.
 */

const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES = ["", " هزار", " میلیون", " میلیارد", " تریلیون", " کوادریلیون"];

function underThousand(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest >= 10 && rest < 20) {
    parts.push(TEENS[rest - 10]);
  } else {
    const t = Math.floor(rest / 10);
    const o = rest % 10;
    if (t) parts.push(TENS[t]);
    if (o) parts.push(ONES[o]);
  }
  return parts.join(" و ");
}

/** ۱۰۰۰۰۰۰۰ → «ده میلیون» */
export function numberToPersianWords(value: number): string {
  const rounded = Math.round(Math.abs(Number(value) || 0));
  if (rounded === 0) return "صفر";
  const groups: number[] = [];
  let rest = rounded;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const group = groups[i];
    if (!group) continue;
    parts.push(`${underThousand(group)}${SCALES[i] ?? ""}`);
  }
  return parts.join(" و ");
}

/** مبلغ ذخیره‌شده (تومان) → «ده میلیون تومان» */
export function tomanWords(value: number): string {
  const rounded = Math.round(Number(value) || 0);
  const sign = rounded < 0 ? "منفی " : "";
  return `${sign}${numberToPersianWords(rounded)} تومان`;
}

/**
 * تبدیل عدد صحیح به حروف فارسی — بدون هیچ وابستگی خارجی.
 * (قبلاً از format.ts استفاده می‌شد که به jalaali-js وابسته است و در محیط
 *  تست ریشه/ساخت باندل دردسر می‌ساخت.)
 */
const ONES = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
const TEENS = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];
const TENS = ["", "", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
const HUNDREDS = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
const SCALES: [number, string][] = [
  [1_000_000_000_000, "تریلیون"],
  [1_000_000_000, "میلیارد"],
  [1_000_000, "میلیون"],
  [1_000, "هزار"],
];

function belowThousand(value: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(value / 100);
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  const rest = value % 100;
  if (rest >= 10 && rest < 20) parts.push(TEENS[rest - 10]);
  else {
    const tens = Math.floor(rest / 10);
    if (tens) parts.push(TENS[tens]);
    const ones = rest % 10;
    if (ones) parts.push(ONES[ones]);
  }
  return parts.join(" و ");
}

export function numberToPersianWords(value: number): string {
  if (!Number.isFinite(value)) return "";
  const rounded = Math.round(value);
  if (rounded === 0) return "صفر";
  const negative = rounded < 0;
  let remaining = Math.abs(rounded);
  const parts: string[] = [];
  for (const [size, label] of SCALES) {
    const count = Math.floor(remaining / size);
    if (count) {
      parts.push(`${remaining >= 2 * size ? belowThousand(count) : count > 1 ? belowThousand(count) : ""} ${label}`.trim());
      remaining %= size;
    }
  }
  if (remaining) parts.push(belowThousand(remaining));
  return `${negative ? "منفی " : ""}${parts.join(" و ")}`.trim();
}

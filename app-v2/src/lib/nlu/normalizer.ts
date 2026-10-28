/**
 * نرمال‌ساز فارسی — تابع خالص و تست‌پذیر
 * ------------------------------------------------------------
 * ورودی‌های معادل باید به «کلید یکسان» تبدیل شوند تا کش و بستهٔ پاسخ
 * بتوانند بدون تکرار کار کنند:
 *  • ارقام فارسی/عربی → لاتین
 *  • ي/ى/ك/ة/أ/إ/آ → ی/ی/ک/ه/ا/ا/ا
 *  • حذف نیم‌فاصله، اعراب، نشانه‌گذاری و فاصلهٔ اضافه
 *  • یکسان‌سازی واحدها (کیلو/کیلوگرم، تن/تنه، هکتار/هکتار...)
 *  • خواندن اعداد حرفی («دو میلیون و پانصد هزار» → 2500000)
 *  • یکسان‌سازی واحد پول (ریال/تومان) به نشانهٔ «تومان»
 *
 * قاعدهٔ ثابت: خروجی این فایل هیچ عدد مالی را برای کش/بسته برنمی‌گرداند؛
 * تابع `maskNumbers` برای ساخت کلید است و عدد را با # جایگزین می‌کند.
 */

const ARABIC_MAP: Record<string, string> = {
  ي: "ی", ى: "ی", ك: "ک", ة: "ه", ۀ: "ه", أ: "ا", إ: "ا", آ: "ا", ؤ: "و", ئ: "ی", ٱ: "ا",
};

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (digit) => String(PERSIAN_DIGITS.indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String(ARABIC_DIGITS.indexOf(digit)));
}

const WORD_NUMBERS: Record<string, number> = {
  صفر: 0, یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9,
  ده: 10, یازده: 11, دوازده: 12, سیزده: 13, چهارده: 14, پانزده: 15, شانزده: 16,
  هفده: 17, هجده: 18, نوزده: 19, بیست: 20, سی: 30, چهل: 40, پنجاه: 50,
  شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, دویست: 200, سیصد: 300,
  چهارصد: 400, پانصد: 500, ششصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900,
};

const SCALES: Record<string, number> = { هزار: 1_000, میلیون: 1_000_000, میلیارد: 1_000_000_000, تریلیون: 1_000_000_000_000 };

export interface VerbalNumberResult {
  text: string;
  converted: boolean;
}

/**
 * تبدیل عبارت عددی حرفی به رقم. الگوی «و» جمع می‌کند و مقیاس ضرب.
 * اگر عبارت ترکیبی معتبر نبود، متن دست‌نخورده برمی‌گردد (بدون حدس).
 */
export function normalizeVerbalNumbers(input: string): VerbalNumberResult {
  const words = input.split(/\s+/);
  let converted = false;
  const out: string[] = [];
  let index = 0;

  const parseGroup = (start: number): { value: number; next: number } | null => {
    let total = 0;
    let current = 0;
    let seen = false;
    let i = start;
    while (i < words.length) {
      const word = words[i];
      if (word === "و") {
        i += 1;
        continue;
      }
      if (word in WORD_NUMBERS) {
        current += WORD_NUMBERS[word];
        seen = true;
        i += 1;
        continue;
      }
      if (word in SCALES) {
        const scale = SCALES[word];
        if (!seen) {
          // «هزار» تنها یعنی 1000؛ «صد هزار» یعنی 100*1000
          current = 1;
        }
        total += current * scale;
        current = 0;
        seen = true;
        i += 1;
        continue;
      }
      break;
    }
    if (!seen) return null;
    return { value: total + current, next: i };
  };

  while (index < words.length) {
    const parsed = parseGroup(index);
    // فقط عبارت‌های چندبخشی یا دارای مقیاس را تبدیل می‌کنیم تا «یک روز» خراب نشود.
    const segment = words.slice(index, parsed?.next ?? index + 1);
    const hasScale = segment.some((word) => word in SCALES);
    if (parsed && hasScale && parsed.value > 0) {
      out.push(String(parsed.value));
      converted = true;
      index = parsed.next;
      continue;
    }
    const parsedSimple = parsed && segment.length >= 2 ? parsed : null;
    if (parsedSimple && parsedSimple.value > 0 && segment.length >= 2) {
      out.push(String(parsedSimple.value));
      converted = true;
      index = parsedSimple.next;
      continue;
    }
    out.push(words[index]);
    index += 1;
  }
  return { text: out.join(" "), converted };
}

export interface NormalizeOptions {
  /** ریال را به تومان تبدیل نکن (فقط واحد را استاندارد کن). پیش‌فرض: فقط استانداردسازی */
  maskAmounts?: boolean;
}

/** واحدهای کشاورزی/تجاری را یکسان می‌کند. */
const UNIT_MAP: [RegExp, string][] = [
  [/کیلوگرم|کیلو گرم|کیلو\b/g, "کیلوگرم"],
  [/تنه\b|تن\b/g, "تن"],
  [/هکتار|هکتاری/g, "هکتار"],
  [/متر مربع|مترمربع/g, "مترمربع"],
  [/کیسه|کیسه ای|کیسهای/g, "کیسه"],
  [/سبد|سبدی/g, "سبد"],
  [/کارتن|کارتنی/g, "کارتن"],
  [/خروار/g, "خروار"],
  [/من\b|منه/g, "من"],
  [/ریال/g, "ریال"],
  [/تومان|تومن|تومنی/g, "تومان"],
  [/حلب|حلبی/g, "حلب"],
  [/بشکه/g, "بشکه"],
  [/نفر روز|نفر-روز|نفرروز/g, "نفرروز"],
];

export function normalizeUnits(input: string): string {
  let text = input.replace(/[يىك]/g, (character) => ARABIC_MAP[character] ?? character);
  for (const [pattern, replacement] of UNIT_MAP) text = text.replace(pattern, ` ${replacement} `);
  return text.replace(/\s+/g, " ").trim();
}

/** نرمال‌سازی پایه (بدون حذف عدد). */
export function normalizePersian(input: string): string {
  if (!input) return "";
  let text = normalizeDigits(String(input));
  text = text
    .replace(/[\u200c\u200d\u200e\u200f\u00a0]/g, " ")
    .replace(/[يىك ةۀأإآؤئ]/g, (character) => ARABIC_MAP[character] ?? character)
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[.,؟?!:;،؛()"'«»\[\]{}<>|/\\*+=_~`^%$#@&ـ]/g, " ")
    .replace(/[۰-۹٠-٩]/g, (digit) => normalizeDigits(digit))
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  // یکسان‌سازی «ه» و «ی» پایانی و حذف کشیده
  text = text.replace(/هٔ/g, "ه").replace(/ي/g, "ی").replace(/ك/g, "ک");
  return text;
}

/** اعداد (مبلغ/مقدار/تاریخ) را با # می‌پوشاند تا کلید جمله وابسته به عدد نباشد. */
export function maskNumbers(input: string): string {
  return input.replace(/\d+(?:[.,]\d+)?/g, "#").replace(/\s+/g, " ").trim();
}

/**
 * کلید استاندارد جمله: نرمال + واحد + عدد حرفی + ماسک عدد.
 * هیچ عددی در کلید باقی نمی‌ماند؛ بنابراین مبلغ هرگز در بسته/کش ذخیره نمی‌شود.
 */
export function sentenceKey(input: string): string {
  const base = normalizePersian(input);
  const units = normalizeUnits(base);
  const verbal = normalizeVerbalNumbers(units).text;
  return maskNumbers(verbal).replace(/(\s*#\s*)+/g, " # ").trim();
}

/** امضای عددی پایدار (FNV-1a 32-bit) — سبک و بدون وابستگی. */
export function hashKey(input: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

export function normalizeAndKey(input: string): { text: string; key: string; hash: number } {
  const text = sentenceKey(input);
  return { text, key: text, hash: hashKey(text) };
}

export const NORMALIZER_VERSION = "1.0.0";

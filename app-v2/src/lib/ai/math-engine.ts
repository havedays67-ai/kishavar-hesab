/**
 * موتور ریاضی قطعی کشاورزیار — حساب و کتاب بدون خطای ممیز شناور
 * ============================================================
 * همهٔ محاسبات با اعداد گویا و BigInt انجام می‌شود؛ هیچ‌جا از `eval`،
 * `Function` یا جمع اعشاری float استفاده نمی‌شود. بنابراین:
 *   ۰.۱ + ۰.۲ = دقیقاً ۳/۱۰  (نه 0.30000000000000004)
 *   ۱۰۰ ÷ ۳   = ۱۰۰/۳      (و فقط در نمایش نهایی گرد می‌شود)
 *
 * قواعد ثابت پروژه:
 *  • مبلغ/نتیجه هیچ‌وقت در کش یا بستهٔ پاسخ ذخیره نمی‌شود؛ این ماژول فقط
 *    خروجی لحظه‌ای می‌دهد و Router آن را در حافظهٔ فهم ذخیره نمی‌کند.
 *  • اگر ورودی کامل و بی‌ابهام نبود، `null` برمی‌گردد؛ حدس زده نمی‌شود.
 *  • خروجی همیشه شامل گام‌های محاسبه است تا کاربر بتواند بررسی کند.
 */
import { numberToPersianWords } from "./persian-words";

/* ------------------------------ عدد گویا ------------------------------ */

export interface Ratio {
  n: bigint;
  d: bigint;
}

const ZERO: Ratio = { n: 0n, d: 1n };

function gcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1n;
}

export function ratio(n: bigint | number | Ratio, d: bigint | number | Ratio = 1n): Ratio {
  if (typeof n === "object") {
    // ساخت گویا از یک Ratio دیگر (یا از خروجی parseDecimal)
    return ratio(n.n, n.d);
  }
  const denInput = typeof d === "object" ? d.n / d.d : d;
  let num = typeof n === "bigint" ? n : BigInt(n);
  let den = typeof denInput === "bigint" ? denInput : BigInt(denInput);
  if (den === 0n) throw new Error("division-by-zero");
  if (den < 0n) {
    num = -num;
    den = -den;
  }
  const factor = gcd(num, den);
  return { n: num / factor, d: den / factor };
}

const add = (a: Ratio, b: Ratio): Ratio => ratio(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Ratio, b: Ratio): Ratio => ratio(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Ratio, b: Ratio): Ratio => ratio(a.n * b.n, a.d * b.d);
const div = (a: Ratio, b: Ratio): Ratio => {
  if (b.n === 0n) throw new Error("division-by-zero");
  return ratio(a.n * b.d, a.d * b.n);
};
const pow = (base: Ratio, exponent: number): Ratio => {
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 12) throw new Error("exponent-out-of-range");
  if (exponent === 0) return ratio(1n);
  if (exponent < 0) return div(ratio(1n), pow(base, -exponent));
  return ratio(base.n ** BigInt(exponent), base.d ** BigInt(exponent));
};

export function ratioToString(value: Ratio): string {
  return value.d === 1n ? value.n.toString() : `${value.n}/${value.d}`;
}

export function ratioToNumber(value: Ratio): number {
  if (value.d === 1n) return Number(value.n);
  const scaled = (value.n * 1_000_000_000n) / value.d;
  return Number(scaled) / 1_000_000_000;
}

/** گرد کردن «نیم به بالا» روی عدد گویا و بازگرداندن عدد صحیح BigInt. */
export function roundRatio(value: Ratio): bigint {
  const negative = value.n < 0n;
  const absN = negative ? -value.n : value.n;
  const quotient = absN / value.d;
  const remainder = absN % value.d;
  const rounded = remainder * 2n >= value.d ? quotient + 1n : quotient;
  return negative ? -rounded : rounded;
}

/** نمایش اعشاری با حداکثر رقم مشخص، کاملاً از روی BigInt (بدون float). */
export function formatRatio(value: Ratio, maxDigits = 4): string {
  if (value.d === 1n) return value.n.toString();
  const negative = value.n < 0n;
  const absN = negative ? -value.n : value.n;
  const whole = absN / value.d;
  const factor = 10n ** BigInt(maxDigits);
  const scaledNumerator = (absN % value.d) * factor;
  // رقم آخر با «نیم به بالا» گرد می‌شود تا نمایش با مقدار دقیق ناسازگار نباشد
  const fractionRaw = (scaledNumerator * 2n + value.d) / (value.d * 2n);
  const wholeAdjust = fractionRaw / factor;
  const fraction = fractionRaw % factor;
  if (wholeAdjust > 0n) return (negative ? "-" : "") + (whole + wholeAdjust).toString();
  let text = fraction.toString().padStart(maxDigits, "0").replace(/0+$/, "");
  if (text) text = `${whole}.${text}`;
  else text = whole.toString();
  return negative ? `-${text}` : text;
}

/* --------------------------- نرمال‌سازی ورودی --------------------------- */

const DIGIT_MAP: Record<string, string> = { "۰": "0", "۱": "1", "۲": "2", "۳": "3", "۴": "4", "۵": "5", "۶": "6", "۷": "7", "۸": "8", "۹": "9", "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9" };

const WORD_VALUES: Record<string, number> = {
  صفر: 0, یک: 1, دو: 2, سه: 3, چهار: 4, پنج: 5, شش: 6, هفت: 7, هشت: 8, نه: 9, ده: 10, یازده: 11, دوازده: 12,
  سیزده: 13, چهارده: 14, پانزده: 15, شانزده: 16, هفده: 17, هجده: 18, نوزده: 19, بیست: 20, سی: 30, چهل: 40,
  پنجاه: 50, شصت: 60, هفتاد: 70, هشتاد: 80, نود: 90, صد: 100, دویست: 200, سیصد: 300, چهارصد: 400, پانصد: 500, ششصد: 600, هفتصد: 700, هشتصد: 800, نهصد: 900,
};
const SCALE_VALUES: Record<string, number> = { هزار: 1000, میلیون: 1_000_000, میلیارد: 1_000_000_000, تریلیون: 1_000_000_000_000 };

const OPERATOR_WORDS: [RegExp, string][] = [
  [/ضرب\s*در|ضربدر|ضرب|×|x(?=\s|$)/g, "*"],
  [/تقسیم\s*بر|تقسیم|÷/g, "/"],
  [/به\s*علاوه|بعلاوه|به‌علاوه|جمع|مضاف/g, "+"],
  [/منهای|منها|کم\s*کن|تفریق|منه/g, "-"],
  [/به\s*توان|توان/g, "^"],
  [/درصد\s*از|درصد|٪|%/g, "%"],
];

/** تبدیل کلیدواژه‌های فارسی به عملگرهای ریاضی. */
export function normalizeMathText(input: string): string {
  let text = input.replace(/[۰-۹٠-٩]/g, (digit) => DIGIT_MAP[digit] ?? digit);
  text = text
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[٬,\u066c،]/g, (_match, offset: number, full: string) => {
      // جداکنندهٔ هزارگان فقط بین گروه‌های سه‌رقمی حذف می‌شود
      const before = full.slice(Math.max(0, offset - 1), offset);
      const after = full.slice(offset + 1, offset + 4);
      return /^\d$/.test(before) && /^\d{3}(?!\d)/.test(after) ? "" : ".";
    })
    .replace(/[«»"'`]/g, " ");
  for (const [pattern, replacement] of OPERATOR_WORDS) text = text.replace(pattern, replacement);
  return text.replace(/\s+/g, " ").trim();
}

/* ------------------------------ تحلیل‌گر ------------------------------ */

type Token = { kind: "num"; value: Ratio } | { kind: "op"; value: string } | { kind: "paren"; value: "(" | ")" };

const MAX_TOKENS = 120;
const MAX_LENGTH = 260;

function tokenize(text: string): Token[] | null {
  const tokens: Token[] = [];
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (char === " ") {
      index += 1;
      continue;
    }
    if (/[0-9]/.test(char) || (char === "." && /[0-9]/.test(text[index + 1] ?? ""))) {
      let raw = "";
      while (index < text.length && /[0-9.]/.test(text[index])) {
        raw += text[index];
        index += 1;
      }
      // اعشار یکتا: نقاط اضافی نادیده گرفته می‌شوند
      const parts = raw.split(".");
      const integer = parts.shift() ?? "0";
      const fraction = parts.join("").replace(/^0+$/, "");
      const value = ratio(BigInt(integer || "0") * 10n ** BigInt(fraction.length) + BigInt(fraction || "0"), 10n ** BigInt(fraction.length));
      tokens.push({ kind: "num", value });
      continue;
    }
    if ("+-*/^%".includes(char)) {
      tokens.push({ kind: "op", value: char });
      index += 1;
      continue;
    }
    if (char === "(" || char === ")") {
      tokens.push({ kind: "paren", value: char });
      index += 1;
      continue;
    }
    index += 1;
    if (tokens.length > MAX_TOKENS) return null;
  }
  return tokens;
}

/** عبارت‌های حرفی مثل «دو میلیون و پانصد هزار» را به رقم تبدیل می‌کند. */
export function verbalToDigits(input: string): string {
  const words = input.split(/\s+/);
  const out: string[] = [];
  let index = 0;
  while (index < words.length) {
    // «۱۲۰ میلیون»: مقیاس متعلق به رقم قبل است و نباید عدد جدید ساخته شود
    if (index > 0 && /^[0-9]+(?:\.[0-9]+)?$/.test(words[index - 1] ?? "")) {
      out.push(words[index]);
      index += 1;
      continue;
    }
    let total = 0;
    let current = 0;
    let seen = false;
    let cursor = index;
    while (cursor < words.length) {
      const word = words[cursor];
      if (word === "و") {
        cursor += 1;
        continue;
      }
      if (word in WORD_VALUES) {
        current += WORD_VALUES[word];
        seen = true;
        cursor += 1;
        continue;
      }
      if (word in SCALE_VALUES) {
        total += (seen && current !== 0 ? current : 1) * SCALE_VALUES[word];
        current = 0;
        seen = true;
        cursor += 1;
        continue;
      }
      break;
    }
    if (seen && cursor > index) {
      out.push(String(total + current));
      index = cursor;
      continue;
    }
    out.push(words[index]);
    index += 1;
  }
  return out.join(" ");
}

class Parser {
  private position = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Ratio {
    const value = this.expression();
    if (this.position !== this.tokens.length) throw new Error("trailing-tokens");
    return value;
  }

  private peek(): Token | undefined {
    return this.tokens[this.position];
  }

  private expression(): Ratio {
    let value = this.term();
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== "op" || (token.value !== "+" && token.value !== "-")) return value;
      this.position += 1;
      const right = this.term();
      value = token.value === "+" ? add(value, right) : sub(value, right);
    }
  }

  private term(): Ratio {
    let value = this.power();
    for (;;) {
      const token = this.peek();
      if (!token || token.kind !== "op" || (token.value !== "*" && token.value !== "/" && token.value !== "%")) return value;
      this.position += 1;
      const right = this.power();
      if (token.value === "*") value = mul(value, right);
      else if (token.value === "/") value = div(value, right);
      else value = div(mul(value, right), ratio(100n));
    }
  }

  private power(): Ratio {
    let value = this.unary();
    const token = this.peek();
    if (token && token.kind === "op" && token.value === "^") {
      this.position += 1;
      const exponentRatio = this.unary();
      if (exponentRatio.d !== 1n) throw new Error("fractional-exponent");
      value = pow(value, Number(exponentRatio.n));
    }
    return value;
  }

  private unary(): Ratio {
    const token = this.peek();
    if (token && token.kind === "op" && (token.value === "-" || token.value === "+")) {
      this.position += 1;
      const value = this.unary();
      return token.value === "-" ? ratio(-value.n, value.d) : value;
    }
    return this.atom();
  }

  private atom(): Ratio {
    const token = this.peek();
    if (!token) throw new Error("unexpected-end");
    if (token.kind === "num") {
      this.position += 1;
      return token.value;
    }
    if (token.kind === "paren" && token.value === "(") {
      this.position += 1;
      const value = this.expression();
      const close = this.peek();
      if (!close || close.kind !== "paren" || close.value !== ")") throw new Error("missing-paren");
      this.position += 1;
      return value;
    }
    throw new Error("unexpected-token");
  }
}

/* ------------------------- دامنه‌های تخصصی کشاورزی ------------------------- */

const UNIT_TO_KG: Record<string, Ratio> = {
  کیلوگرم: ratio(1n),
  کیلو: ratio(1n),
  گرم: ratio(1n, 1000n),
  تن: ratio(1000n),
  خروار: ratio(100n),
  من: ratio(3000n), // من تبریز ≈ ۳ کیلوگرم
};

const UNIT_TO_SQM: Record<string, Ratio> = {
  هکتار: ratio(10_000n),
  مترمربع: ratio(1n),
  متر: ratio(1n),
  جریب: ratio(10_000n),
};

export interface MathStep {
  title: string;
  detail: string;
}

export interface MathResult {
  kind: "arithmetic" | "percent" | "unit" | "share" | "area" | "profit" | "moisture" | "average";
  value: Ratio;
  display: string;
  persian: string;
  steps: MathStep[];
  confidence: number;
  warnings: string[];
}

/**
 * «۲۵ میلیون» و «۵۰۰ هزار» را به عدد کامل تبدیل می‌کند.
 * بدون این کار، عبارت «۵۰۰ هزار + ۲ میلیون» اشتباهی ۵۰۰+۲ حساب می‌شد.
 */
export function expandDigitScales(input: string): string {
  let text = input.replace(/[۰-۹٠-٩]/g, (digit) => DIGIT_MAP[digit] ?? digit);
  for (let pass = 0; pass < 3; pass += 1) {
    const next = text.replace(/([0-9]+(?:\.[0-9]+)?)\s*(تریلیون|میلیارد|میلیون|هزار)/g, (_match, digits: string, scale: string) => {
      const value = parseDecimal(digits);
      const factor = BigInt(SCALE_VALUES[scale] ?? 1);
      return (value.n * factor / value.d).toString();
    });
    if (next === text) break;
    text = next;
  }
  return text;
}

/** جداکنندهٔ هزارگان (فقط گروه‌های سه‌رقمی) */
export function collapseMathGrouping(input: string): string {
  const pattern = new RegExp(`([0-9]{1,3})((?:[٬,\\u066c،][0-9]{3})+)`, "g");
  return input.replace(pattern, (_match, head: string, groups: string) => head + groups.replace(/[٬,\u066c،]/g, ""));
}

/**
 * ترتیب قطعی آماده‌سازی: رقم‌ها → جداکننده → مقیاس واژه‌ای → عدد حرفی → عملگرها.
 * هر مرحله یک‌بار و بدون حدس اجرا می‌شود؛ همین ترتیب باعث می‌شود
 * «دو میلیون و پانصد هزار + ۵۰۰ هزار» دقیقاً 3,000,000 شود.
 */
export function prepareMathText(raw: string): string {
  let text = raw.replace(/[۰-۹٠-٩]/g, (digit) => DIGIT_MAP[digit] ?? digit);
  text = text.replace(/[يى]/g, "ی").replace(/ك/g, "ک");
  text = collapseMathGrouping(text);
  text = expandDigitScales(text);
  text = verbalToDigits(text);
  return normalizeMathText(text);
}

/** آیا جمله «قصد ریاضی» دارد؟ (گیت قبل از حل؛ بدون حدس) */
export function looksLikeMath(raw: string): boolean {
  const text = prepareMathText(raw);
  const hasNumber = /[0-9]/.test(text);
  if (!hasNumber) return false;
  const cues = /[+\-*/^%()]|درصد|کیلو|تن|هکتار|خروار|سهم|میانگین|سود|زیان|تخفیف|مالیات|رطوبت|مساحت/;
  if (!cues.test(text)) return false;
  return /[+\-*/^%]/.test(text) || /درصد|کیلو|تن|هکتار|خروار|سهم|میانگین|تخفیف|رطوبت|مساحت/.test(text);
}

function displayOf(value: Ratio, money: boolean): string {
  if (money) return roundRatio(value).toLocaleString("en-US");
  const formatted = formatRatio(value, 6);
  return /^-?\d+$/.test(formatted) ? Number(formatted).toLocaleString("en-US") : formatted;
}

function buildResult(kind: MathResult["kind"], value: Ratio, steps: MathStep[], options: { money?: boolean; warnings?: string[] } = {}): MathResult {
  const money = options.money ?? false;
  return {
    kind,
    value,
    display: displayOf(value, money),
    persian: "",
    steps,
    confidence: 0.99,
    warnings: options.warnings ?? [],
  };
}

const NUMBER_TOKEN = "([0-9]+(?:\\.[0-9]+)?)";

interface DomainHit {
  result: MathResult;
}

function domainSolvers(raw: string): DomainHit | null {
  const text = prepareMathText(raw);
  // جمله‌های ثبت خرید/فروش روزمره، مسئلهٔ ریاضی نیستند
  // جمله‌های ثبت روزمرهٔ دفتر، مسئلهٔ ریاضی نیستند (حتی اگر «ثبت کن» داشته باشند)
  const hasMathCue = /درصد|%|محاسبه|حساب کن|تقسیم|ضربدر|میانگین|تخفیف|مالیات|تبدیل کن|سهم هر نفر|افت رطوبت/.test(text);
  if (!hasMathCue && /خریدم|خرید کردم|فروختم|پرداخت کردم|ثبت کن/.test(text)) return null;

  // درصد از مبلغ: «۱۸ درصد از ۲۵,۰۰۰,۰۰۰»
  const percentMatch = new RegExp(`${NUMBER_TOKEN}\\s*(?:درصد|٪|%)\\s*(?:[^0-9]{0,18}?)?${NUMBER_TOKEN}`).exec(text);
  if (percentMatch) {
    const base = ratio(parseDecimal(percentMatch[2]));
    const percentValue = ratio(parseDecimal(percentMatch[1]));
    const value = div(mul(base, percentValue), ratio(100n));
    return {
      result: buildResult("percent", value, [
        { title: "درصد را به کسر تبدیل می‌کنیم", detail: `${percentMatch[1]}٪ = ${percentMatch[1]} ÷ ۱۰۰` },
        { title: "در مبلغ ضرب می‌کنیم", detail: `${percentMatch[2]} × ${percentMatch[1]} ÷ ۱۰۰` },
      ], { money: true }),
    };
  }

  // تخفیف/افزایش درصدی: «۲۵ میلیون با ۱۰ درصد تخفیف»
  const discountMatch = new RegExp(`${NUMBER_TOKEN}\\s*(?:تومان|تومن|ریال)?\\s*(?:با|منهای|کسر|به)?\\s*${NUMBER_TOKEN}\\s*(?:درصد|٪|%)\\s*(تخفیف|افزایش|سود|مالیات)`).exec(text);
  if (discountMatch) {
    const amount = ratio(parseDecimal(discountMatch[1]));
    const percentValue = ratio(parseDecimal(discountMatch[2]));
    const delta = div(mul(amount, percentValue), ratio(100n));
    const increase = /افزایش|سود/.test(discountMatch[3]);
    const value = increase ? add(amount, delta) : sub(amount, delta);
    return {
      result: buildResult("percent", value, [
        { title: `مبلغ ${discountMatch[3]}`, detail: `${discountMatch[1]} × ${discountMatch[2]}٪` },
        { title: "مبلغ نهایی", detail: increase ? `${discountMatch[1]} + سود` : `${discountMatch[1]} − تخفیف` },
      ], { money: true }),
    };
  }

  // تبدیل واحد: «۲ تن به کیلوگرم» یا «۵۰۰ کیلو چند تن»
  const unitMatch = new RegExp(`${NUMBER_TOKEN}\\s*(کیلوگرم|کیلو|تن|خروار|گرم)\\s*(?:به|چند|برابر)?\\s*(کیلوگرم|کیلو|تن|خروار|گرم)`).exec(text);
  if (unitMatch) {
    const from = /کیلو/.test(unitMatch[2]) ? "کیلوگرم" : unitMatch[2];
    const to = /کیلو/.test(unitMatch[3]) ? "کیلوگرم" : unitMatch[3];
    const value = div(mul(ratio(parseDecimal(unitMatch[1])), UNIT_TO_KG[from]), UNIT_TO_KG[to]);
    return {
      result: buildResult("unit", value, [
        { title: "به کیلوگرم", detail: `${unitMatch[1]} ${unitMatch[2]} = ${formatRatio(valueOfKg(unitMatch[1], unitMatch[2]), 4)} کیلوگرم` },
        { title: "به واحد خواسته‌شده", detail: `تقسیم بر ${unitMatch[3]} → ${formatRatio(value, 4)} ${unitMatch[3]}` },
      ]),
    };
  }

  // مساحت زمین: «۴۰ در ۶۰ متر» یا «هکتار ۲ در ۳»
  const areaMatch = new RegExp(`${NUMBER_TOKEN}\\s*(?:در|×|\\*|ضربدر)\\s*${NUMBER_TOKEN}\\s*(متر|مترمربع|هکتار)`).exec(text);
  if (areaMatch) {
    const a = ratio(parseDecimal(areaMatch[1]));
    const b = ratio(parseDecimal(areaMatch[2]));
    const sqm = mul(mul(a, b), UNIT_TO_SQM[areaMatch[3]] ?? ratio(1n));
    const hectare = div(sqm, UNIT_TO_SQM["هکتار"]);
    return {
      result: buildResult("area", sqm, [
        { title: "مساحت", detail: `${areaMatch[1]} × ${areaMatch[2]} = ${formatRatio(mul(a, b), 4)} ${areaMatch[3]}` },
        { title: "معادل هکتار", detail: `${formatRatio(sqm, 2)} ÷ ۱۰٬۰۰۰ = ${formatRatio(hectare, 4)} هکتار` },
      ]),
    };
  }

  // سهم شریک: «۱۲۰ میلیون بین ۳ نفر»
  const shareMatch = new RegExp(`${NUMBER_TOKEN}\\s*(?:تومان|تومن|ریال)?\\s*بین\\s*${NUMBER_TOKEN}\\s*(?:نفر|شریک|سهم|قسمت)`).exec(text);
  if (shareMatch) {
    const amount = ratio(parseDecimal(shareMatch[1]));
    const people = ratio(parseDecimal(shareMatch[2]));
    const value = div(amount, people);
    return {
      result: buildResult("share", value, [
        { title: "تقسیم مساوی", detail: `${shareMatch[1]} ÷ ${shareMatch[2]} = ${formatRatio(value, 6)}` },
      ], { money: true }),
    };
  }

  // افت رطوبت: «۱۰۰۰ کیلو رطوبت ۱۶ پایه ۱۴»
  const moistureMatch = new RegExp(`${NUMBER_TOKEN}\\s*(?:کیلوگرم|کیلو|تن)\\s*.*?رطوبت\\s*${NUMBER_TOKEN}\\s*.*?(?:پایه|پايه)\\s*${NUMBER_TOKEN}`).exec(text);
  if (moistureMatch) {
    const unit = /تن/.test(moistureMatch[0]) ? ratio(1000n) : ratio(1n);
    const netKg = mul(ratio(parseDecimal(moistureMatch[1])), unit);
    const measured = ratio(parseDecimal(moistureMatch[2]));
    const base = ratio(parseDecimal(moistureMatch[3]));
    const excess = sub(measured, base);
    if (excess.n <= 0n) {
      return {
        result: buildResult("moisture", ZERO, [
          { title: "افت رطوبت", detail: "رطوبت اندازه‌گیری‌شده از پایه بیشتر نیست؛ افت رطوبت صفر است." },
        ]),
      };
    }
    const percent = div(mul(excess, ratio(100n)), sub(ratio(100n), base));
    const deductionKg = div(mul(netKg, percent), ratio(100n));
    return {
      result: buildResult("moisture", deductionKg, [
        { title: "مازاد رطوبت", detail: `${moistureMatch[2]}٪ − ${moistureMatch[3]}٪ = ${formatRatio(excess, 4)}٪` },
        { title: "فرمول وزنی", detail: `(${formatRatio(excess, 4)} ÷ (۱۰۰ − ${moistureMatch[3]})) × ۱۰۰ = ${formatRatio(percent, 6)}٪` },
        { title: "افت به کیلوگرم", detail: `${formatRatio(netKg, 3)} × ${formatRatio(percent, 6)}٪ = ${formatRatio(deductionKg, 6)} کیلوگرم` },
      ]),
    };
  }

  // سود و حاشیه سود: «فروش ۱۲۰ میلیون هزینه ۹۰ میلیون»
  const profitMatch = new RegExp(`(?:فروش|درآمد|فروختم به)\\s*${NUMBER_TOKEN}\\s*.*?(?:هزینه|تمام شده|خرید)\\s*${NUMBER_TOKEN}`).exec(text);
  if (profitMatch) {
    const revenue = ratio(parseDecimal(profitMatch[1]));
    const cost = ratio(parseDecimal(profitMatch[2]));
    const profit = sub(revenue, cost);
    const margin = revenue.n === 0n ? ZERO : div(mul(profit, ratio(100n)), revenue);
    return {
      result: buildResult("profit", profit, [
        { title: "سود", detail: `${profitMatch[1]} − ${profitMatch[2]} = ${formatRatio(profit, 6)}` },
        { title: "حاشیهٔ سود", detail: `${formatRatio(profit, 6)} ÷ ${profitMatch[1]} × ۱۰۰ = ${formatRatio(margin, 4)}٪` },
      ], { money: true }),
    };
  }

  // میانگین: «میانگین ۱۰ و ۲۰ و ۳۰»
  if (/میانگین/.test(text)) {
    const numbers = [...text.matchAll(new RegExp(NUMBER_TOKEN, "g"))].map((match) => ratio(parseDecimal(match[1])));
    if (numbers.length >= 2) {
      const sum = numbers.reduce((acc, value) => add(acc, value), ZERO);
      const value = div(sum, ratio(BigInt(numbers.length)));
      return {
        result: buildResult("average", value, [
          { title: "جمع", detail: numbers.map((item) => formatRatio(item, 4)).join(" + ") },
          { title: "تقسیم بر تعداد", detail: `÷ ${numbers.length} = ${formatRatio(value, 6)}` },
        ]),
      };
    }
  }

  return null;
}

function parseDecimal(text: string): { n: bigint; d: bigint } {
  const [whole, fraction = ""] = text.split(".");
  return { n: BigInt((whole || "0") + fraction), d: 10n ** BigInt(fraction.length) };
}

function valueOfKg(amount: string, unit: string): Ratio {
  const normalizedUnit = /کیلو/.test(unit) ? "کیلوگرم" : unit;
  return mul(ratio(parseDecimal(amount)), UNIT_TO_KG[normalizedUnit] ?? ratio(1n));
}

/** حل قطعی عبارت/مسئلهٔ ریاضی. اگر مطمئن نبود null برمی‌گرداند. */
export function solveMath(raw: string): MathResult | null {
  if (!raw || raw.length > MAX_LENGTH) return null;
  try {
    // دامنه‌های تخصصی گیت سخت‌گیر خودشان را دارند؛ اول آن‌ها
    const domain = domainSolvers(raw);
    if (domain) return withPersian(domain.result);

    if (!looksLikeMath(raw)) return null;
    const expanded = prepareMathText(raw);
    // اگر مقیاس واژه‌ای باقی مانده بود، عدد کامل نیست و ریسک نتیجهٔ اشتباه داریم
    if (/میلیون|میلیارد|هزار|تریلیون/.test(expanded)) return null;
    let text = expanded.replace(/[^0-9+\-*/^%(). ]/g, " ").replace(/\s+/g, " ").trim();
    // عملگرهای ابتدای جمله از واژه‌هایی مثل «تقسیم بر کن» می‌آیند؛ فقط منفی ابتدایی معنا دارد
    text = text.replace(/^[*/^%+\s]+/, "").trim();
    if (!/[0-9]/.test(text) || !/[+\-*/^%]/.test(text)) return null;
    const tokens = tokenize(text);
    if (!tokens || !tokens.some((token) => token.kind === "op")) return null;
    const value = new Parser(tokens).parse();
    const steps: MathStep[] = [
      { title: "عبارت", detail: text.replace(/\s+/g, " ").trim() },
      { title: "نتیجهٔ دقیق (کسر)", detail: ratioToString(value) },
    ];
    if (value.d !== 1n) steps.push({ title: "نتیجهٔ اعشاری", detail: formatRatio(value, 6) });
    const money = /تومان|تومن|ریال/.test(raw) || Math.abs(ratioToNumber(value)) >= 100_000;
    return withPersian(buildResult("arithmetic", value, steps, { money, warnings: value.d !== 1n && money ? ["نتیجه به تومان صحیح گرد شد."] : [] }));
  } catch {
    // عبارت نامعتبر/تقسیم بر صفر → حدس نمی‌زنیم
    return null;
  }
}

function withPersian(result: MathResult): MathResult {
  if (result.value.d === 1n) {
    const numeric = Number(result.value.n);
    if (Number.isSafeInteger(numeric) && Math.abs(numeric) < 1_000_000_000_000_000) {
      result.persian = numberToPersianWords(numeric);
    }
  }
  return result;
}

/**
 * نسخهٔ قابل‌سریال‌سازی (JSON) از نتیجهٔ ریاضی.
 * JSON.stringify روی BigInt استثنا می‌دهد؛ این تابع مقدار گویا را به رشته
 * تبدیل می‌کند تا پاسخ API هرگز ۵۰۰ نشود.
 */
export interface SerializableMathResult extends Omit<MathResult, "value"> {
  value: { n: string; d: string; text: string };
}

export function serializeMathResult(result: MathResult): SerializableMathResult {
  return {
    ...result,
    value: { n: result.value.n.toString(), d: result.value.d.toString(), text: ratioToString(result.value) },
  };
}

export const MATH_ENGINE_VERSION = "1.0.0";
export const MATH_MAX_LENGTH = MAX_LENGTH;

/**
 * فروش ساده (ماشین‌حساب سریع فروش محصول)
 * ----------------------------------------
 * هدف: کاربر بدون عبور از فرم بلند «معامله محصول» بتواند در چند ثانیه
 * مقدار (کیلو یا تن) و قیمت هر کیلو را وارد کند و مبلغ نهایی را ببیند.
 * بخش «معامله محصول» حذف نمی‌شود؛ این فقط یک مسیر ساده و مکمل است.
 *
 * قاعده‌های ثابت پروژه:
 *  • همهٔ محاسبات روی کیلوگرم و با موتور قطعی همین فایل انجام می‌شود.
 *  • هیچ مبلغ یا نتیجه‌ای در کش/بستهٔ پاسخ ذخیره نمی‌گردد.
 *  • هر ورودی نامعتبر → خطا با پیام شفاف، بدون حدس.
 */
import { describeWeight, moneyWords, roundKg, toKg, toTon, validateWeight, type WeightDisplay, type WeightUnit } from "./units";
import { toPersianDigits } from "./format";

/** عدد تومان با ارقام فارسی و جداکنندهٔ هزارگان — یکدست با بقیهٔ برنامه. */
const fa = (value: number): string => toPersianDigits(Math.round(value).toLocaleString("en-US"));

export interface QuickSaleInput {
  product: string;
  buyer: string;
  unit: WeightUnit;
  quantity: number | null;
  pricePerKg: number | null;
  /** افت و کسورات وزنی به درصد (مثلاً رطوبت/ناخالصی) */
  deductionPct?: number | null;
  /** کرایهٔ حمل و هزینه‌های جانبی به تومان */
  transportToman?: number | null;
  /** مالیات/عوارض به درصد (پیش‌فرض صفر؛ محصول خام کشاورزی معمولاً معاف است) */
  taxPct?: number | null;
  /** پیش‌پرداخت/بیعانه به تومان */
  prepaidToman?: number | null;
}

export interface QuickSaleStep {
  title: string;
  detail: string;
}

export interface QuickSaleResult {
  ok: true;
  product: string;
  buyer: string;
  unit: WeightUnit;
  quantity: WeightDisplay;
  netWeight: WeightDisplay;
  deductionKg: number;
  pricePerKg: number;
  pricePerTon: number;
  grossToman: number;
  deductionToman: number;
  taxToman: number;
  transportToman: number;
  prepaidToman: number;
  payableToman: number;
  effectivePricePerKg: number;
  grossWords: string;
  payableWords: string;
  steps: QuickSaleStep[];
  warnings: string[];
}

export interface QuickSaleError {
  ok: false;
  errors: string[];
}

/**
 * سقف قیمت هر کیلو و سقف مبلغ قابل‌محاسبه.
 * باگ واقعی: ۱۰٬۰۰۰ تن × ۱ میلیارد تومان = ۱۰^۱۶ که از محدودهٔ عدد صحیح ایمن
 * جاوااسکریپت (۲^۵۳) بیرون است؛ نتیجه بی‌صدا نادقیق می‌شد و مبلغ به حروف هم
 * بی‌معنا («ده میلیون میلیارد تومان»). حالا خطای شفاف داده می‌شود.
 */
export const MAX_PRICE_PER_KG = 10_000_000_000;
export const MAX_SAFE_MONEY = Number.MAX_SAFE_INTEGER;

const safeNumber = (value: number | null | undefined): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return value;
};

const roundToman = (value: number): number => {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value + Number.EPSILON);
};

export function computeQuickSale(input: QuickSaleInput): QuickSaleResult | QuickSaleError {
  const errors: string[] = [];
  const warnings: string[] = [];

  const weightError = validateWeight(input.quantity, input.unit);
  if (weightError) errors.push(weightError);
  if (input.pricePerKg === null || !Number.isFinite(input.pricePerKg) || input.pricePerKg <= 0) {
    errors.push("قیمت هر کیلو را به تومان و بزرگ‌تر از صفر وارد کنید.");
  } else if (input.pricePerKg > MAX_PRICE_PER_KG) {
    errors.push(`قیمت هر کیلو بیش از سقف مجاز (${MAX_PRICE_PER_KG.toLocaleString("en-US")} تومان) است؛ قیمت را بررسی کنید.`);
  }
  const deductionPct = safeNumber(input.deductionPct);
  if (deductionPct < 0 || deductionPct >= 100) errors.push("درصد افت/کسورات باید بین ۰ و کمتر از ۱۰۰ باشد.");
  const taxPct = safeNumber(input.taxPct);
  if (taxPct < 0 || taxPct > 100) errors.push("درصد مالیات باید بین ۰ و ۱۰۰ باشد.");
  const transport = safeNumber(input.transportToman);
  const prepaid = safeNumber(input.prepaidToman);
  if (transport < 0 || prepaid < 0) errors.push("کرایهٔ حمل و پیش‌پرداخت نمی‌توانند منفی باشند.");
  if (input.product.trim().length < 2) errors.push("نام محصول را بنویسید (مثلاً تخم آفتابگردان).");
  if (errors.length) return { ok: false, errors };

  const quantityKg = roundKg(toKg(input.quantity as number, input.unit));
  const deductionKg = roundKg((quantityKg * deductionPct) / 100);
  const netKg = roundKg(quantityKg - deductionKg);
  const pricePerKg = Math.round(input.pricePerKg as number);
  const pricePerTon = Math.round(pricePerKg * 1000);

  const grossToman = roundToman(quantityKg * pricePerKg);
  const deductionToman = roundToman(deductionKg * pricePerKg);
  const netToman = roundToman(netKg * pricePerKg);
  const taxToman = roundToman((netToman * taxPct) / 100);
  const payableToman = roundToman(netToman + taxToman + transport - prepaid);

  // گارد دقت: هیچ مبلغی نباید از محدودهٔ عدد صحیح ایمن بیرون بزند
  const moneyValues = { grossToman, deductionToman, netToman, taxToman, payableToman };
  const unsafe = Object.entries(moneyValues).find(([, value]) => !Number.isSafeInteger(value));
  if (unsafe) {
    return {
      ok: false,
      errors: [
        `مبلغ محاسبه‌شده از محدودهٔ دقیق (${MAX_SAFE_MONEY.toLocaleString("en-US")} تومان) فراتر رفت (${unsafe[0]}). مقدار وزن یا قیمت را کوچک‌تر کنید.`,
      ],
    };
  }

  if (prepaid > netToman + taxToman + transport) {
    warnings.push("پیش‌پرداخت از مبلغ قابل پرداخت بیشتر است؛ مانده منفی یعنی فروشنده باید مابه‌التفاوت را برگرداند.");
  }
  if (deductionPct > 20) warnings.push("افت بیش از ۲۰٪ غیرمعمول است؛ مقدار رطوبت/ناخالصی را دوباره بررسی کنید.");
  if (payableToman < 0) warnings.push("مبلغ نهایی منفی است؛ پیش‌پرداخت و هزینه‌ها را بازبینی کنید.");

  const quantity = describeWeight(quantityKg);
  const netWeight = describeWeight(netKg);
  // قیمت مؤثر = (مبلغ خالص + مالیات + حمل) ÷ وزن خالص؛ پیش‌پرداخت سهم پرداخت است
  // و نباید قیمت هر کیلو را کم کند (باگ قبلی: payable/netKg پیش‌پرداخت را کم می‌کرد).
  const effectivePricePerKg = netKg > 0 ? roundToman((netToman + taxToman + transport) / netKg) : 0;

  const steps: QuickSaleStep[] = [
    { title: "وزن به کیلوگرم", detail: `${quantity.kgLabel}${input.unit === "ton" ? ` (ورودی: ${toTon(quantityKg)} تن)` : ""}` },
    { title: "افت و کسورات", detail: `${toPersianDigits(deductionPct)}٪ = ${toPersianDigits(deductionKg.toLocaleString("en-US"))} کیلوگرم؛ وزن خالص ${netWeight.kgLabel}` },
    { title: "مبلغ ناخالص", detail: `${quantity.kgLabel} × ${fa(pricePerKg)} تومان = ${fa(grossToman)} تومان` },
    { title: "کسر افت", detail: `− ${fa(deductionToman)} تومان` },
  ];
  if (taxToman) steps.push({ title: "مالیات/عوارض", detail: `${toPersianDigits(taxPct)}٪ = ${fa(taxToman)} تومان (محصول خام کشاورزی معمولاً معاف است)` });
  if (transport) steps.push({ title: "کرایهٔ حمل و هزینه‌ها", detail: `+ ${fa(transport)} تومان` });
  if (prepaid) steps.push({ title: "پیش‌پرداخت", detail: `− ${fa(prepaid)} تومان` });
  steps.push({ title: "مبلغ قابل پرداخت", detail: `${fa(payableToman)} تومان = ${moneyWords(payableToman)}` });

  return {
    ok: true,
    product: input.product.trim(),
    buyer: input.buyer.trim(),
    unit: input.unit,
    quantity,
    netWeight,
    deductionKg,
    pricePerKg,
    pricePerTon,
    grossToman,
    deductionToman,
    taxToman,
    transportToman: Math.round(transport),
    prepaidToman: Math.round(prepaid),
    payableToman,
    effectivePricePerKg,
    grossWords: moneyWords(grossToman),
    payableWords: moneyWords(payableToman),
    steps,
    warnings,
  };
}

/** متن قابل کپی/چاپ از نتیجه؛ هم کیلو و هم تن، هم رقم و هم حروف. */
export function quickSaleSummary(result: QuickSaleResult): string {
  const lines = [
    `فروش ${result.product}${result.buyer ? ` به ${result.buyer}` : ""}`,
    `مقدار: ${result.quantity.both} — ${result.quantity.bothWords}`,
    `وزن خالص پس از کسورات: ${result.netWeight.both} — ${result.netWeight.bothWords}`,
    `قیمت هر کیلو: ${fa(result.pricePerKg)} تومان · هر تن: ${fa(result.pricePerTon)} تومان`,
    `مبلغ ناخالص: ${fa(result.grossToman)} تومان (${result.grossWords})`,
    `کسورات: ${fa(result.deductionToman)} تومان · مالیات: ${fa(result.taxToman)} تومان · حمل: ${fa(result.transportToman)} تومان`,
    `مبلغ قابل پرداخت: ${fa(result.payableToman)} تومان (${result.payableWords})`,
    `قیمت مؤثر هر کیلو: ${fa(result.effectivePricePerKg)} تومان`,
  ];
  return lines.join("\n");
}

export const QUICK_SALE_PRODUCTS = [
  "تخم آفتابگردان",
  "گندم",
  "جو",
  "ذرت",
  "کلزا",
  "کنجد",
  "پنبه",
  "چغندرقند",
  "سیب‌زمینی",
  "پیاز",
  "زعفران",
  "پسته",
];

export const QUICK_SALE_VERSION = "1.0.0";

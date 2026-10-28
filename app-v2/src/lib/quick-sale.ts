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
    { title: "افت و کسورات", detail: `${deductionPct}٪ = ${deductionKg.toLocaleString("en-US")} کیلوگرم؛ وزن خالص ${netWeight.kgLabel}` },
    { title: "مبلغ ناخالص", detail: `${quantity.kgLabel} × ${pricePerKg.toLocaleString("en-US")} تومان = ${grossToman.toLocaleString("en-US")} تومان` },
    { title: "کسر افت", detail: `− ${deductionToman.toLocaleString("en-US")} تومان` },
  ];
  if (taxToman) steps.push({ title: "مالیات/عوارض", detail: `${taxPct}٪ = ${taxToman.toLocaleString("en-US")} تومان (محصول خام کشاورزی معمولاً معاف است)` });
  if (transport) steps.push({ title: "کرایهٔ حمل و هزینه‌ها", detail: `+ ${transport.toLocaleString("en-US")} تومان` });
  if (prepaid) steps.push({ title: "پیش‌پرداخت", detail: `− ${prepaid.toLocaleString("en-US")} تومان` });
  steps.push({ title: "مبلغ قابل پرداخت", detail: `${payableToman.toLocaleString("en-US")} تومان = ${moneyWords(payableToman)}` });

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
    `قیمت هر کیلو: ${result.pricePerKg.toLocaleString("en-US")} تومان · هر تن: ${result.pricePerTon.toLocaleString("en-US")} تومان`,
    `مبلغ ناخالص: ${result.grossToman.toLocaleString("en-US")} تومان (${result.grossWords})`,
    `کسورات: ${result.deductionToman.toLocaleString("en-US")} تومان · مالیات: ${result.taxToman.toLocaleString("en-US")} تومان · حمل: ${result.transportToman.toLocaleString("en-US")} تومان`,
    `مبلغ قابل پرداخت: ${result.payableToman.toLocaleString("en-US")} تومان (${result.payableWords})`,
    `قیمت مؤثر هر کیلو: ${result.effectivePricePerKg.toLocaleString("en-US")} تومان`,
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

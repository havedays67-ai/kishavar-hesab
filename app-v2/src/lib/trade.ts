import type { JDate } from "./format";
import { PRODUCTS } from "./products";


/**
 * پروفایل هر محصول: برای چهار محصول مرجع، پروفایل کامل؛ برای بقیهٔ محصولات
 * کاتالوگ یا نام دلخواه کاربر، پروفایل «بدون استاندارد اختصاصی».
 *
 * قاعدهٔ صداقت: هیچ نرخ یا افت مرجعی برای محصولی که استانداردش را نداریم
 * اختراع نمی‌شود. رطوبت پایه ۱۴٪ فقط برای شروع محاسبه است و در هشدارها
 * صریحاً گفته می‌شود که باید با قرارداد خریدار تطبیق داده شود، نرخ پیش‌فرض
 * صفر است و کاربر باید نرخ توافقی را وارد کند.
 */
export function getProductProfile(productId: string | null | undefined): ProductProfile {
  const id = (productId ?? "").trim();
  const known = PRODUCT_PROFILES[id];
  if (known) return known;
  const catalog = PRODUCTS.find((item) => item.name === id);
  // باگ: رشتهٔ خالی از ?? رد نمی‌شد و نام محصول خالی می‌ماند (پیش از انتخاب کاربر)
  const name = catalog?.name || id || "محصول";
  return {
    id,
    name,
    short: name.length > 10 ? `${name.slice(0, 10)}…` : name,
    hasReferenceStandard: false,
    baseMoisture: 14,
    maxMoisture: 20,
    baseUsefulLoss: 3,
    baseNonUsefulLoss: 1,
    maxNonUsefulLoss: 7,
    basePrice: 0,
    priceYear: "نرخ توافقی شما",
    grading: "defect",
    priceIsReference: false,
    vatExempt: true,
    note: "برای این محصول استاندارد اختصاصی در برنامه ثبت نشده است؛ رطوبت پایه، سقف افت و نرخ توافقی را با قرارداد خریدار تطبیق دهید.",
    source: "ورودی کاربر / کاتالوگ محصولات — بدون استاندارد مرجع داخلی",
  };
}

export interface TradeProductOption {
  id: string;
  name: string;
  hasReferenceStandard: boolean;
  baseMoisture: number;
}

/** فهرست محصولات قابل انتخاب در معامله: چهار مرجع + بقیهٔ کاتالوگ. */
export function getTradeProductOptions(): TradeProductOption[] {
  const reference = Object.values(PRODUCT_PROFILES).map((profile) => ({
    id: profile.id,
    name: profile.name,
    hasReferenceStandard: true,
    baseMoisture: profile.baseMoisture,
  }));
  const referenceNames = new Set(reference.map((item) => item.name));
  const catalog = PRODUCTS.filter((item) => !referenceNames.has(item.name)).map((item) => ({
    id: item.name,
    name: item.name,
    hasReferenceStandard: false,
    baseMoisture: 14,
  }));
  return [...reference, ...catalog];
}

/* ---------------------------------------------------------------------------
 * موتور قطعی معامله محصول کشاورزی (Crop Trade Engine v1.0)
 * هیچ محاسبه‌ی مالی در لایه UI انجام نمی‌شود. همه اعداد از این فایل می‌آید.
 * ترتیب قطعی محاسبه:
 *   وزن خالص ← افت رطوبت ← افت مفید ← افت غیرمفید ← درجه‌بندی ← قیمت پایه
 *   ← ارزش محصول ← هزینه‌های فروشنده ← مالیات ← خالص دریافتی
 * ------------------------------------------------------------------------- */

/**
 * شناسهٔ محصول.
 * چهار محصول «گندم/جو/کلزا/ذرت» پروفایل کامل و مرجع دارند؛ بقیهٔ محصولات کاتالوگ
 * یا نام دلخواه کاربر با `getProductProfile` پروفایل محافظه‌کارانه می‌گیرند تا
 * هیچ استانداردی از خودمان ساخته نشود.
 */
export type ProductId = string;
export type GradeId = 0 | 1 | 2 | 3;
export type TradeStatus = "draft" | "confirmed" | "settled";
export type PaymentMethod = "cash" | "bank" | "cheque" | "offset";

export interface ProductProfile {
  id: ProductId;
  /** آیا استاندارد/نرخ مرجع اختصاصی برای این محصول ثبت شده است؟ */
  hasReferenceStandard: boolean;
  name: string;
  short: string;
  baseMoisture: number;
  maxMoisture: number;
  baseUsefulLoss: number;
  baseNonUsefulLoss: number;
  maxNonUsefulLoss: number;
  basePrice: number;
  priceYear: string;
  grading: "wheat" | "defect";
  priceIsReference: boolean;
  vatExempt: boolean;
  note: string;
  source: string;
}

export const PRODUCT_PROFILES: Record<string, ProductProfile> = {
  wheat: {
    id: "wheat",
    hasReferenceStandard: true,
    name: "گندم",
    short: "گندم",
    baseMoisture: 14,
    maxMoisture: 14,
    baseUsefulLoss: 3,
    baseNonUsefulLoss: 1,
    maxNonUsefulLoss: 7,
    basePrice: 49500,
    priceYear: "۱۴۰۴–۱۴۰۵ — آخرین مصوبه",
    grading: "wheat",
    priceIsReference: true,
    vatExempt: true,
    note: "آخرین نرخ مصوب خرید تضمینی با افت ۳٪ مفید و ۱٪ غیرمفید؛ نرخ فصل جاری و پیشنهاد کارخانه/سیلو باید جایگزین شود.",
    source: "مصوبه شورای قیمت‌گذاری ۱۴۰۴–۱۴۰۵ و آیین‌نامه بند (ب) تبصره (۱۳) قانون بودجه ۱۴۰۴؛ نرخ فصل جاری نیازمند ابلاغیه روز است.",
  },
  barley: {
    id: "barley",
    hasReferenceStandard: true,
    name: "جو",
    short: "جو",
    baseMoisture: 12.5,
    maxMoisture: 14,
    baseUsefulLoss: 3,
    baseNonUsefulLoss: 2,
    maxNonUsefulLoss: 7,
    basePrice: 17000,
    priceYear: "نیازمند نرخ قرارداد",
    grading: "defect",
    priceIsReference: true,
    vatExempt: true,
    note: "نرخ و شرایط افت جو در قراردادهای کارخانه متفاوت است؛ نرخ پیش‌فرض فقط برای شروع محاسبه است.",
    source: "استاندارد ملی غلات و رویه رایج خرید جو؛ نیازمند تطبیق با قرارداد خریدار",
  },
  canola: {
    id: "canola",
    hasReferenceStandard: true,
    name: "کلزا",
    short: "کلزا",
    baseMoisture: 8,
    maxMoisture: 10,
    baseUsefulLoss: 2,
    baseNonUsefulLoss: 2,
    maxNonUsefulLoss: 5,
    basePrice: 55000,
    priceYear: "نیازمند نرخ قرارداد",
    grading: "defect",
    priceIsReference: true,
    vatExempt: true,
    note: "حد رطوبت و ناخالصی کلزا را از قرارداد خریدار بگیرید؛ نرخ پیش‌فرض مرجع نیست.",
    source: "رویه خرید دانه روغنی و استانداردهای کیفی؛ نیازمند تطبیق با قرارداد",
  },
  corn: {
    id: "corn",
    hasReferenceStandard: true,
    name: "ذرت دانه‌ای",
    short: "ذرت",
    baseMoisture: 14,
    maxMoisture: 15,
    baseUsefulLoss: 2,
    baseNonUsefulLoss: 2,
    maxNonUsefulLoss: 7,
    basePrice: 20000,
    priceYear: "نیازمند نرخ قرارداد",
    grading: "defect",
    priceIsReference: true,
    vatExempt: true,
    note: "نرخ و افت ذرت را با خریدار تطبیق دهید؛ نرخ پیش‌فرض صرفاً نمونه است.",
    source: "استانداردهای کیفی ذرت و رویه خرید کارخانه؛ نیازمند تطبیق با قرارداد",
  },
};

export interface QualityInput {
  grossKg: number;
  tareKg: number;
  moisture: number;
  usefulLossPercent: number;
  nonUsefulLossPercent: number;
  impurity: number;
  sprouted: number;
  broken: number;
  hectoliter: number;
  protein: number;
}

export interface CostInput {
  transport: number;
  loading: number;
  commissionRate: number;
  insurance: number;
  delayPenalty: number;
  other: number;
}

export interface TradeCalculationInput {
  productId: ProductId;
  quality: QualityInput;
  unitPrice: number;
  costs: CostInput;
  taxExempt: boolean;
  taxRate: number;
}

export interface CostBreakdown {
  transport: number;
  loading: number;
  commissionRate: number;
  commission: number;
  insurance: number;
  delayPenalty: number;
  other: number;
  total: number;
}

export interface QualityMetric {
  label: string;
  value: string;
  limit: string;
  status: "good" | "warn" | "bad";
}

export interface QualityAssessment {
  grade: GradeId;
  label: string;
  factor: number;
  limitingFactor: string;
  metrics: QualityMetric[];
}

export interface CalcStep {
  key: string;
  title: string;
  formula: string;
  effectKg?: number;
  effectToman?: number;
  tone: "neutral" | "good" | "warn" | "bad";
  note?: string;
}

export interface TradeWarning {
  code: string;
  severity: "info" | "warning" | "danger";
  title: string;
  detail: string;
}

export interface TradeResult {
  engineVersion: string;
  netKg: number;
  moistureLossKg: number;
  moistureLossPercent: number;
  afterMoistureKg: number;
  usefulLossKg: number;
  nonUsefulLossKg: number;
  payableKg: number;
  payableRatio: number;
  quality: QualityAssessment;
  adjustedUnitPrice: number;
  grossValue: number;
  gradeAdjustmentValue: number;
  costs: CostBreakdown;
  taxableValue: number;
  tax: number;
  invoiceTotal: number;
  netReceipt: number;
  effectivePricePerKg: number;
  warnings: TradeWarning[];
  steps: CalcStep[];
}

export const GRADE_LABELS: Record<GradeId, string> = {
  0: "خارج از درجه",
  1: "درجه یک",
  2: "درجه دو",
  3: "درجه سه",
};

const GRADE_FACTORS: Record<GradeId, number> = { 0: 0.88, 1: 1, 2: 0.98, 3: 0.96 };

const roundKg = (value: number) => Math.round(value * 100) / 100;
const roundToman = (value: number) => Math.round(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));

export function emptyQuality(): QualityInput {
  return {
    grossKg: 0,
    tareKg: 0,
    moisture: 0,
    usefulLossPercent: 3,
    nonUsefulLossPercent: 1,
    impurity: 0,
    sprouted: 0,
    broken: 0,
    hectoliter: 0,
    protein: 0,
  };
}

export function emptyCosts(): CostInput {
  return { transport: 0, loading: 0, commissionRate: 0.5, insurance: 0, delayPenalty: 0, other: 0 };
}

function metricStatus(pass1: boolean, pass2: boolean, pass3: boolean): "good" | "warn" | "bad" {
  if (pass1) return "good";
  if (pass2 || pass3) return "warn";
  return "bad";
}

/**
 * درجه‌بندی عملیاتی با قاعده «ضعیف‌ترین شاخص تعیین‌کننده است»؛ ضرایب مدل داخلی‌اند
 * و باید با جدول پاکی/قرارداد خریدار تطبیق داده شوند.
 * گندم: هکتولیتر، پروتئین، سن‌زدگی و دانه شکسته.
 * سایر محصولات: ناخالصی، سن‌زدگی و دانه شکسته.
 */
export function assessQuality(productId: ProductId, q: QualityInput): QualityAssessment {
  const product = getProductProfile(productId);
  const metrics: QualityMetric[] = [];
  let grade: GradeId = 1;
  let limitingFactor = "هیچ شاخصی از حدود درجه یک فراتر نرفته است.";

  const check = (
    label: string,
    value: number,
    limits: [number, number, number],
    unit: string,
    higherIsBetter: boolean,
  ) => {
    const pass = (limit: number) => (higherIsBetter ? value >= limit : value <= limit);
    if (!pass(limits[0]) && grade === 1) {
      grade = 2;
      limitingFactor = `${label} از حد درجه یک عبور کرده است.`;
    }
    if (!pass(limits[1]) && grade === 2) {
      grade = 3;
      limitingFactor = `${label} از حد درجه دو نیز عبور کرده است.`;
    }
    if (!pass(limits[2]) && grade === 3) {
      grade = 0;
      limitingFactor = `${label} از حد درجه سه نیز عبور کرده است.`;
    }
    metrics.push({
      label,
      value: `${roundKg(value)}${unit}`,
      limit:
        product.grading === "wheat"
          ? `${limits[0]} / ${limits[1]} / ${limits[2]}${unit}`
          : `${limits[0]}${unit} (درجه یک)`,
      status: metricStatus(pass(limits[0]), pass(limits[1]), pass(limits[2])),
    });
  };

  if (product.grading === "wheat") {
    check("وزن هکتولیتر", q.hectoliter, [78, 75, 72], " kg/hl", true);
    check("پروتئین", q.protein, [12.5, 11.5, 10.5], "٪", true);
    check("سن‌زدگی", q.sprouted, [0.5, 1.5, 3], "٪", false);
    check("دانه شکسته", q.broken, [2, 5, 8], "٪", false);
  } else {
    check("ناخالصی", q.impurity, [1, 2.5, 4], "٪", false);
    check("سن‌زدگی / جوانه‌زنی", q.sprouted, [0.5, 1.5, 3], "٪", false);
    check("دانه شکسته", q.broken, [2, 5, 8], "٪", false);
  }

  // شاخص تعیین‌کننده = شاخصی که بدترین وضعیت را دارد
  const worst = metrics.find((metric) => metric.status === "bad") ?? metrics.find((metric) => metric.status === "warn");
  if (worst && grade > 1) limitingFactor = `تعیین‌کننده: ${worst.label} با مقدار ${worst.value}.`;
  if (worst && grade === 1) limitingFactor = "همه شاخص‌ها در محدوده درجه یک هستند.";

  return {
    grade,
    label: GRADE_LABELS[grade],
    factor: GRADE_FACTORS[grade],
    limitingFactor,
    metrics,
  };
}

export function calculateTrade(input: TradeCalculationInput): TradeResult {
  const product = getProductProfile(input.productId);
  const q = input.quality;
  const warnings: TradeWarning[] = [];

  const gross = Math.max(0, q.grossKg);
  const tare = Math.max(0, q.tareKg);
  const netKg = Math.max(0, roundKg(gross - tare));

  if (gross <= 0) warnings.push({ code: "no-gross", severity: "danger", title: "وزن پر ثبت نشده است", detail: "وزن کامیون پر (باسکول اول) را وارد کنید." });
  if (tare <= 0) warnings.push({ code: "no-tare", severity: "warning", title: "وزن خالی ثبت نشده است", detail: "برای محاسبه وزن خالص، وزن خودروی خالی لازم است." });
  if (tare >= gross && gross > 0) warnings.push({ code: "bad-weights", severity: "danger", title: "وزن خالی از وزن پر بیشتر است", detail: "اعداد باسکول را دوباره کنترل کنید." });
  if (q.moisture > product.maxMoisture) warnings.push({ code: "moisture-limit", severity: "danger", title: "رطوبت بالاتر از حد پذیرش", detail: `حداکثر رطوبت ${product.maxMoisture}٪ است؛ مرکز خرید می‌تواند محموله را رد کند یا هزینه خشک‌کردن دریافت کند.` });
  if (q.impurity > product.maxNonUsefulLoss) warnings.push({ code: "impurity-limit", severity: "danger", title: "ناخالصی بیش از سقف افت غیرمفید", detail: `سقف قابل قبول ${product.maxNonUsefulLoss}٪ است.` });
  if (q.sprouted > 3) warnings.push({ code: "sprouted", severity: "warning", title: "سن‌زدگی بالا", detail: "محموله در معرض کسر قیمت یا رد شدن قرار دارد." });
  if (q.broken > 8) warnings.push({ code: "broken", severity: "warning", title: "دانه شکسته زیاد", detail: "افت مفید و درجه کیفی را با کارشناس خریدار تطبیق دهید." });
  if (input.unitPrice <= 0) warnings.push({ code: "no-price", severity: "danger", title: "قیمت هر کیلو تعیین نشده", detail: "قیمت توافقی یا نرخ روز مرکز خرید را وارد کنید." });
  if (!product.hasReferenceStandard) warnings.push({ code: "custom-product", severity: "info", title: "محصول بدون استاندارد مرجع", detail: "برای این محصول، رطوبت پایه ۱۴٪ و افت‌های پیش‌فرض فقط نقطهٔ شروع است؛ مقادیر قرارداد خریدار را وارد کنید." });
  if (product.priceIsReference) warnings.push({ code: "reference-price", severity: "info", title: "نرخ مرجع، جایگزین قرارداد نیست", detail: `نرخ پیش‌فرض (${product.priceYear}) فقط مرجع است؛ نرخ ابلاغی روز و شرایط خریدار را بررسی کنید.` });

  const moistureExcess = Math.max(0, q.moisture - product.baseMoisture);
  const moistureLossKg = roundKg(netKg * (moistureExcess / (100 - product.baseMoisture)));
  const afterMoistureKg = Math.max(0, roundKg(netKg - moistureLossKg));

  const usefulPercent = Math.max(product.baseUsefulLoss, q.usefulLossPercent);
  const nonUsefulPercent = Math.max(product.baseNonUsefulLoss, q.nonUsefulLossPercent, q.impurity);
  const usefulLossKg = roundKg(afterMoistureKg * (usefulPercent / 100));
  const nonUsefulLossKg = roundKg(afterMoistureKg * (nonUsefulPercent / 100));
  const payableKg = Math.max(0, roundKg(afterMoistureKg - usefulLossKg - nonUsefulLossKg));

  const quality = assessQuality(input.productId, q);
  const adjustedUnitPrice = roundToman(input.unitPrice * quality.factor);
  const grossValue = roundToman(payableKg * adjustedUnitPrice);
  const gradeAdjustmentValue = roundToman(payableKg * (input.unitPrice - adjustedUnitPrice));

  const commission = roundToman(grossValue * (clamp(input.costs.commissionRate, 0, 10) / 100));
  const costs: CostBreakdown = {
    transport: roundToman(Math.max(0, input.costs.transport)),
    loading: roundToman(Math.max(0, input.costs.loading)),
    commissionRate: clamp(input.costs.commissionRate, 0, 10),
    commission,
    insurance: roundToman(Math.max(0, input.costs.insurance)),
    delayPenalty: roundToman(Math.max(0, input.costs.delayPenalty)),
    other: roundToman(Math.max(0, input.costs.other)),
    total: 0,
  };
  costs.total = roundToman(costs.transport + costs.loading + costs.commission + costs.insurance + costs.delayPenalty + costs.other);

  const tax = input.taxExempt ? 0 : roundToman(grossValue * (clamp(input.taxRate, 0, 30) / 100));
  const invoiceTotal = roundToman(grossValue + tax);
  const netReceipt = roundToman(invoiceTotal - costs.total);
  const effectivePricePerKg = payableKg > 0 ? roundToman(netReceipt / payableKg) : 0;

  if (costs.total > grossValue * 0.25 && grossValue > 0) {
    warnings.push({ code: "high-costs", severity: "warning", title: "هزینه‌های فروشنده بیش از ۲۵٪ ارزش محصول", detail: "کرایه، تخلیه و کارمزد را دوباره بررسی کنید." });
  }
  if (payableKg < netKg * 0.75 && netKg > 0) {
    warnings.push({ code: "heavy-deduction", severity: "warning", title: "کسورات بیش از ۲۵٪ وزن خالص", detail: "افت‌ها را با برگه آزمایشگاه و دستورالعمل مرکز خرید تطبیق دهید." });
  }
  if (netReceipt < 0) {
    warnings.push({ code: "negative-receipt", severity: "danger", title: "خالص دریافتی منفی است", detail: "هزینه‌ها از ارزش محصول بیشتر شده‌اند." });
  }

  const steps: CalcStep[] = [
    {
      key: "net-weight",
      title: "وزن خالص (باسکول)",
      formula: "وزن پر − وزن خالی = وزن خالص",
      effectKg: netKg,
      tone: netKg > 0 ? "good" : "bad",
    },
    {
      key: "moisture",
      title: "افت رطوبت",
      formula: moistureExcess > 0
        ? `(${roundKg(q.moisture)} − ${product.baseMoisture}) ÷ (۱۰۰ − ${product.baseMoisture}) × ${roundKg(afterMoistureKg + moistureLossKg)}`
        : `رطوبت ${roundKg(q.moisture)}٪ از پایه ${product.baseMoisture}٪ بیشتر نیست → بدون افت`,
      effectKg: -moistureLossKg,
      effectToman: -roundToman(moistureLossKg * adjustedUnitPrice),
      tone: moistureLossKg > 0 ? "warn" : "good",
      note: moistureExcess > 0 ? "فرمول وزنی استاندارد؛ آب اضافه از وزن قابل پرداخت کسر می‌شود." : undefined,
    },
    {
      key: "useful-loss",
      title: "افت مفید",
      formula: `${roundKg(afterMoistureKg)} × ${usefulPercent}٪`,
      effectKg: -usefulLossKg,
      effectToman: -roundToman(usefulLossKg * adjustedUnitPrice),
      tone: "warn",
      note: "شامل دانه شکسته، جوانه‌زده و موارد قابل مصرف؛ پایه قرارداد.",
    },
    {
      key: "non-useful-loss",
      title: "افت غیرمفید",
      formula: `${roundKg(afterMoistureKg)} × ${nonUsefulPercent}٪`,
      effectKg: -nonUsefulLossKg,
      effectToman: -roundToman(nonUsefulLossKg * adjustedUnitPrice),
      tone: "warn",
      note: "شامل ناخالصی، سنگ، کاه، بذر علف هرز و مواد غیرقابل مصرف.",
    },
    {
      key: "quality",
      title: `درجه‌بندی کیفی — ${quality.label}`,
      formula: `قیمت پایه ${input.unitPrice} × ضریب ${quality.factor} = ${adjustedUnitPrice} تومان`,
      effectToman: -gradeAdjustmentValue,
      tone: quality.grade === 0 ? "bad" : quality.grade === 1 ? "good" : "warn",
      note: quality.limitingFactor,
    },
    {
      key: "costs",
      title: "هزینه‌های فروشنده",
      formula: `${costs.transport} + ${costs.loading} + ${costs.commission} + ${costs.insurance} + ${costs.delayPenalty} + ${costs.other}`,
      effectToman: -costs.total,
      tone: costs.total > 0 ? "warn" : "neutral",
      note: "کرایه حمل، تخلیه، کارمزد/دلالی، بیمه، جریمه تأخیر و سایر.",
    },
  ];

  if (tax > 0) {
    steps.push({
      key: "tax",
      title: "مالیات و عوارض",
      formula: `${grossValue} × ${clamp(input.taxRate, 0, 30)}٪`,
      effectToman: tax,
      tone: "neutral",
      note: "برای محصول کشاورزی فرآوری‌نشده معمولاً معاف است؛ وضعیت را با قرارداد تطبیق دهید.",
    });
  }

  return {
    engineVersion: "trade-engine-1.0.0",
    netKg,
    moistureLossKg,
    moistureLossPercent: q.moisture > 0 ? roundKg(moistureExcess) : 0,
    afterMoistureKg,
    usefulLossKg,
    nonUsefulLossKg,
    payableKg,
    payableRatio: netKg > 0 ? Math.round((payableKg / netKg) * 1000) / 10 : 0,
    quality,
    adjustedUnitPrice,
    grossValue,
    gradeAdjustmentValue,
    costs,
    taxableValue: grossValue,
    tax,
    invoiceTotal,
    netReceipt,
    effectivePricePerKg,
    warnings,
    steps,
  };
}

export interface CropTrade {
  id: string;
  serial: string;
  productId: ProductId;
  date: JDate;
  createdAt: JDate;
  sellerName: string;
  sellerNationalId: string;
  sellerPhone: string;
  buyerName: string;
  buyerNationalId: string;
  buyerAddress: string;
  buyerType: string;
  farmTitle: string;
  vehiclePlate: string;
  driverName: string;
  driverPhone: string;
  weighbridgeNo: string;
  quality: QualityInput;
  unitPrice: number;
  costs: CostInput;
  taxExempt: boolean;
  taxRate: number;
  paymentMethod: PaymentMethod;
  chequeNo: string;
  dueDate: JDate;
  paid: number;
  notes: string;
  status: TradeStatus;
  result: TradeResult;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "نقدی",
  bank: "حواله بانکی",
  cheque: "چک",
  offset: "تهاتر / تسویه حساب",
};

export function buildTradeResult(trade: CropTrade): TradeResult {
  return calculateTrade({
    productId: trade.productId,
    quality: trade.quality,
    unitPrice: trade.unitPrice,
    costs: trade.costs,
    taxExempt: trade.taxExempt,
    taxRate: trade.taxRate,
  });
}

export function tradeBalance(trade: CropTrade): { paid: number; remaining: number; ratio: number; status: "unpaid" | "partial" | "settled" } {
  const total = trade.result.netReceipt;
  const paid = Math.min(Math.max(0, trade.paid), Math.max(0, total));
  const remaining = Math.max(0, total - paid);
  return {
    paid,
    remaining,
    ratio: total > 0 ? Math.round((paid / total) * 100) : 0,
    status: remaining === 0 ? "settled" : paid > 0 ? "partial" : "unpaid",
  };
}

const PRODUCT_SERIAL_CODES: Record<string, string> = {
  wheat: "WHT", barley: "BRY", canola: "CNL", corn: "CRN",
  "گندم": "WHT", "جو": "BRY", "کلزا": "CNL", "ذرت دانه‌ای": "CRN", "ذرت": "CRN",
};

/** کد سه‌حرفی پایدار برای هر محصول (شامل محصولات دلخواه فارسی). */
export function productSerialCode(productId: string): string {
  const direct = PRODUCT_SERIAL_CODES[productId];
  if (direct) return direct;
  const ascii = productId.replace(/[^a-zA-Z]/g, "").toUpperCase();
  if (ascii.length >= 3) return ascii.slice(0, 3);
  // محصول فارسی/دلخواه: کد پایدار از هش FNV-1a (بدون تصادف بین رفرش‌ها)
  let hash = 0x811c9dc5;
  for (let index = 0; index < productId.length; index += 1) {
    hash ^= productId.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return `X${alphabet[hash % 24]}${alphabet[Math.floor(hash / 24) % 24]}`;
}

export function makeTradeSerial(date: JDate, productId: ProductId, sequence: number): string {
  const code = productSerialCode(productId || "wheat");
  const stamp = `${date.jy}${String(date.jm).padStart(2, "0")}${String(date.jd).padStart(2, "0")}`;
  return `KSH-${code}-${stamp}-${String(sequence).padStart(3, "0")}`;
}

/* ------------------------- آزمون‌های قطعی موتور ------------------------- */

export interface EngineCheck {
  name: string;
  pass: boolean;
  detail: string;
}

export function runEngineSelfTest(): EngineCheck[] {
  const base: TradeCalculationInput = {
    productId: "wheat",
    quality: {
      grossKg: 24000,
      tareKg: 6000,
      moisture: 15,
      usefulLossPercent: 3,
      nonUsefulLossPercent: 1,
      impurity: 0.5,
      sprouted: 0.3,
      broken: 1.5,
      hectoliter: 79,
      protein: 12.8,
    },
    unitPrice: 49500,
    costs: emptyCosts(),
    taxExempt: true,
    taxRate: 10,
  };
  const result = calculateTrade(base);
  const checks: EngineCheck[] = [];
  checks.push({
    name: "وزن خالص = وزن پر − وزن خالی",
    pass: result.netKg === 18000,
    detail: `۱۸٬۰۰۰ = ۲۴٬۰۰۰ − ۶٬۰۰۰ → ${result.netKg}`,
  });
  checks.push({
    name: "هر کیلو افت رطوبت بیش از پایه، دقیقاً محاسبه می‌شود",
    pass: result.moistureLossKg === Math.round((18000 * (1 / 86)) * 100) / 100,
    detail: `افت ${result.moistureLossKg} کیلوگرم برای رطوبت ۱۵٪`,
  });
  checks.push({
    name: "قیمت خالصی هرگز منفی نمی‌شود",
    pass: result.payableKg >= 0 && result.netReceipt >= 0,
    detail: `وزن قابل پرداخت ${result.payableKg} کیلوگرم`,
  });
  checks.push({
    name: "قاعده ضعیف‌ترین شاخص در درجه‌بندی",
    pass: result.quality.grade === 1,
    detail: `درجه ${result.quality.grade} با محدودکننده «${result.quality.limitingFactor}»`,
  });
  const lowProtein = calculateTrade({ ...base, quality: { ...base.quality, protein: 11.8 } });
  checks.push({
    name: "پروتئین دانه کمتر، درجه را پایین می‌آورد",
    pass: lowProtein.quality.grade === 2,
    detail: `درجه ${lowProtein.quality.grade}`,
  });
  const wet = calculateTrade({ ...base, quality: { ...base.quality, moisture: 16 } });
  checks.push({
    name: "رطوبت بیشتر، وزن قابل پرداخت کمتری می‌دهد",
    pass: wet.payableKg < result.payableKg,
    detail: `۱۵٪ → ${result.payableKg} کیلو / ۱۶٪ → ${wet.payableKg} کیلو`,
  });
  const taxed = calculateTrade({ ...base, taxExempt: false, taxRate: 10 });
  checks.push({ name: "مالیات غیرمعاف به ارزش محصول اضافه می‌شود", pass: taxed.tax > 0, detail: `مالیات ${taxed.tax} تومان` });
  checks.push({ name: "حالت معاف، مالیات صفر می‌دهد", pass: result.tax === 0, detail: "معافیت محصول فرآوری‌نشده اعمال شد." });
  const badWeight = calculateTrade({ ...base, quality: { ...base.quality, tareKg: 30000 } });
  checks.push({
    name: "وزن خالی بیشتر از وزن پر، هشدار جدی می‌دهد",
    pass: badWeight.warnings.some((warning) => warning.code === "bad-weights"),
    detail: "هشدار بازبینی باسکول فعال شد.",
  });
  checks.push({
    name: "جمع هزینه‌ها با مؤلفه‌ها برابر است",
    pass:
      result.costs.total ===
      result.costs.transport + result.costs.loading + result.costs.commission + result.costs.insurance + result.costs.delayPenalty + result.costs.other,
    detail: `جمع ${result.costs.total} تومان`,
  });
  return checks;
}

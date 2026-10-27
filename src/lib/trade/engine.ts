/**
 * موتور قطعی «معامله محصول» — کشاورزحساب
 *
 * همه‌ی محاسبات وزن، افت، درجه‌بندی، قیمت، کارمزد، مالیات و تسویه در همین فایل
 * و به‌صورت تابع خالص (Pure) انجام می‌شود تا:
 *   ۱) هیچ محاسبه‌ای به مدل زبانی سپرده نشود؛
 *   ۲) همان کد در فرم وب، در سرور و در آزمون‌های خودکار استفاده شود؛
 *   ۳) خروجی «ردّ حسابرسی» (audit trail) داشته باشد و در سند چاپی قابل دفاع باشد.
 *
 * مبنای قانونی/تجاری (قابل ویرایش در فرم):
 *   • خرید تضمینی گندم: رطوبت حداکثر ۱۴٪، افت مفید ۳٪ + افت غیرمفید ۱٪ و حق بیمه به‌ازای کیلوگرم.
 *   • ناخالصی مجاز معمول ۲٪؛ مازاد به‌صورت وزنی کسر می‌شود؛ ناخالصی بیش از سقف = رد محصول.
 *   • درجه‌بندی گندم بر پایه وزن هکتولیتر، رطوبت، ناخالصی، دانه شکسته و سن‌زدگی.
 *   • محصولات کشاورزی فرآوری‌نشده طبق بند (الف) ماده ۹ قانون مالیات بر ارزش افزوده ۱۴۰۰ معاف‌اند؛
 *     نرخ مالیات پیش‌فرض صفر است و برای خدمات (کرایه/کارمزد) قابل تنظیم است.
 */

export const TRADE_ENGINE_VERSION = "1.0.0";

/* --------------------------------- انواع --------------------------------- */

export type TradeDirection = "sell" | "buy";
export type MarketMode = "guaranteed" | "factory" | "custom";
export type MoistureMethod = "proportional" | "per_percent" | "none";
export type Payer = "seller" | "buyer";
export type Grade = 0 | 1 | 2 | 3;
export type TradeStatus = "draft" | "confirmed" | "settled" | "canceled";
export type TradeUnit = "kg" | "ton" | "kharvar";
export type DocType = "contract" | "weighing" | "quality" | "invoice" | "settlement";

export interface TradeQuality {
  moisturePct: number;
  foreignMatterPct: number;
  brokenPct: number;
  pestPct: number;
  hectoliter: number;
  proteinPct: number;
}

export interface TradePolicy {
  baseMoisturePct: number;
  maxMoisturePct: number;
  allowedForeignPct: number;
  maxForeignPct: number;
  moistureMethod: MoistureMethod;
  moistureStepPct: number;
  standardDeductionPct: number;
  nonUsefulDeductionPct: number;
  brokenDeduction: boolean;
  gradePricing: boolean;
  insurancePerKgToman: number;
  commissionPct: number;
  transportToman: number;
  transportPayer: Payer;
  unloadingToman: number;
  unloadingPayer: Payer;
  samplingToman: number;
  weighbridgeToman: number;
  otherCostsToman: number;
  vatRatePct: number;
  vatOnFeesOnly: boolean;
  delayDays: number;
  delayPenaltyPerDayPct: number;
  adjustmentToman: number;
  prepaidToman: number;
  roundToToman: number;
  benchmarkPricePerKgToman: number;
}

export interface TradeInput {
  direction: TradeDirection;
  mode: MarketMode;
  cropKey: string;
  unit: TradeUnit;
  quantity: number;
  grossKg: number;
  tareKg: number;
  pricePerKgToman: number;
  quality: TradeQuality;
  policy: TradePolicy;
  meta?: {
    sellerName?: string;
    buyerName?: string;
    contractDate?: string;
    deliveryDate?: string;
    dueDate?: string;
    deliveryPlace?: string;
  };
}

export interface CalcStep {
  key: string;
  label: string;
  detail: string;
  weightKg?: number;
  amountToman?: number;
  kind: "weight" | "money" | "info";
}

export interface TradeCalc {
  engineVersion: string;
  crop: { key: string; name: string; category: string };
  weights: {
    netKg: number;
    netTon: number;
    standardDeductionKg: number;
    moistureExcessPct: number;
    moistureDeductionPct: number;
    moistureDeductionKg: number;
    foreignExcessPct: number;
    foreignDeductionKg: number;
    brokenDeductionKg: number;
    totalDeductionKg: number;
    adjustedKg: number;
    adjustedTon: number;
    factor: number;
  };
  quality: {
    grade: Grade;
    gradeLabel: string;
    priceFactor: number;
    score: number;
    issues: string[];
    notes: string[];
  };
  price: {
    basePricePerKgToman: number;
    gradePricePerKgToman: number;
    insurancePerKgToman: number;
    effectivePricePerKgToman: number;
    benchmarkPricePerKgToman: number;
    gapToBenchmarkPct: number;
  };
  money: {
    grossToman: number;
    insuranceToman: number;
    commissionToman: number;
    transportToman: number;
    unloadingToman: number;
    samplingToman: number;
    weighbridgeToman: number;
    otherCostsToman: number;
    sellerFeesToman: number;
    vatRatePct: number;
    vatToman: number;
    delayPenaltyToman: number;
    adjustmentToman: number;
    totalToman: number;
    prepaidToman: number;
    balanceToman: number;
    statusLabel: string;
  };
  steps: CalcStep[];
  errors: string[];
  warnings: string[];
  confidence: number;
}

/* -------------------------------- محصولات -------------------------------- */

export interface CropSpec {
  key: string;
  name: string;
  category: string;
  defaultPricePerKgToman: number;
  baseMoisturePct: number;
  maxMoisturePct: number;
  allowedForeignPct: number;
  maxForeignPct: number;
  usesHectoliter: boolean;
  gradeFactors: [number, number, number];
  rateNote: string;
}

export const CROP_SPECS: CropSpec[] = [
  {
    key: "wheat",
    name: "گندم",
    category: "غلات",
    defaultPricePerKgToman: 49650,
    baseMoisturePct: 14,
    maxMoisturePct: 14,
    allowedForeignPct: 2,
    maxForeignPct: 6,
    usesHectoliter: true,
    gradeFactors: [1.02, 1, 0.96],
    rateNote: "نرخ پایه در فرم قابل ویرایش است؛ پیش از معامله آن را با آخرین ابلاغیه شورای قیمت‌گذاری تطبیق دهید.",
  },
  {
    key: "barley",
    name: "جو",
    category: "غلات",
    defaultPricePerKgToman: 30000,
    baseMoisturePct: 14,
    maxMoisturePct: 15,
    allowedForeignPct: 2,
    maxForeignPct: 8,
    usesHectoliter: true,
    gradeFactors: [1.03, 1, 0.95],
    rateNote: "نرخ معمول بازار؛ قابل ویرایش.",
  },
  {
    key: "canola",
    name: "کلزا",
    category: "دانه روغنی",
    defaultPricePerKgToman: 45000,
    baseMoisturePct: 10,
    maxMoisturePct: 12,
    allowedForeignPct: 2,
    maxForeignPct: 5,
    usesHectoliter: false,
    gradeFactors: [1.02, 1, 0.95],
    rateNote: "نرخ توافقی/تضمینی را وارد کنید.",
  },
  {
    key: "corn",
    name: "ذرت دانه‌ای",
    category: "غلات",
    defaultPricePerKgToman: 30000,
    baseMoisturePct: 14,
    maxMoisturePct: 16,
    allowedForeignPct: 2,
    maxForeignPct: 6,
    usesHectoliter: false,
    gradeFactors: [1.02, 1, 0.95],
    rateNote: "نرخ توافقی؛ رطوبت بالای ۱۴٪ مشمول افت خشک‌کردن است.",
  },
  {
    key: "rice",
    name: "برنج شلتوک",
    category: "غلات",
    defaultPricePerKgToman: 120000,
    baseMoisturePct: 13,
    maxMoisturePct: 15,
    allowedForeignPct: 2,
    maxForeignPct: 6,
    usesHectoliter: false,
    gradeFactors: [1.05, 1, 0.92],
    rateNote: "نرخ بازار؛ قابل ویرایش.",
  },
  {
    key: "potato",
    name: "سیب‌زمینی",
    category: "محصولات جالیزی",
    defaultPricePerKgToman: 25000,
    baseMoisturePct: 0,
    maxMoisturePct: 0,
    allowedForeignPct: 4,
    maxForeignPct: 12,
    usesHectoliter: false,
    gradeFactors: [1.05, 1, 0.9],
    rateNote: "بدون افت رطوبت؛ افت ضایعات و خاک ملاک است.",
  },
  {
    key: "onion",
    name: "پیاز",
    category: "محصولات جالیزی",
    defaultPricePerKgToman: 20000,
    baseMoisturePct: 0,
    maxMoisturePct: 0,
    allowedForeignPct: 4,
    maxForeignPct: 12,
    usesHectoliter: false,
    gradeFactors: [1.05, 1, 0.9],
    rateNote: "نرخ بازار؛ قابل ویرایش.",
  },
  {
    key: "saffron",
    name: "زعفران",
    category: "محصولات ویژه",
    defaultPricePerKgToman: 120000000,
    baseMoisturePct: 10,
    maxMoisturePct: 12,
    allowedForeignPct: 0.5,
    maxForeignPct: 2,
    usesHectoliter: false,
    gradeFactors: [1.1, 1, 0.85],
    rateNote: "قیمت زعفران به‌ازای هر کیلوگرم؛ دقت کنید واحد را اشتباه وارد نکنید.",
  },
  {
    key: "pistachio",
    name: "پسته (خشک)",
    category: "محصولات ویژه",
    defaultPricePerKgToman: 900000,
    baseMoisturePct: 6,
    maxMoisturePct: 8,
    allowedForeignPct: 1,
    maxForeignPct: 5,
    usesHectoliter: false,
    gradeFactors: [1.1, 1, 0.85],
    rateNote: "نرخ بازار؛ قابل ویرایش.",
  },
  {
    key: "date",
    name: "خرما",
    category: "محصولات باغی",
    defaultPricePerKgToman: 90000,
    baseMoisturePct: 18,
    maxMoisturePct: 22,
    allowedForeignPct: 2,
    maxForeignPct: 6,
    usesHectoliter: false,
    gradeFactors: [1.08, 1, 0.88],
    rateNote: "نرخ بازار؛ قابل ویرایش.",
  },
];

export function getCrop(key: string): CropSpec {
  return CROP_SPECS.find((crop) => crop.key === key) ?? CROP_SPECS[0];
}

export const UNIT_FACTORS: Record<TradeUnit, number> = { kg: 1, ton: 1000, kharvar: 300 };

export const UNIT_LABEL: Record<TradeUnit, string> = {
  kg: "کیلوگرم",
  ton: "تن (۱۰۰۰ کیلوگرم)",
  kharvar: "خروار (۳۰۰ کیلوگرم)",
};

export function toKg(value: number, unit: TradeUnit): number {
  return round(value * UNIT_FACTORS[unit], 3);
}

export function fromKg(kg: number, unit: TradeUnit): number {
  return round(kg / UNIT_FACTORS[unit], 3);
}

/* ------------------------------- پیش‌تنظیم‌ها ------------------------------ */

export const TRADE_MODE_META: Record<
  MarketMode,
  { label: string; description: string; badge: string }
> = {
  guaranteed: {
    label: "خرید تضمینی (دولتی / سیلو)",
    description: "رطوبت ۱۴٪، افت مفید ۳٪ + غیرمفید ۱٪، حق بیمه و درجه‌بندی رسمی",
    badge: "تضمینی",
  },
  factory: {
    label: "قرارداد با کارخانه / خریدار آزاد",
    description: "افت رطوبت و ناخالصی توافقی، کارمزد، کرایه و شرایط پرداخت طرف مقابل",
    badge: "کارخانه",
  },
  custom: {
    label: "توافقی / دستی",
    description: "همه ضرایب و کسورات را خودتان تعیین می‌کنید",
    badge: "توافقی",
  },
};

export function defaultPolicy(mode: MarketMode, crop: CropSpec): TradePolicy {
  const base: TradePolicy = {
    baseMoisturePct: crop.baseMoisturePct,
    maxMoisturePct: crop.maxMoisturePct,
    allowedForeignPct: crop.allowedForeignPct,
    maxForeignPct: crop.maxForeignPct,
    moistureMethod: crop.baseMoisturePct > 0 ? "proportional" : "none",
    moistureStepPct: 1.2,
    standardDeductionPct: 0,
    nonUsefulDeductionPct: 0,
    brokenDeduction: false,
    gradePricing: true,
    insurancePerKgToman: 0,
    commissionPct: 0,
    transportToman: 0,
    transportPayer: "seller",
    unloadingToman: 0,
    unloadingPayer: "seller",
    samplingToman: 0,
    weighbridgeToman: 0,
    otherCostsToman: 0,
    vatRatePct: 0,
    vatOnFeesOnly: true,
    delayDays: 0,
    delayPenaltyPerDayPct: 0,
    adjustmentToman: 0,
    prepaidToman: 0,
    roundToToman: 1000,
    benchmarkPricePerKgToman: crop.defaultPricePerKgToman,
  };

  if (mode === "guaranteed") {
    return {
      ...base,
      standardDeductionPct: 3,
      nonUsefulDeductionPct: 1,
      insurancePerKgToman: 500,
      gradePricing: false,
      commissionPct: 0,
      vatRatePct: 0,
    };
  }
  if (mode === "factory") {
    return {
      ...base,
      standardDeductionPct: 0,
      nonUsefulDeductionPct: 0,
      brokenDeduction: true,
      commissionPct: 1.5,
      vatRatePct: 0,
      vatOnFeesOnly: true,
    };
  }
  return { ...base, gradePricing: false };
}

export function defaultQuality(crop: CropSpec): TradeQuality {
  return {
    moisturePct: crop.baseMoisturePct,
    foreignMatterPct: 1,
    brokenPct: 1,
    pestPct: 0,
    hectoliter: crop.usesHectoliter ? 77 : 0,
    proteinPct: crop.key === "wheat" ? 12 : 0,
  };
}

/* ------------------------------ ابزار عددی ------------------------------- */

export function round(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, digits);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function roundTo(value: number, step: number): number {
  if (!step || step <= 1) return Math.round(value);
  return Math.round(value / step) * step;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const num = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/* ------------------------------- درجه‌بندی ------------------------------- */

export const GRADE_LABEL: Record<Grade, string> = {
  0: "رد / نیازمند بازبینی",
  1: "درجه یک",
  2: "درجه دو",
  3: "درجه سه",
};

export function evaluateQuality(
  crop: CropSpec,
  quality: TradeQuality,
  policy: TradePolicy,
): TradeCalc["quality"] {
  const issues: string[] = [];
  const notes: string[] = [];
  const moisture = num(quality.moisturePct);
  const foreign = num(quality.foreignMatterPct);
  const broken = num(quality.brokenPct);
  const pest = num(quality.pestPct);
  const hectoliter = num(quality.hectoliter);
  const protein = num(quality.proteinPct);

  let grade = 1;
  let rejected = false;
  // در درجه‌بندی رسمی، ضعیف‌ترین شاخص تعیین‌کننده است؛ هر شاخص فقط می‌تواند درجه را «بدتر» کند.
  const capGrade = (value: number) => {
    grade = Math.min(3, Math.max(grade, value));
  };

  if (policy.maxMoisturePct > 0 && moisture > policy.maxMoisturePct) {
    rejected = true;
    issues.push(
      `رطوبت ${moisture}٪ از سقف پذیرش ${policy.maxMoisturePct}٪ بیشتر است؛ تحویل در این وضعیت پذیرفته نمی‌شود.`,
    );
  } else if (policy.baseMoisturePct > 0 && moisture > policy.baseMoisturePct) {
    notes.push(`رطوبت ${round(moisture - policy.baseMoisturePct, 2)}٪ بالاتر از پایه است و افت رطوبت کسر می‌شود.`);
    capGrade(2);
  }

  if (policy.maxForeignPct > 0 && foreign > policy.maxForeignPct) {
    rejected = true;
    issues.push(`ناخالصی ${foreign}٪ از سقف ${policy.maxForeignPct}٪ بیشتر است؛ محصول باید پاک‌سازی شود.`);
  }
  if (pest > 2) {
    rejected = true;
    issues.push("سن‌زدگی بیش از ۲٪ است؛ محصول مشمول رد یا افت سنگین خواهد بود.");
  } else if (pest > 0.5) {
    capGrade(3);
    notes.push("سن‌زدگی بالاست؛ درجه کیفی حداکثر سه در نظر گرفته شد.");
  }
  if (broken > 6) capGrade(3);

  if (crop.usesHectoliter) {
    if (hectoliter <= 0) {
      notes.push("وزن هکتولیتر ثبت نشده است؛ درجه‌بندی تنها بر پایه رطوبت و ناخالصی انجام شد.");
      capGrade(2);
    } else if (hectoliter >= 78) {
      // درجه یک؛ چیزی به درجه اضافه نمی‌شود
    } else if (hectoliter >= 75) {
      capGrade(2);
    } else if (hectoliter >= 72) {
      capGrade(3);
    } else {
      rejected = true;
      issues.push("وزن هکتولیتر کمتر از ۷۲ است و در جدول درجه‌بندی قرار نمی‌گیرد.");
    }
  }

  if (foreign > 1.5) capGrade(3);
  else if (foreign > 1) capGrade(2);

  if (crop.key === "wheat" && protein > 0) {
    if (protein < 10) {
      capGrade(3);
      notes.push("پروتئین کمتر از ۱۰٪ است؛ حداکثر درجه سه در نظر گرفته شد.");
    } else if (protein >= 12 && grade === 1) {
      notes.push("پروتئین بالای ۱۲٪ و سایر شاخص‌ها در محدوده درجه یک است.");
    }
  }

  if (rejected) grade = 0;

  const factor = crop.gradeFactors[grade === 0 ? 2 : grade - 1] ?? 1;
  let score = 100;
  score -= Math.max(0, moisture - policy.baseMoisturePct) * 3;
  score -= Math.max(0, foreign - 1) * 5;
  score -= pest * 8;
  score -= Math.max(0, broken - 2) * 2;
  if (crop.usesHectoliter && hectoliter > 0) score -= Math.max(0, 78 - hectoliter) * 2;
  if (crop.key === "wheat" && protein > 0) score -= Math.max(0, 12 - protein) * 2;

  return {
    grade: (rejected ? 0 : grade) as Grade,
    gradeLabel: GRADE_LABEL[(rejected ? 0 : grade) as Grade],
    priceFactor: factor,
    score: Math.round(clamp(score, 0, 100)),
    issues,
    notes,
  };
}

/* -------------------------------- محاسبه -------------------------------- */

export function computeTrade(input: TradeInput): TradeCalc {
  const crop = getCrop(input.cropKey);
  const policy: TradePolicy = {
    ...defaultPolicy(input.mode, crop),
    ...input.policy,
  };
  const quality: TradeQuality = { ...defaultQuality(crop), ...input.quality };
  const errors: string[] = [];
  const warnings: string[] = [];
  const steps: CalcStep[] = [];

  const quantityKg =
    num(input.grossKg) > 0 ? num(input.grossKg) - num(input.tareKg) : toKg(num(input.quantity), input.unit);
  const grossKg = num(input.grossKg);
  const tareKg = num(input.tareKg);
  let netKg = quantityKg;

  if (!Number.isFinite(netKg) || netKg <= 0) {
    errors.push("وزن محصول باید بزرگ‌تر از صفر باشد (وزن پر، وزن خالی و واحد را بررسی کنید).");
    netKg = 0;
  }
  if (tareKg > 0 && tareKg >= grossKg) {
    errors.push("وزن خالی (باسکول) نمی‌تواند مساوی یا بیشتر از وزن پر باشد.");
  }
  if (grossKg > 0 && tareKg === 0) {
    warnings.push("وزن خالی ثبت نشده است؛ وزن خالص برابر وزن پر در نظر گرفته شد. برای سند باسکول، وزن خالی را وارد کنید.");
  }
  if (num(input.pricePerKgToman) <= 0) {
    errors.push("قیمت هر کیلوگرم را وارد کنید؛ مبلغ صفر قابل تسویه نیست.");
  }
  if (policy.baseMoisturePct > 0 && num(quality.moisturePct) <= 0) {
    warnings.push("درصد رطوبت صفر ثبت شده است؛ اگر اندازه‌گیری نشده، آن را با آزمایشگاه کنترل کنید.");
  }

  const qualityResult = evaluateQuality(crop, quality, policy);
  if (qualityResult.grade === 0) {
    errors.push(...qualityResult.issues);
  }

  /* ---------- وزن تعدیل‌شده ---------- */

  const standardDeductionKg = round((netKg * (policy.standardDeductionPct + policy.nonUsefulDeductionPct)) / 100, 3);
  if (standardDeductionKg > 0) {
    steps.push({
      key: "standard-deduction",
      kind: "weight",
      label: "افت مفید و غیرمفید استاندارد",
      detail: `${policy.standardDeductionPct}٪ افت مفید + ${policy.nonUsefulDeductionPct}٪ افت غیرمفید`,
      weightKg: -standardDeductionKg,
    });
  }

  const moistureExcessPct = Math.max(0, num(quality.moisturePct) - policy.baseMoisturePct);
  let moistureDeductionPct = 0;
  if (policy.moistureMethod === "proportional" && moistureExcessPct > 0 && num(quality.moisturePct) < 100) {
    moistureDeductionPct = (moistureExcessPct / (100 - policy.baseMoisturePct)) * 100;
  } else if (policy.moistureMethod === "per_percent") {
    moistureDeductionPct = moistureExcessPct * policy.moistureStepPct;
  }
  moistureDeductionPct = clamp(round(moistureDeductionPct, 3), 0, 35);
  const moistureDeductionKg = round((netKg * moistureDeductionPct) / 100, 3);
  if (moistureDeductionKg > 0) {
    steps.push({
      key: "moisture-deduction",
      kind: "weight",
      label: "افت رطوبت مازاد",
      detail:
        policy.moistureMethod === "per_percent"
          ? `${round(moistureExcessPct, 2)}٪ مازاد × ${policy.moistureStepPct}٪ به ازای هر واحد`
          : `فرمول وزنی: (${round(moistureExcessPct, 2)} ÷ ${100 - policy.baseMoisturePct}) × ۱۰۰ = ${moistureDeductionPct}٪`,
      weightKg: -moistureDeductionKg,
    });
  }

  const foreignExcessPct = Math.max(0, num(quality.foreignMatterPct) - policy.allowedForeignPct);
  const foreignDeductionKg = round((netKg * foreignExcessPct) / 100, 3);
  if (foreignDeductionKg > 0) {
    steps.push({
      key: "foreign-deduction",
      kind: "weight",
      label: "افت ناخالصی مازاد",
      detail: `${round(foreignExcessPct, 2)}٪ بیشتر از حد مجاز ${policy.allowedForeignPct}٪ (کسر وزنی یک‌به‌یک)`,
      weightKg: -foreignDeductionKg,
    });
  }

  const brokenExcessPct = policy.brokenDeduction ? Math.max(0, num(quality.brokenPct) - 2) : 0;
  const brokenDeductionKg = round((netKg * brokenExcessPct) / 100, 3);
  if (brokenDeductionKg > 0) {
    steps.push({
      key: "broken-deduction",
      kind: "weight",
      label: "افت دانه شکسته",
      detail: `${round(brokenExcessPct, 2)}٪ بیشتر از ۲٪`,
      weightKg: -brokenDeductionKg,
    });
  }

  let totalDeductionKg = round(standardDeductionKg + moistureDeductionKg + foreignDeductionKg + brokenDeductionKg, 3);
  if (netKg > 0 && totalDeductionKg > netKg * 0.4) {
    warnings.push("جمع کسورات وزنی از ۴۰٪ وزن خالص گذشت؛ شرایط را بازبینی کنید.");
    totalDeductionKg = round(netKg * 0.4, 3);
  }
  const adjustedKg = round(Math.max(0, netKg - totalDeductionKg), 3);
  const factor = netKg > 0 ? adjustedKg / netKg : 0;

  steps.unshift({
    key: "net-weight",
    kind: "weight",
    label: "وزن خالص تحویلی",
    detail:
      grossKg > 0
        ? `وزن پر ${round(grossKg, 1)} − وزن خالی ${round(tareKg, 1)} کیلوگرم`
        : `${num(input.quantity)} ${UNIT_LABEL[input.unit]} × ${UNIT_FACTORS[input.unit]}`,
    weightKg: netKg,
  });

  /* ---------- قیمت ---------- */

  const basePrice = Math.max(0, num(input.pricePerKgToman));
  const gradePrice = policy.gradePricing ? round(basePrice * qualityResult.priceFactor, 2) : basePrice;
  const insurancePerKg = Math.max(0, num(policy.insurancePerKgToman));
  const effectivePrice = round(gradePrice + insurancePerKg, 2);
  const benchmark = Math.max(0, num(policy.benchmarkPricePerKgToman));
  const gapToBenchmarkPct = benchmark > 0 ? round(((effectivePrice - benchmark) / benchmark) * 100, 1) : 0;
  if (input.mode === "factory" && benchmark > 0 && effectivePrice < benchmark * 0.95) {
    warnings.push(
      `قیمت مؤثر ${effectivePrice.toLocaleString("en-US")} تومان، بیش از ۵٪ پایین‌تر از نرخ مرجع است؛ پیش از امضا بازنگری کنید.`,
    );
  }

  /* ---------- پول ---------- */

  const grossToman = Math.round(adjustedKg * gradePrice);
  const insuranceToman = Math.round(adjustedKg * insurancePerKg);
  const commissionToman = Math.round((grossToman * Math.max(0, num(policy.commissionPct))) / 100);
  const transportToman = Math.max(0, Math.round(num(policy.transportToman)));
  const unloadingToman = Math.max(0, Math.round(num(policy.unloadingToman)));
  const samplingToman = Math.max(0, Math.round(num(policy.samplingToman)));
  const weighbridgeToman = Math.max(0, Math.round(num(policy.weighbridgeToman)));
  const otherCostsToman = Math.max(0, Math.round(num(policy.otherCostsToman)));

  const sellerFees =
    (policy.transportPayer === "seller" ? transportToman : 0) +
    (policy.unloadingPayer === "seller" ? unloadingToman : 0) +
    samplingToman +
    weighbridgeToman +
    otherCostsToman;

  const vatRate = clamp(num(policy.vatRatePct), 0, 30);
  const vatBase = policy.vatOnFeesOnly ? commissionToman + sellerFees : grossToman + commissionToman;
  const vatToman = Math.round((vatBase * vatRate) / 100);

  const delayDays = Math.max(0, Math.round(num(policy.delayDays)));
  let delayPenaltyToman = Math.round((grossToman * Math.max(0, num(policy.delayPenaltyPerDayPct)) * delayDays) / 100);
  if (grossToman > 0 && delayPenaltyToman > grossToman * 0.2) {
    warnings.push("خسارت تأخیر از ۲۰٪ مبلغ محصول گذشت؛ سقف قانونی/توافقی قرارداد را بررسی کنید.");
    delayPenaltyToman = Math.round(grossToman * 0.2);
  }

  const adjustmentToman = Math.round(num(policy.adjustmentToman));
  const rawTotal =
    grossToman + insuranceToman + vatToman + adjustmentToman - commissionToman - sellerFees - delayPenaltyToman;
  const totalToman = Math.max(0, roundTo(rawTotal, Math.max(1, Math.round(num(policy.roundToToman, 1000)))));
  const prepaidToman = Math.max(0, Math.round(num(policy.prepaidToman)));
  if (prepaidToman > totalToman) {
    warnings.push("پیش‌پرداخت/دریافتی بیشتر از مبلغ قابل تسویه است؛ مبلغ را کنترل کنید.");
  }
  const balanceToman = Math.max(0, totalToman - prepaidToman);

  steps.push({
    key: "gross",
    kind: "money",
    label: "ارزش محصول پس از کسورات",
    detail: `${adjustedKg.toLocaleString("en-US")} کیلوگرم × ${gradePrice.toLocaleString("en-US")} تومان`,
    amountToman: grossToman,
  });
  if (insuranceToman > 0) {
    steps.push({
      key: "insurance",
      kind: "money",
      label: "حق بیمه محصول",
      detail: `${insurancePerKg.toLocaleString("en-US")} تومان × هر کیلوگرم (افزودنی به مبلغ کشاورز)`,
      amountToman: insuranceToman,
    });
  }
  if (commissionToman > 0) {
    steps.push({
      key: "commission",
      kind: "money",
      label: "کارمزد/دلالی",
      detail: `${policy.commissionPct}٪ از ارزش محصول`,
      amountToman: -commissionToman,
    });
  }
  if (transportToman > 0) {
    steps.push({
      key: "transport",
      kind: "money",
      label: "کرایه حمل",
      detail: policy.transportPayer === "seller" ? "بر عهده فروشنده (کسر می‌شود)" : "بر عهده خریدار (کسر نمی‌شود)",
      amountToman: policy.transportPayer === "seller" ? -transportToman : 0,
    });
  }
  if (unloadingToman > 0) {
    steps.push({
      key: "unloading",
      kind: "money",
      label: "تخلیه و بارگیری",
      detail: policy.unloadingPayer === "seller" ? "بر عهده فروشنده" : "بر عهده خریدار",
      amountToman: policy.unloadingPayer === "seller" ? -unloadingToman : 0,
    });
  }
  if (samplingToman + weighbridgeToman + otherCostsToman > 0) {
    steps.push({
      key: "other-fees",
      kind: "money",
      label: "نمونه‌برداری، باسکول و سایر هزینه‌ها",
      detail: "هزینه‌های اجرایی کسرشده از مبلغ محصول",
      amountToman: -(samplingToman + weighbridgeToman + otherCostsToman),
    });
  }
  if (vatToman > 0) {
    steps.push({
      key: "vat",
      kind: "money",
      label: "مالیات و عوارض ارزش افزوده",
      detail: `${vatRate}٪ بر ${policy.vatOnFeesOnly ? "کارمزد و هزینه‌های خدماتی" : "ارزش محصول"}`,
      amountToman: vatToman,
    });
  }
  if (delayPenaltyToman > 0) {
    steps.push({
      key: "penalty",
      kind: "money",
      label: "خسارت تأخیر در پرداخت",
      detail: `${delayDays} روز × ${policy.delayPenaltyPerDayPct}٪`,
      amountToman: -delayPenaltyToman,
    });
  }
  if (adjustmentToman !== 0) {
    steps.push({
      key: "adjustment",
      kind: "money",
      label: "تعدیل توافقی",
      detail: adjustmentToman > 0 ? "افزایش توافقی مبلغ" : "کسر توافقی مبلغ",
      amountToman: adjustmentToman,
    });
  }

  const filledChecks = [
    Boolean(input.meta?.sellerName && input.meta?.buyerName),
    Boolean(input.meta?.contractDate),
    basePrice > 0,
    netKg > 0,
    num(quality.moisturePct) > 0 || policy.baseMoisturePct === 0,
    !crop.usesHectoliter || num(quality.hectoliter) > 0,
    Boolean(input.meta?.deliveryPlace),
  ];
  const confidence = Math.round((filledChecks.filter(Boolean).length / filledChecks.length) * 100);

  return {
    engineVersion: TRADE_ENGINE_VERSION,
    crop: { key: crop.key, name: crop.name, category: crop.category },
    weights: {
      netKg: round(netKg, 3),
      netTon: round(netKg / 1000, 3),
      standardDeductionKg,
      moistureExcessPct: round(moistureExcessPct, 2),
      moistureDeductionPct,
      moistureDeductionKg,
      foreignExcessPct: round(foreignExcessPct, 2),
      foreignDeductionKg,
      brokenDeductionKg,
      totalDeductionKg,
      adjustedKg,
      adjustedTon: round(adjustedKg / 1000, 3),
      factor: round(factor, 4),
    },
    quality: qualityResult,
    price: {
      basePricePerKgToman: round(basePrice, 2),
      gradePricePerKgToman: gradePrice,
      insurancePerKgToman: insurancePerKg,
      effectivePricePerKgToman: effectivePrice,
      benchmarkPricePerKgToman: benchmark,
      gapToBenchmarkPct,
    },
    money: {
      grossToman,
      insuranceToman,
      commissionToman,
      transportToman,
      unloadingToman,
      samplingToman,
      weighbridgeToman,
      otherCostsToman,
      sellerFeesToman: sellerFees,
      vatRatePct: vatRate,
      vatToman,
      delayPenaltyToman,
      adjustmentToman,
      totalToman,
      prepaidToman,
      balanceToman,
      statusLabel: errors.length > 0 ? "نیازمند اصلاح" : balanceToman <= 0 && totalToman > 0 ? "تسویه‌شده" : "در انتظار تسویه",
    },
    steps,
    errors,
    warnings,
    confidence,
  };
}

/* --------------------------------- اسناد --------------------------------- */

export const DOC_TYPES: Record<DocType, { code: string; title: string; description: string }> = {
  contract: {
    code: "CON",
    title: "قرارداد فروش محصول کشاورزی",
    description: "قرارداد رسمی با مشخصات طرفین، مقدار، کیفیت، قیمت، کسورات و شرایط پرداخت",
  },
  weighing: {
    code: "WB",
    title: "قبض باسکول و رسید تحویل بار",
    description: "وزن پر/خالی/خالص، پلاک خودرو و تأیید تحویل‌گیرنده",
  },
  quality: {
    code: "QC",
    title: "صورتجلسه نمونه‌برداری و درجه‌بندی کیفیت",
    description: "رطوبت، ناخالصی، شکسته، سن‌زدگی، وزن هکتولیتر و درجه کیفی",
  },
  invoice: {
    code: "INV",
    title: "فاکتور فروش محصول",
    description: "فاکتور با اقلام، مبلغ، کسورات، مالیات و مبلغ به حروف",
  },
  settlement: {
    code: "SET",
    title: "برگه تسویه حساب",
    description: "مانده حساب، دریافتی‌ها، مانده نهایی و تعهد طرفین",
  },
};

export const DOC_ORDER: DocType[] = ["contract", "weighing", "quality", "invoice", "settlement"];

export const TRADE_STATUS_META: Record<TradeStatus, { label: string; tone: string }> = {
  draft: { label: "پیش‌نویس", tone: "slate" },
  confirmed: { label: "تأییدشده", tone: "clay" },
  settled: { label: "تسویه‌شده", tone: "farm" },
  canceled: { label: "لغوشده", tone: "red" },
};

export function tradeCode(jalaliYear: number, sequence: number): string {
  return `KH-${jalaliYear}-${String(Math.max(1, sequence)).padStart(4, "0")}`;
}

export function documentSerial(code: string, docType: DocType): string {
  return `${code}/${DOC_TYPES[docType].code}`;
}

export function statusFor(totalToman: number, prepaidToman: number, current: TradeStatus): TradeStatus {
  if (current === "canceled") return "canceled";
  if (totalToman > 0 && prepaidToman >= totalToman) return "settled";
  return current === "draft" ? "draft" : "confirmed";
}

/** خلاصه یک‌خطی برای فهرست معاملات و تشخیص سریع مشکل */
export function calcHeadline(calc: TradeCalc): string {
  if (calc.errors.length) return calc.errors[0];
  if (calc.warnings.length) return calc.warnings[0];
  return `${calc.quality.gradeLabel} · ضریب ${Math.round(calc.weights.factor * 1000) / 10}٪ · کیفیت ${calc.quality.score}/۱۰۰`;
}

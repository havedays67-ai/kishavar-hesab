/**
 * برنامه‌ریز کشت — چارچوب تصمیم قطعی (نه حدس مدل)
 * ------------------------------------------------------------
 * «چه زمانی چه چیزی بکارم که سود کند؟» ترکیبی از چند عامل است:
 * اقلیم، پنجرهٔ کاشت، نیاز آبی، خاک و شوری، ریسک سرما/گرما، هزینه و بازار.
 * این فایل جدول‌های کارشناسی را با پروفایل مزرعه ترکیب می‌کند و همیشه
 * «بازه» می‌دهد، نه عدد قطعی؛ برای قیمت روز و پیش‌بینی هوا هم صریح می‌گوید
 * که دادهٔ زنده لازم است.
 *
 * هرگز جای مدل زبانی را نمی‌گیرد: مدل توضیح می‌دهد، این فایل حساب می‌کند.
 */

export type ClimateZone = "cold" | "temperate" | "warm" | "dry" | "humid";
export type SoilType = "clay" | "loam" | "sandy" | "saline";
export type WaterSource = "well" | "canal" | "qanat" | "rain";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type CropId = "wheat-irrigated" | "wheat-rainfed" | "barley" | "canola" | "corn-forage" | "alfalfa" | "cotton" | "sugarbeet";

export interface FarmProfile {
  region: string;
  climate: ClimateZone;
  areaHa: number;
  soil: SoilType;
  waterSource: WaterSource;
  /** آب قابل دسترس در کل فصل، متر مکعب برای هر هکتار. */
  waterM3PerHa?: number;
  budgetToman?: number;
  season: Season;
  /** شوری عصارهٔ اشباع (dS/m). */
  salinityEc?: number;
}

export interface WeatherSnapshot {
  /** ۱۰ روز آینده: کمینه/بیشینهٔ دما و بارش. */
  days: { minTemp: number; maxTemp: number; rainMm: number }[];
  /** تاریخ آخرین سرما و اولین سرما (متن شمسی یا null). */
  lastFrost?: string | null;
  firstFrost?: string | null;
}

export interface CropSpec {
  id: CropId;
  name: string;
  /** پنجرهٔ کاشت بر اساس اقلیم (ماه‌های شمسی). */
  windows: Record<ClimateZone, string>;
  /** نیاز آبی کل فصل (میلی‌متر). */
  waterNeedMm: number;
  /** حساسیت به شوری: حداکثر EC قابل تحمل. */
  maxEc: number;
  /** خاک مناسب. */
  soils: SoilType[];
  /** تحمل سرما در مرحلهٔ سبز شدن. */
  frostTolerance: "high" | "medium" | "low";
  daysToHarvest: [number, number];
  /** عملکرد تقریبی (تن در هکتار). */
  yieldTPerHa: [number, number];
  /** هزینهٔ تقریبی هر هکتار (تومان). */
  costPerHaToman: [number, number];
  /** قیمت فروش (تومان بر کیلوگرم) — فقط بازهٔ راهنما. */
  pricePerKgToman: [number, number];
  /** نیاز به دادهٔ زندهٔ بازار. */
  liveMarket: boolean;
  notes: string[];
}

export const CROPS: Record<CropId, CropSpec> = {
  "wheat-irrigated": {
    id: "wheat-irrigated",
    name: "گندم آبی",
    windows: { cold: "مهر تا نیمهٔ آبان", temperate: "آبان تا آذر", warm: "آذر تا دی", dry: "آبان تا آذر", humid: "آبان تا آذر" },
    waterNeedMm: 550,
    maxEc: 6,
    soils: ["loam", "clay"],
    frostTolerance: "high",
    daysToHarvest: [210, 240],
    yieldTPerHa: [4, 6.5],
    costPerHaToman: [45_000_000, 65_000_000],
    pricePerKgToman: [18_000, 24_000],
    liveMarket: true,
    notes: ["کاشت زودتر از پنجرهٔ اقلیمی، خطر سرمای بهاره را زیاد می‌کند.", "تناوب با کلزا یا حبوبات، بیماری خاک‌زاد را کم می‌کند."],
  },
  "wheat-rainfed": {
    id: "wheat-rainfed",
    name: "گندم دیم",
    windows: { cold: "مهر", temperate: "مهر تا آبان", warm: "آبان", dry: "مهر تا آبان", humid: "آبان" },
    waterNeedMm: 300,
    maxEc: 4,
    soils: ["loam", "clay", "sandy"],
    frostTolerance: "high",
    daysToHarvest: [200, 230],
    yieldTPerHa: [1.2, 2.8],
    costPerHaToman: [22_000_000, 32_000_000],
    pricePerKgToman: [18_000, 24_000],
    liveMarket: true,
    notes: ["دیم فقط با بارش سالانهٔ کافی (حدود ۳۰۰ میلی‌متر) منطقی است.", "خاک‌ورزی حفاظتی، رطوبت را بیشتر نگه می‌دارد."],
  },
  barley: {
    id: "barley",
    name: "جو",
    windows: { cold: "مهر تا آبان", temperate: "آبان تا آذر", warm: "آذر", dry: "آبان", humid: "آبان تا آذر" },
    waterNeedMm: 450,
    maxEc: 8,
    soils: ["loam", "clay", "sandy"],
    frostTolerance: "high",
    daysToHarvest: [190, 220],
    yieldTPerHa: [3, 5],
    costPerHaToman: [35_000_000, 50_000_000],
    pricePerKgToman: [14_000, 19_000],
    liveMarket: true,
    notes: ["جو به شوری و کم‌آبی از گندم مقاوم‌تر است.", "برای علوفهٔ دام، برداشت زودتر با ارزش غذایی بالاتر."],
  },
  canola: {
    id: "canola",
    name: "کلزا",
    windows: { cold: "شهریور تا مهر", temperate: "مهر", warm: "مهر تا آبان", dry: "مهر", humid: "مهر تا آبان" },
    waterNeedMm: 500,
    maxEc: 5,
    soils: ["loam", "clay"],
    frostTolerance: "medium",
    daysToHarvest: [200, 230],
    yieldTPerHa: [2, 3.5],
    costPerHaToman: [40_000_000, 58_000_000],
    pricePerKgToman: [30_000, 40_000],
    liveMarket: true,
    notes: ["کاشت دیرتر از مهر، سرمازدگی زمستانه را بالا می‌برد.", "تناوب با گندم، علف هرز و بیماری را کاهش می‌دهد."],
  },
  "corn-forage": {
    id: "corn-forage",
    name: "ذرت علوفه‌ای",
    windows: { cold: "اردیبهشت تا خرداد", temperate: "فروردین تا خرداد", warm: "اسفند تا فروردین", dry: "فروردین تا اردیبهشت", humid: "اردیبهشت" },
    waterNeedMm: 700,
    maxEc: 2,
    soils: ["loam", "clay"],
    frostTolerance: "low",
    daysToHarvest: [100, 130],
    yieldTPerHa: [40, 60],
    costPerHaToman: [55_000_000, 80_000_000],
    pricePerKgToman: [3_500, 5_500],
    liveMarket: true,
    notes: ["به آب زیاد و گرمای کافی نیاز دارد.", "کاشت زیر دمای خاک ۱۲ درجه، جوانه‌زنی را ضعیف می‌کند."],
  },
  alfalfa: {
    id: "alfalfa",
    name: "یونجه",
    windows: { cold: "اسفند تا فروردین", temperate: "اسفند تا فروردین", warm: "بهمن تا اسفند", dry: "اسفند", humid: "فروردین" },
    waterNeedMm: 900,
    maxEc: 3,
    soils: ["loam", "clay"],
    frostTolerance: "medium",
    daysToHarvest: [70, 90],
    yieldTPerHa: [12, 18],
    costPerHaToman: [70_000_000, 95_000_000],
    pricePerKgToman: [6_000, 9_000],
    liveMarket: true,
    notes: ["چندساله است؛ سال اول بازده کم و از سال دوم سودده.", "آبیاری منظم، مهم‌ترین عامل موفقیت است."],
  },
  cotton: {
    id: "cotton",
    name: "پنبه",
    windows: { cold: "اردیبهشت", temperate: "فروردین تا اردیبهشت", warm: "اسفند تا فروردین", dry: "فروردین", humid: "اردیبهشت" },
    waterNeedMm: 800,
    maxEc: 7,
    soils: ["loam", "clay"],
    frostTolerance: "low",
    daysToHarvest: [150, 180],
    yieldTPerHa: [2.5, 4],
    costPerHaToman: [60_000_000, 85_000_000],
    pricePerKgToman: [35_000, 50_000],
    liveMarket: true,
    notes: ["به گرما و فصل رشد بلند نیاز دارد.", "برداشت زودتر از باز شدن کامل قوزه، کیفیت الیاف را کم می‌کند."],
  },
  sugarbeet: {
    id: "sugarbeet",
    name: "چغندرقند",
    windows: { cold: "فروردین تا اردیبهشت", temperate: "اسفند تا فروردین", warm: "اسفند", dry: "فروردین", humid: "فروردین" },
    waterNeedMm: 850,
    maxEc: 4,
    soils: ["loam", "clay"],
    frostTolerance: "low",
    daysToHarvest: [170, 200],
    yieldTPerHa: [45, 65],
    costPerHaToman: [80_000_000, 110_000_000],
    pricePerKgToman: [2_500, 3_500],
    liveMarket: true,
    notes: ["قرارداد با کارخانهٔ قند، ریسک فروش را کم می‌کند.", "به آب و تغذیهٔ زیاد نیاز دارد."],
  },
};

export interface Factor {
  key: string;
  label: string;
  status: "good" | "warn" | "bad" | "unknown";
  detail: string;
  weight: number;
}

export interface CropPlan {
  crop: CropSpec;
  score: number;
  verdict: "مناسب" | "با احتیاط" | "پیشنهاد نمی‌شود";
  factors: Factor[];
  window: string;
  water: { needM3: number; availableM3: number | null; gapM3: number | null; note: string };
  economics: { costToman: [number, number]; revenueToman: [number, number]; profitToman: [number, number]; perHaProfit: [number, number] };
  risks: string[];
  questions: string[];
  confidence: "بالا" | "متوسط" | "کم";
  needsLiveData: string[];
}

const num = (value: number) => Math.round(value);

export function estimateWater(crop: CropSpec, areaHa: number): number {
  // ۱ میلی‌متر روی ۱ هکتار = ۱۰ متر مکعب
  return num(crop.waterNeedMm * 10 * areaHa);
}

export function planCrop(cropId: CropId, farm: FarmProfile, weather?: WeatherSnapshot): CropPlan {
  const crop = CROPS[cropId];
  const factors: Factor[] = [];
  const risks: string[] = [];
  const questions: string[] = [];
  /** عامل بازدارنده: هر امتیاز دیگری را زیر ۵۰ می‌آورد. */
  let hardBlock = false;

  // ۱) پنجرهٔ اقلیمی
  const window = crop.windows[farm.climate];
  factors.push({ key: "climate", label: "اقلیم و پنجرهٔ کاشت", status: "good", detail: `برای اقلیم ${labelClimate(farm.climate)}: ${window}`, weight: 25 });

  // ۲) آب
  const needM3 = estimateWater(crop, farm.areaHa);
  const availableM3 = typeof farm.waterM3PerHa === "number" ? num(farm.waterM3PerHa * farm.areaHa) : null;
  const gapM3 = availableM3 === null ? null : num(availableM3 - needM3);
  if (farm.waterSource === "rain" && crop.waterNeedMm > 350) {
    factors.push({ key: "water", label: "تأمین آب", status: "bad", detail: `نیاز آبی ${crop.waterNeedMm} میلی‌متر با کشت دیم جبران نمی‌شود.`, weight: 30 });
    risks.push("کمبود آب: کشت دیم برای این محصول پرریسک است.");
    hardBlock = true;
  } else if (availableM3 === null) {
    factors.push({ key: "water", label: "تأمین آب", status: "unknown", detail: "حجم آب در دسترس ثبت نشده است.", weight: 30 });
    questions.push("در کل فصل چند متر مکعب آب در دسترس دارید (یا چند ساعت پمپاژ در هفته)؟");
  } else if ((gapM3 ?? 0) < 0) {
    factors.push({ key: "water", label: "تأمین آب", status: "warn", detail: `کمبود حدود ${num(Math.abs(gapM3!) / 10)} میلی‌متر در هکتار.`, weight: 30 });
    risks.push("کمبود آب: آبیاری باید کاهش یا محصول کم‌آب‌برتر انتخاب شود.");
  } else {
    factors.push({ key: "water", label: "تأمین آب", status: "good", detail: `آب در دسترس برای نیاز ${crop.waterNeedMm} میلی‌متری کافی است.`, weight: 30 });
  }

  // ۳) خاک و شوری
  if (!crop.soils.includes(farm.soil)) {
    factors.push({ key: "soil", label: "خاک", status: "warn", detail: `خاک ${labelSoil(farm.soil)} برای ${crop.name} مناسب نیست.`, weight: 15 });
    risks.push("خاک نامناسب: اصلاح یا انتخاب محصول دیگر لازم است.");
  } else {
    factors.push({ key: "soil", label: "خاک", status: "good", detail: `خاک ${labelSoil(farm.soil)} مناسب است.`, weight: 15 });
  }
  if (typeof farm.salinityEc === "number") {
    if (farm.salinityEc > crop.maxEc) {
      factors.push({ key: "salinity", label: "شوری خاک", status: "bad", detail: `EC ${farm.salinityEc} از تحمل ${crop.maxEc} بیشتر است.`, weight: 20 });
      risks.push("شوری: جوانه‌زنی و عملکرد کاهش می‌یابد؛ آبشویی یا محصول مقاوم‌تر لازم است.");
      if (farm.salinityEc > crop.maxEc * 1.5) hardBlock = true;
    } else {
      factors.push({ key: "salinity", label: "شوری خاک", status: "good", detail: `EC ${farm.salinityEc} در محدودهٔ تحمل است.`, weight: 20 });
    }
  } else {
    factors.push({ key: "salinity", label: "شوری خاک", status: "unknown", detail: "شوری خاک ثبت نشده است.", weight: 20 });
    questions.push("آزمایش خاک دارید؟ EC (شوری) خاک چقدر است؟");
  }

  // ۴) سرما و هوا
  if (weather) {
    const min = Math.min(...weather.days.map((day) => day.minTemp));
    if (crop.frostTolerance === "low" && min < 5) {
      factors.push({ key: "weather", label: "دمای ۱۰ روز آینده", status: "bad", detail: `کمینهٔ دما ${min}° است و این محصول به سرما حساس است.`, weight: 25 });
      risks.push("سرمای نزدیک: کاشت را عقب بیندازید.");
    } else {
      factors.push({ key: "weather", label: "دمای ۱۰ روز آینده", status: "good", detail: `کمینهٔ دما ${min}° برای این محصول قابل قبول است.`, weight: 25 });
    }
    const rain = weather.days.reduce((sum, day) => sum + day.rainMm, 0);
    if (rain > 60) risks.push("بارش سنگین نزدیک: خطر شسته شدن بذر و بیماری قارچی.");
  } else {
    factors.push({ key: "weather", label: "هوا", status: "unknown", detail: "پیش‌بینی هوا دریافت نشده است.", weight: 25 });
    questions.push("برای تصمیم دقیق‌تر، پیش‌بینی ۱۰ روزهٔ منطقه لازم است؛ اجازهٔ جست‌وجو می‌دهید؟");
  }

  // ۵) بودجه
  if (typeof farm.budgetToman === "number") {
    if (farm.budgetToman < crop.costPerHaToman[0] * farm.areaHa) {
      factors.push({ key: "budget", label: "بودجه", status: "bad", detail: "بودجه برای حداقل هزینهٔ این محصول کافی نیست.", weight: 15 });
      risks.push("بودجه: ممکن است نهاده یا آبیاری ناقص بماند.");
    } else {
      factors.push({ key: "budget", label: "بودجه", status: "good", detail: "بودجه برای هزینهٔ برآوردی کافی است.", weight: 15 });
    }
  } else {
    factors.push({ key: "budget", label: "بودجه", status: "unknown", detail: "بودجه ثبت نشده است.", weight: 15 });
    questions.push("بودجهٔ تقریبی این فصل چقدر است؟");
  }

  // امتیاز: از ۱۰۰
  const totalWeight = factors.reduce((sum, factor) => sum + factor.weight, 0);
  const earned = factors.reduce((sum, factor) => {
    const ratio = factor.status === "good" ? 1 : factor.status === "warn" ? 0.5 : factor.status === "unknown" ? 0.4 : 0;
    return sum + factor.weight * ratio;
  }, 0);
  const rawScore = Math.round((earned / totalWeight) * 100);
  const score = hardBlock ? Math.min(rawScore, 40) : rawScore;

  const verdict = score >= 75 ? "مناسب" : score >= 50 ? "با احتیاط" : "پیشنهاد نمی‌شود";
  const confidence = questions.length === 0 ? "بالا" : questions.length <= 1 ? "متوسط" : "کم";

  const area = Math.max(0, farm.areaHa);
  const costToman: [number, number] = [num(crop.costPerHaToman[0] * area), num(crop.costPerHaToman[1] * area)];
  const revenueToman: [number, number] = [
    num(crop.yieldTPerHa[0] * 1000 * area * crop.pricePerKgToman[0]),
    num(crop.yieldTPerHa[1] * 1000 * area * crop.pricePerKgToman[1]),
  ];
  const profitToman: [number, number] = [revenueToman[0] - costToman[1], revenueToman[1] - costToman[0]];

  return {
    crop,
    score,
    verdict,
    factors,
    window,
    water: {
      needM3,
      availableM3,
      gapM3,
      note: availableM3 === null ? "حجم آب را وارد کنید تا تراز آبی حساب شود." : gapM3! >= 0 ? "تراز آب مثبت است." : "کمبود آب؛ برنامهٔ آبیاری را بازبینی کنید.",
    },
    economics: {
      costToman,
      revenueToman,
      profitToman,
      perHaProfit: [num(profitToman[0] / Math.max(area, 1)), num(profitToman[1] / Math.max(area, 1))],
    },
    risks,
    questions: questions.slice(0, 2),
    confidence,
    needsLiveData: crop.liveMarket ? ["قیمت روز بازار", "پیش‌بینی ۱۰ روزهٔ هوا", "تعرفه/بیمهٔ همان استان"] : [],
  };
}

/** رتبه‌بندی محصولات برای یک مزرعه؛ بهترین سه تا. */
export function rankCrops(farm: FarmProfile, weather?: WeatherSnapshot): CropPlan[] {
  return (Object.keys(CROPS) as CropId[])
    .map((id) => planCrop(id, farm, weather))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/** توصیهٔ کوتاه برای چت، بدون عدد ساختگی. */
export function summarizePlan(plan: CropPlan): string {
  const lines = [
    `${plan.crop.name}: ${plan.verdict} (امتیاز ${plan.score} از ۱۰۰)`,
    `پنجرهٔ کاشت: ${plan.window}`,
    `آب: نیاز ${plan.water.needM3.toLocaleString("fa-IR")} متر مکعب${plan.water.availableM3 === null ? "" : ` — در دسترس ${plan.water.availableM3.toLocaleString("fa-IR")}`}`,
    `سود برآوردی: ${plan.economics.profitToman[0].toLocaleString("fa-IR")} تا ${plan.economics.profitToman[1].toLocaleString("fa-IR")} تومان (بازهٔ راهنما)`,
  ];
  if (plan.risks.length) lines.push(`ریسک‌ها: ${plan.risks.join("، ")}`);
  if (plan.questions.length) lines.push(`برای دقیق‌تر شدن: ${plan.questions[0]}`);
  if (plan.needsLiveData.length) lines.push(`دادهٔ زندهٔ لازم: ${plan.needsLiveData.join("، ")}`);
  return lines.join("\n");
}

function labelClimate(value: ClimateZone): string {
  return { cold: "سرد", temperate: "معتدل", warm: "گرم", dry: "خشک", humid: "مرطوب" }[value];
}
function labelSoil(value: SoilType): string {
  return { clay: "رسی", loam: "لومی", sandy: "شنی", saline: "شور" }[value];
}

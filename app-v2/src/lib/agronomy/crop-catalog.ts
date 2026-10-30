/**
 * امتیازدهی همهٔ محصولات فهرست بر پایهٔ اقلیم، پنجرهٔ کاشت همان ماه، آب، خاک و
 * محصولات اصلی همان استان. نتیجه «برآورد اولیه» است و جای تحلیل تفصیلی کشاورزیار را نمی‌گیرد؛
 * هیچ نتیجه‌ای از قبل ذخیره نمی‌شود.
 */
import { PRODUCTS, type ProductCategory } from "../products";
import type { ClimateZone, FarmProfile, SoilType } from "../ai/agronomy-planner";

export interface CatalogScore {
  name: string;
  category: ProductCategory;
  score: number;
  verdict: "مناسب" | "با احتیاط" | "پیشنهاد نمی‌شود";
  window: string;
  note: string;
}

interface Rule {
  climates: ClimateZone[];
  waterMm: number;
  soils: SoilType[];
  /** ماه‌های شمسی مناسب کاشت. */
  sow: number[];
  /** محصول اصلی این استان‌ها. */
  regions: string[];
  /** در این استان‌ها به‌دلیل اقلیم/بازار توصیه نمی‌شود. */
  avoid: string[];
  note: string;
  market: number;
  perennial: boolean;
}

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

const BASE: Omit<Rule, "note"> = {
  climates: ["cold", "temperate", "dry"],
  waterMm: 500,
  soils: ["loam", "clay"],
  sow: [7, 8, 9, 10],
  regions: [],
  avoid: [],
  market: 2,
  perennial: false,
};

const CATEGORY_RULES: Record<ProductCategory, Omit<Rule, "note">> = {
  "غلات": { ...BASE, market: 3, sow: [7, 8, 9, 10] },
  "دانه‌های روغنی": { ...BASE, climates: ["cold", "temperate"], sow: [6, 7, 8], market: 3 },
  "نباتات علوفه‌ای": { ...BASE, climates: ["cold", "temperate", "warm", "humid"], waterMm: 650, sow: [2, 3, 7, 8], market: 2 },
  "سبزیجات": { ...BASE, climates: ["temperate", "warm", "humid"], waterMm: 600, soils: ["loam", "sandy"], sow: [7, 8, 9, 10, 11], market: 2 },
  "صیفی‌جات": { ...BASE, climates: ["warm", "humid", "temperate"], waterMm: 700, soils: ["sandy", "loam"], sow: [2, 3, 4, 5], market: 3 },
  "میوه و درخت": { ...BASE, climates: ["temperate", "warm"], waterMm: 650, sow: [11, 12, 1, 2], market: 3, perennial: true },
  "حبوبات": { ...BASE, climates: ["cold", "temperate", "dry"], waterMm: 350, soils: ["loam", "sandy"], sow: [8, 9, 10, 11], market: 2 },
  "صنعتی و نقدی": { ...BASE, climates: ["temperate", "warm", "dry"], waterMm: 550, sow: [7, 8, 9], market: 3 },
  "دامی و طیور": { ...BASE, climates: [], waterMm: 0, soils: [], sow: [], market: 0 },
};

/** استثناهای مهم؛ اگر محصولی اینجا نباشد، قاعدهٔ دسته‌اش استفاده می‌شود. */
const SPECIAL: Record<string, Partial<Rule>> = {
  "گندم": { climates: ["cold", "temperate", "dry", "humid"], sow: [7, 8, 9, 10], market: 5, note: "کشت پاییزه؛ رقم مناسب منطقه و تناوب با کلزا/حبوبات" },
  "جو": { climates: ["cold", "temperate", "dry", "humid"], sow: [7, 8, 9, 10], market: 4, note: "مقاوم‌تر به شوری و کم‌آبی از گندم؛ کشت پاییزه" },
  "کلزا": { climates: ["cold", "temperate", "humid"], sow: [6, 7, 8], market: 5, note: "کشت پاییزه؛ تناوب با گندم و توجه به بور" },
  "برنج": { climates: ["humid", "temperate"], waterMm: 1000, soils: ["clay", "loam"], sow: [2, 3], market: 5, note: "آب فراوان و خاک سنگین؛ نشاکاری اردیبهشت" },
  "شلتوک": { climates: ["humid", "temperate"], waterMm: 1000, soils: ["clay", "loam"], sow: [2, 3], market: 5, note: "همان برنج؛ خشک‌کردن و شلتوک" },
  "ذرت": { climates: ["temperate", "warm"], waterMm: 600, sow: [3, 4, 5], market: 3, note: "گرماپسند؛ آبیاری منظم" },
  "ذرت علوفه‌ای": { climates: ["temperate", "warm"], waterMm: 600, sow: [3, 4, 5], market: 3, note: "برداشت شیری برای سیلو" },
  "ارزن": { climates: ["warm", "dry"], waterMm: 300, soils: ["sandy", "loam"], sow: [4, 5, 6], market: 1, note: "کم‌آب‌بر و گرماپسند" },
  "ترتیکاله": { climates: ["cold", "temperate"], sow: [7, 8, 9], market: 2, note: "علوفه/دانه؛ مقاوم به سرما" },
  "چاودار": { climates: ["cold", "temperate", "dry"], waterMm: 400, sow: [7, 8, 9], market: 2, note: "مقاوم به سرما و خاک ضعیف" },
  "یولاف": { climates: ["cold", "temperate"], sow: [7, 8, 9], market: 2, note: "علوفه/دانه؛ خاک مرطوب" },
  "تخم آفتابگردان": { climates: ["temperate", "warm"], sow: [3, 4, 5], market: 3, note: "گرماپسند؛ زنبور برای گرده‌افشانی" },
  "کنجد": { climates: ["warm", "dry"], waterMm: 400, sow: [4, 5], market: 2, note: "گرماپسند؛ حساس به آب‌گرفتگی" },
  "سویا": { climates: ["humid", "temperate"], waterMm: 600, sow: [4, 5], market: 4, note: "تابستانه؛ در گلستان کشت می‌شود" },
  "بادام زمینی": { climates: ["warm", "humid"], waterMm: 500, soils: ["sandy", "loam"], sow: [3, 4], market: 2, note: "خاک سبک و گرمای کافی" },
  "گلرنگ": { climates: ["dry", "temperate"], waterMm: 450, sow: [7, 8, 9], market: 2, note: "مقاوم به خشکی؛ جایگزین کلزا" },
  "یونجه": { climates: ["cold", "temperate", "warm", "dry"], waterMm: 700, sow: [2, 3, 7, 8], market: 4, perennial: true, note: "چندساله؛ چند چین در سال" },
  "شبدر": { climates: ["cold", "temperate", "humid"], waterMm: 650, sow: [7, 8, 9], market: 2, note: "علوفهٔ پاییزه؛ خاک مرطوب" },
  "اسپرس": { climates: ["cold", "temperate"], waterMm: 500, sow: [2, 3], market: 2, perennial: true, note: "چندساله؛ مقاوم به خشکی" },
  "سیب‌زمینی": { climates: ["cold", "temperate"], waterMm: 550, soils: ["sandy", "loam"], sow: [1, 2, 3], market: 4, note: "خاک سبک؛ تناوب چهارساله" },
  "پیاز": { climates: ["temperate", "warm", "dry"], waterMm: 500, soils: ["loam", "sandy"], sow: [8, 9, 10], market: 4, note: "نشاکاری/کاشت سوخ در پاییز" },
  "سیر": { climates: ["cold", "temperate"], waterMm: 450, soils: ["loam", "sandy"], sow: [8, 9, 10], market: 4, note: "کاشت پاییزه؛ برداشت بهار" },
  "هویج": { climates: ["cold", "temperate"], waterMm: 450, soils: ["sandy", "loam"], sow: [2, 3, 7, 8], market: 3, note: "خاک نرم و عمیق" },
  "چغندرقند": { climates: ["cold", "temperate"], waterMm: 600, sow: [1, 2, 3], market: 4, note: "قرارداد کارخانهٔ قند؛ بهار" },
  "کلم": { climates: ["cold", "temperate", "humid"], waterMm: 500, sow: [7, 8, 9, 10], market: 3, note: "سبزی برگ پاییزه/زمستانه" },
  "کاهو": { climates: ["cold", "temperate", "humid"], waterMm: 400, sow: [7, 8, 9, 10], market: 3, note: "سبزی برگ پاییزه" },
  "اسفناج": { climates: ["cold", "temperate", "humid"], waterMm: 350, sow: [7, 8, 9, 10], market: 3, note: "سبزی برگ پاییزه" },
  "تربچه": { climates: ["cold", "temperate", "humid"], waterMm: 300, sow: [7, 8, 9, 10], market: 2, note: "سبزی ریشه‌ای کوتاه‌دوره" },
  "شلغم": { climates: ["cold", "temperate", "humid"], waterMm: 300, sow: [7, 8, 9, 10], market: 2, note: "سبزی ریشه‌ای پاییزه" },
  "کرفس": { climates: ["cold", "temperate", "humid"], waterMm: 500, sow: [7, 8, 9], market: 3, note: "نشاکاری پاییزه؛ آب منظم" },
  "جعفری": { climates: ["cold", "temperate", "humid"], waterMm: 350, sow: [8, 9, 10], market: 3, note: "سبزی برگی؛ بازار نزدیک" },
  "ریحان": { climates: ["warm", "temperate"], waterMm: 400, sow: [3, 4, 5], market: 2, note: "گرماپسند؛ حساس به سرما" },
  "نعناع": { climates: ["cold", "temperate", "humid"], waterMm: 500, sow: [7, 8, 9], market: 2, perennial: true, note: "چندساله؛ خاک مرطوب" },
  "بامیه": { climates: ["warm", "humid"], waterMm: 500, sow: [3, 4, 5], market: 2, note: "گرماپسند؛ در آبان دیگر دیر است" },
  "گوجه‌فرنگی": { climates: ["warm", "temperate"], waterMm: 600, sow: [2, 3, 4], market: 4, note: "نشاکاری بهاره؛ آبیاری منظم" },
  "خیار": { climates: ["warm", "temperate", "humid"], waterMm: 600, sow: [2, 3, 4], market: 4, note: "گرماپسند؛ گلخانه/زمینی" },
  "فلفل": { climates: ["warm", "temperate"], waterMm: 550, sow: [2, 3, 4], market: 3, note: "نشاکاری بهاره" },
  "بادمجان": { climates: ["warm", "temperate"], waterMm: 600, sow: [2, 3, 4], market: 3, note: "گرماپسند" },
  "کدو": { climates: ["warm", "temperate"], waterMm: 550, sow: [3, 4, 5], market: 2, note: "گرماپسند" },
  "هندوانه": { climates: ["warm", "dry"], waterMm: 600, soils: ["sandy", "loam"], sow: [2, 3], market: 4, note: "گرما و خاک سبک؛ در گلستان کشت می‌شود" },
  "خربزه": { climates: ["warm", "dry"], waterMm: 600, soils: ["sandy", "loam"], sow: [2, 3], market: 4, note: "گرما و خاک سبک" },
  "طالبی": { climates: ["warm", "dry"], waterMm: 600, soils: ["sandy", "loam"], sow: [2, 3], market: 3, note: "گرما و خاک سبک" },
  "شه‌دانه": { climates: ["warm", "dry"], waterMm: 600, soils: ["sandy", "loam"], sow: [2, 3], market: 2, note: "گرما و خاک سبک" },
  "زعفران": { climates: ["dry", "cold", "temperate"], waterMm: 300, soils: ["loam", "sandy"], sow: [4, 5, 6], market: 5, perennial: true, note: "کاشت پیاز در تابستان؛ برداشت پاییز؛ نیازمند زمستان سرد و تابستان خشک" },
  "پسته": { climates: ["dry", "warm"], waterMm: 600, soils: ["sandy", "loam"], sow: [11, 12, 1, 2], market: 5, perennial: true, note: "درخت چندساله؛ تابستان خشک و گرم" },
  "خرما": { climates: ["warm", "dry"], waterMm: 900, soils: ["sandy", "loam"], sow: [11, 12, 1, 2], market: 5, perennial: true, note: "گرمای طولانی؛ آب شور‌تحمل" },
  "چای": { climates: ["humid"], waterMm: 1200, soils: ["loam"], sow: [10, 11, 12], market: 4, perennial: true, note: "فقط شمال؛ خاک اسیدی" },
  "نیشکر": { climates: ["warm", "humid"], waterMm: 1500, soils: ["clay"], sow: [1, 2], market: 4, perennial: true, note: "آب و گرمای زیاد؛ قرارداد کارخانه" },
  "پنبه": { climates: ["warm", "dry", "temperate"], waterMm: 700, sow: [3, 4], market: 4, note: "گرمای کافی تا رسیدن؛ در گلستان کشت می‌شود" },
  "تنباکو": { climates: ["warm", "temperate"], waterMm: 600, sow: [3, 4], market: 3, note: "قرارداد خرید؛ نشاکاری" },
  "لوبیا": { climates: ["temperate", "warm"], waterMm: 450, sow: [3, 4, 5], market: 3, note: "تابستانه؛ آبیاری منظم" },
  "نخود": { climates: ["cold", "temperate", "dry"], waterMm: 300, sow: [8, 9, 10, 11], market: 3, note: "کشت پاییزه/بهاره؛ کم‌آب" },
  "عدس": { climates: ["cold", "temperate", "dry"], waterMm: 300, sow: [8, 9, 10, 11], market: 3, note: "کشت پاییزه؛ کم‌آب" },
  "ماش": { climates: ["warm", "temperate"], waterMm: 400, sow: [3, 4, 5], market: 2, note: "تابستانه؛ کوتاه‌دوره" },
  "باقلا": { climates: ["cold", "temperate", "humid"], waterMm: 400, sow: [8, 9, 10, 11], market: 3, note: "کشت پاییزه؛ مقاوم به سرما" },
};

const REGION_MAJOR: Record<string, string[]> = {
  "گلستان": ["گندم", "جو", "کلزا", "سویا", "پنبه", "برنج", "هندوانه", "خیار", "گوجه‌فرنگی", "سیب‌زمینی", "یونجه"],
  "مازندران": ["برنج", "کلزا", "گندم", "جو", "چای", "پرتقال", "نارنگی", "کیوی"],
  "گیلان": ["برنج", "چای", "کلزا", "گندم", "جو", "پرتقال", "نارنگی"],
  "اردبیل": ["گندم", "جو", "کلزا", "چغندرقند", "سیب‌زمینی", "یونجه"],
  "خوزستان": ["گندم", "جو", "نیشکر", "خرما", "برنج", "پنبه", "گوجه‌فرنگی"],
  "خراسان رضوی": ["گندم", "جو", "زعفران", "پسته", "چغندرقند", "پنبه", "سیب‌زمینی"],
  "کرمان": ["پسته", "زعفران", "گندم", "خرما", "سیب‌زمینی"],
  "یزد": ["زعفران", "پسته", "گندم", "جو", "انار", "خرما"],
  "اصفهان": ["زعفران", "پسته", "گندم", "جو", "چغندرقند", "سیب‌زمینی"],
  "فارس": ["گندم", "جو", "زعفران", "پسته", "چغندرقند", "پنبه", "انار"],
  "آذربایجان غربی": ["چغندرقند", "گندم", "جو", "سیب", "انگور", "یونجه"],
  "آذربایجان شرقی": ["چغندرقند", "گندم", "جو", "سیب", "انگور", "یونجه"],
  "همدان": ["گندم", "جو", "سیب‌زمینی", "چغندرقند", "یونجه"],
  "کرمانشاه": ["گندم", "جو", "کلزا", "چغندرقند", "نخود"],
  "تهران": ["گندم", "جو", "کلزا", "سیب‌زمینی", "یونجه"],
  "مرکزی": ["گندم", "جو", "چغندرقند", "سیب‌زمینی", "یونجه"],
  "گلستان شمالی": [],
};

const REGION_AVOID: Record<string, string[]> = {
  "گلستان": ["زعفران", "پسته", "خرما", "چای", "نیشکر"],
  "مازندران": ["زعفران", "پسته", "خرما", "پنبه", "نیشکر"],
  "گیلان": ["زعفران", "پسته", "خرما", "پنبه", "نیشکر"],
  "اردبیل": ["خرما", "پسته", "نیشکر", "چای", "برنج"],
  "خوزستان": ["زعفران", "چای", "پسته"],
  "خراسان رضوی": ["چای", "نیشکر", "خرما"],
  "کرمان": ["چای", "نیشکر", "برنج"],
  "یزد": ["چای", "نیشکر", "برنج", "خرما"],
  "اصفهان": ["چای", "نیشکر", "خرما", "برنج"],
  "فارس": ["چای", "نیشکر", "برنج"],
  "آذربایجان غربی": ["خرما", "پسته", "چای", "نیشکر"],
  "آذربایجان شرقی": ["خرما", "پسته", "چای", "نیشکر"],
  "همدان": ["خرما", "پسته", "چای", "نیشکر", "برنج"],
};

const CITY_TO_PROVINCE: Record<string, string> = {
  "انبارالوم": "گلستان", "انبارآلوم": "گلستان", "آق قلا": "گلستان", "گرگان": "گلستان", "گنبد": "گلستان", "علی آباد": "گلستان", "بندر ترکمن": "گلستان",
  "رشت": "گیلان", "بندر انزلی": "گیلان", "لاهیجان": "گیلان",
  "ساری": "مازندران", "بابل": "مازندران", "آمل": "مازندران", "بهشهر": "مازندران",
  "اردبیل": "اردبیل", "پارس آباد": "اردبیل", "مشگین": "اردبیل",
  "اهواز": "خوزستان", "دزفول": "خوزستان", "شوشتر": "خوزستان",
  "مشهد": "خراسان رضوی", "نیشابور": "خراسان رضوی", "تربت": "خراسان رضوی",
  "کرمان": "کرمان", "رفسنجان": "کرمان", "بم": "کرمان",
  "یزد": "یزد", "میبد": "یزد", "اردکان": "یزد",
  "اصفهان": "اصفهان", "کاشان": "اصفهان", "شهرضا": "اصفهان",
  "شیراز": "فارس", "مرودشت": "فارس", "داراب": "فارس",
  "ارومیه": "آذربایجان غربی", "خوی": "آذربایجان غربی", "میاندوآب": "آذربایجان غربی",
  "تبریز": "آذربایجان شرقی", "مراغه": "آذربایجان شرقی",
  "همدان": "همدان", "ملایر": "همدان",
  "کرمانشاه": "کرمانشاه", "تهران": "تهران", "اراک": "مرکزی",
};

const clean = (value: string) => String(value ?? "").replace(/[يى]/g, "ی").replace(/ك/g, "ک").replace(/استان|شهرستان|شهر|منطقه|روستای|روستا/g, " ").replace(/\s+/g, " ").trim();

function regionsOf(farm: FarmProfile): string[] {
  const text = clean(farm.region);
  const found = new Set<string>();
  for (const province of Object.keys(REGION_MAJOR)) if (text.includes(province)) found.add(province);
  for (const [city, province] of Object.entries(CITY_TO_PROVINCE)) if (text.includes(city)) found.add(province);
  return [...found];
}

function monthScore(sow: number[], month: number): number {
  if (sow.length === 0) return 0;
  if (sow.includes(month)) return 28;
  const distance = Math.min(...sow.map((value) => Math.min(Math.abs(value - month), 12 - Math.abs(value - month))));
  if (distance === 1) return 14;
  if (distance === 2) return 5;
  return 0;
}

function windowLabel(sow: number[]): string {
  if (!sow.length) return "—";
  const sorted = [...sow].sort((a, b) => a - b);
  const continuous = sorted.every((value, index) => index === 0 || value === sorted[index - 1] + 1);
  return continuous ? `${MONTHS[sorted[0] - 1]} تا ${MONTHS[sorted[sorted.length - 1] - 1]}` : sorted.map((value) => MONTHS[value - 1]).join("، ");
}

export function scoreCatalog(farm: FarmProfile, month = 8): CatalogScore[] {
  const province = regionsOf(farm);
  return PRODUCTS.filter((item) => item.category !== "دامی و طیور" && !["کاه و کلش", "سیلوی ذرت", "علوفه"].includes(item.name))
    .map((item) => {
      const base = CATEGORY_RULES[item.category];
      const special = SPECIAL[item.name] ?? {};
      const rule: Rule = {
        climates: special.climates ?? base.climates,
        waterMm: special.waterMm ?? base.waterMm,
        soils: special.soils ?? base.soils,
        sow: special.sow ?? base.sow,
        regions: special.regions ?? [],
        avoid: special.avoid ?? [],
        note: special.note ?? "",
        market: special.market ?? base.market,
        perennial: special.perennial ?? base.perennial,
      };
      const climateScore = rule.climates.includes(farm.climate) ? 28 : 4;
      const seasonScore = monthScore(rule.sow, month);
      const waterScore = farm.waterSource === "rain" ? (rule.waterMm <= 350 ? 18 : rule.waterMm <= 500 ? 7 : 0) : rule.waterMm <= 600 ? 18 : rule.waterMm <= 900 ? 12 : 7;
      const soilScore = rule.soils.includes(farm.soil) ? 9 : 2;
      const major = province.some((area) => REGION_MAJOR[area]?.includes(item.name));
      const avoid = province.some((area) => REGION_AVOID[area]?.includes(item.name));
      const regionScore = avoid ? -15 : major ? 6 : 0;
      const perennialPenalty = rule.perennial ? -6 : 0;
      const rainPenalty = farm.waterSource === "rain" && rule.waterMm > 700 ? 15 : 0;
      let score = Math.max(0, Math.min(100, Math.round(climateScore + seasonScore + waterScore + soilScore + regionScore + rule.market + perennialPenalty - rainPenalty)));
      const offSeason = seasonScore === 0 && rule.sow.length > 0;
      if (offSeason) score = Math.min(score, 45);
      const verdict: CatalogScore["verdict"] = score >= 75 ? "مناسب" : score >= 50 ? "با احتیاط" : "پیشنهاد نمی‌شود";
      const note = [rule.note, avoid ? "در این استان توصیه نمی‌شود." : major ? "از محصولات اصلی این استان است." : "", offSeason ? "ماه فعلی بیرون پنجرهٔ کاشت است." : ""].filter(Boolean).join(" ");
      return {
        name: item.name,
        category: item.category,
        score,
        verdict,
        window: windowLabel(rule.sow),
        note,
      };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "fa"));
}

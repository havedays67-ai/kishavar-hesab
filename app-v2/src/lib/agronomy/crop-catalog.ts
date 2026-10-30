/**
 * امتیازدهی سبک برای همهٔ محصولات فهرست، بر پایهٔ اقلیم/خاک/منبع آب.
 * این جدول «برآورد اولیه» است؛ تقویم دقیق هر محصول در بخش پژوهش همان محصول ساخته می‌شود.
 * هیچ نتیجه‌ای از قبل ذخیره نمی‌شود؛ همه‌چیز با مشخصات فعلی زمین محاسبه می‌شود.
 */
import { PRODUCTS, type ProductCategory } from "../products";
import { CROPS, planCrop, type ClimateZone, type CropId, type FarmProfile, type SoilType } from "../ai/agronomy-planner";

export interface CatalogScore {
  name: string;
  category: ProductCategory;
  score: number;
  verdict: "مناسب" | "با احتیاط" | "پیشنهاد نمی‌شود";
  window: string;
  note: string;
  detailedCropId?: CropId;
}

interface Rule {
  climates: ClimateZone[];
  waterMm: number;
  soils: SoilType[];
  window: string;
  note: string;
}

const CATEGORY_RULES: Record<ProductCategory, Rule> = {
  "غلات": { climates: ["cold", "temperate", "dry"], waterMm: 500, soils: ["loam", "clay"], window: "مهر تا آذر", note: "کشت پاییزه؛ تناوب با حبوبات" },
  "دانه‌های روغنی": { climates: ["cold", "temperate"], waterMm: 500, soils: ["loam", "clay"], window: "مهر تا آبان", note: "کشت پاییزه؛ توجه به بور" },
  "نباتات علوفه‌ای": { climates: ["cold", "temperate", "warm", "humid"], waterMm: 650, soils: ["loam", "clay"], window: "اسفند تا شهریور", note: "چند چین؛ نیاز آبی متوسط" },
  "سبزیجات": { climates: ["temperate", "warm", "humid"], waterMm: 600, soils: ["loam", "sandy"], window: "اسفند تا خرداد", note: "دورهٔ کوتاه؛ بازار نزدیک لازم است" },
  "صیفی‌جات": { climates: ["warm", "humid", "temperate"], waterMm: 700, soils: ["sandy", "loam"], window: "فروردین تا خرداد", note: "گرماپسند؛ آبیاری منظم" },
  "میوه و درخت": { climates: ["temperate", "warm"], waterMm: 650, soils: ["loam", "clay"], window: "اسفند تا فروردین", note: "چندساله؛ تصمیم بلندمدت" },
  "حبوبات": { climates: ["cold", "temperate", "dry"], waterMm: 350, soils: ["loam", "sandy"], window: "اسفند تا فروردین", note: "تثبیت ازت؛ آب کم" },
  "صنعتی و نقدی": { climates: ["temperate", "warm", "dry"], waterMm: 550, soils: ["loam", "clay"], window: "مهر تا فروردین", note: "قرارداد خرید را قبل از کاشت بررسی کن" },
  "دامی و طیور": { climates: [], waterMm: 0, soils: [], window: "—", note: "محصول زراعی نیست" },
};

const SPECIAL: Record<string, Partial<Rule>> = {
  "زعفران": { climates: ["dry", "cold", "temperate"], waterMm: 300, soils: ["loam", "sandy"], window: "تیر تا شهریور", note: "کاشت پیاز در تابستان؛ برداشت پاییز" },
  "پسته": { climates: ["dry", "warm"], waterMm: 600, soils: ["sandy", "loam"], window: "اسفند", note: "درخت چندساله؛ شوری را تحمل می‌کند" },
  "برنج": { climates: ["humid", "temperate"], waterMm: 1000, soils: ["clay", "loam"], window: "اردیبهشت تا خرداد", note: "آب فراوان و خاک سنگین لازم است" },
  "چای": { climates: ["humid"], waterMm: 1200, soils: ["loam"], window: "اسفند", note: "فقط شمال؛ اسیدیتهٔ خاک مهم است" },
  "نیشکر": { climates: ["warm", "humid"], waterMm: 1500, soils: ["clay"], window: "اسفند تا فروردین", note: "آب و گرماى زیاد؛ قرارداد کارخانه" },
  "خرما": { climates: ["warm", "dry"], waterMm: 900, soils: ["sandy", "loam"], window: "اسفند", note: "گرماى طولانی و آب شور‌تحمل" },
  "پنبه": { climates: ["warm", "dry"], waterMm: 700, soils: ["loam", "clay"], window: "اردیبهشت", note: "گرماى کافی تا رسیدن" },
  "چغندرقند": { climates: ["cold", "temperate"], waterMm: 600, soils: ["loam", "clay"], window: "فروردین", note: "قرارداد کارخانهٔ قند" },
  "سیب‌زمینی": { climates: ["cold", "temperate"], waterMm: 550, soils: ["sandy", "loam"], window: "اسفند", note: "خاک سبک؛ تناوب چهارساله" },
  "یونجه": { climates: ["cold", "temperate", "warm", "dry"], waterMm: 700, soils: ["loam", "clay"], window: "اسفند تا شهریور", note: "چندساله؛ چند چین در سال" },
  "ذرت": { climates: ["temperate", "warm"], waterMm: 600, soils: ["loam", "clay"], window: "فروردین تا خرداد", note: "گرماپسند؛ آبیاری منظم" },
  "ذرت علوفه‌ای": { climates: ["temperate", "warm"], waterMm: 600, soils: ["loam", "clay"], window: "فروردین تا خرداد", note: "برداشت شیری برای سیلو" },
  "گندم": { climates: ["cold", "temperate", "dry"], waterMm: 500, soils: ["loam", "clay"], window: "مهر تا آذر", note: "کشت پاییزه؛ رقم مناسب منطقه" },
  "جو": { climates: ["cold", "temperate", "dry"], waterMm: 450, soils: ["loam", "clay", "sandy"], window: "مهر تا آذر", note: "مقاوم‌تر به شوری و کم‌آبی" },
  "کلزا": { climates: ["cold", "temperate"], waterMm: 500, soils: ["loam", "clay"], window: "شهریور تا مهر", note: "کشت پاییزه؛ تناوب با گندم" },
};

const DETAILED: Record<string, CropId> = {
  "گندم": "wheat-irrigated",
  "جو": "barley",
  "کلزا": "canola",
  "ذرت علوفه‌ای": "corn-forage",
  "یونجه": "alfalfa",
  "پنبه": "cotton",
  "چغندرقند": "sugarbeet",
};

const verdictFor = (score: number): CatalogScore["verdict"] => (score >= 75 ? "مناسب" : score >= 50 ? "با احتیاط" : "پیشنهاد نمی‌شود");

export function scoreCatalog(farm: FarmProfile): CatalogScore[] {
  return PRODUCTS.filter((item) => item.category !== "دامی و طیور" && item.name !== "کاه و کلش" && item.name !== "سیلوی ذرت")
    .map((item) => {
      const rule = { ...CATEGORY_RULES[item.category], ...SPECIAL[item.name] } as Rule;
      const detailedId = item.name === "گندم" && farm.waterSource === "rain" ? "wheat-rainfed" : DETAILED[item.name];
      if (detailedId) {
        const plan = planCrop(detailedId, farm);
        return {
          name: item.name,
          category: item.category,
          score: plan.score,
          verdict: plan.verdict,
          window: CROPS[detailedId].windows[farm.climate],
          note: "جدول کارشناسی همین بخش؛ برای تقویم کامل انتخابش کن",
          detailedCropId: detailedId,
        };
      }
      const climateScore = rule.climates.includes(farm.climate) ? 45 : 15;
      const waterScore = farm.waterSource === "rain" ? (rule.waterMm <= 350 ? 25 : rule.waterMm <= 500 ? 10 : 0) : rule.waterMm <= 600 ? 25 : rule.waterMm <= 900 ? 18 : 10;
      const soilScore = rule.soils.includes(farm.soil) ? 15 : 7;
      const raw = climateScore + waterScore + soilScore + 15;
      const score = Math.max(0, Math.min(100, farm.waterSource === "rain" && rule.waterMm > 500 ? Math.min(35, raw) : raw));
      return { name: item.name, category: item.category, score, verdict: verdictFor(score), window: rule.window, note: rule.note };
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, "fa"));
}

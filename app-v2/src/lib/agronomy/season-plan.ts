/**
 * تقویم عملیات فصل — کود، سم، آبیاری و برداشت
 * ------------------------------------------------------------
 * جدول‌های کارشناسی برای ۸ محصول، نسبت به «تاریخ کاشت».
 * این فایل قطعی حساب می‌کند؛ مدل زبانی فقط توضیح می‌دهد.
 *
 * هشدار: دوزها «راهنمای عمومی» است؛ برچسب سم/کود و نظر کارشناس
 * منطقه همیشه مقدم است.
 */
import type { CropId } from "../ai/agronomy-planner";
import { dateToJalali, jalaliToDate, type JDate } from "../format";

export type TaskKind = "prep" | "planting" | "fertilizer" | "spray" | "irrigation" | "harvest";

export interface Operation {
  kind: TaskKind;
  /** روز نسبت به کاشت؛ منفی = قبل از کاشت. */
  offset: number;
  stage: string;
  title: string;
  detail: string;
  /** مقدار در هکتار (نهاده). */
  dosePerHa?: number;
  unit?: string;
  /** برای آبیاری: فاصلهٔ روز. */
  intervalDays?: number;
}

export interface CropSchedule {
  /** بازهٔ کاشت زودتر/دیرتر توصیه‌شده (روز) برای هشدار. */
  plantingWindowDays: [number, number];
  irrigationIntervalDays: number;
  operations: Operation[];
}

const N = (v: number) => v;

export const CROP_SCHEDULES: Record<CropId, CropSchedule> = {
  "wheat-irrigated": {
    plantingWindowDays: [-20, 20],
    irrigationIntervalDays: 12,
    operations: [
      { kind: "prep", offset: -14, stage: "آماده‌سازی", title: "شخم و دیسک", detail: "شخم عمیق + دیسک و تسطیح؛ کلوخه نماند تا بذر در تماس کامل با خاک باشد." },
      { kind: "fertilizer", offset: -7, stage: "قبل از کاشت (پایه)", title: "کود پایه", detail: "فسفر و پتاسیم کامل + یک‌سوم اوره پیش از کاشت و زیر خاک.", dosePerHa: N(250), unit: "کیلوگرم" },
      { kind: "planting", offset: 0, stage: "کاشت", title: "کاشت بذر", detail: "عمق ۴ تا ۶ سانتی‌متر، تراکم ۱۸۰ تا ۲۲۰ کیلوگرم بذر در هکتار.", dosePerHa: N(200), unit: "کیلوگرم بذر" },
      { kind: "spray", offset: 25, stage: "۲ تا ۳ برگی", title: "علف‌کش پهن‌برگ", detail: "سم‌پاشی در هوای آرام و دمای ۱۰ تا ۲۵ درجه؛ از ۲,۴-D در مرحلهٔ پنجه‌زنی پرهیز کن.", dosePerHa: N(1), unit: "لیتر" },
      { kind: "fertilizer", offset: 40, stage: "پنجه‌زنی", title: "سرک اوره (مرحلهٔ ۱)", detail: "اوره همراه آبیاری؛ اگر بارش کافی است در هوای خشک نپاش.", dosePerHa: N(100), unit: "کیلوگرم" },
      { kind: "fertilizer", offset: 70, stage: "ساقه‌روی", title: "سرک اوره (مرحلهٔ ۲)", detail: "مصرف بیش از ۵۰ کیلوگرم در این مرحله خواب‌افتادگی می‌آورد.", dosePerHa: N(50), unit: "کیلوگرم" },
      { kind: "spray", offset: 75, stage: "ساقه‌روی", title: "قارچ‌کش زنگ", detail: "پیشگیری از زنگ زرد/قهوه‌ای؛ در رقم حساس و هوای مرطوب تکرار شود.", dosePerHa: N(0.5), unit: "لیتر" },
      { kind: "spray", offset: 100, stage: "سنبله‌دهی", title: "سن گندم", detail: "پایش مزرعه؛ فقط در آستانهٔ زیان اقتصادی سم بزن.", dosePerHa: N(0.3), unit: "لیتر" },
      { kind: "irrigation", offset: 130, stage: "دانه‌بندی", title: "آبیاری بحرانی", detail: "مرحلهٔ دانه‌بندی و پر شدن دانه حساس‌ترین زمان کم‌آبی است." },
      { kind: "harvest", offset: 225, stage: "برداشت", title: "برداشت", detail: "رطوبت دانه زیر ۱۴٪؛ با کمباین تنظیم‌شده تا ریزش کم شود." },
    ],
  },
  "wheat-rainfed": {
    plantingWindowDays: [-20, 20],
    irrigationIntervalDays: 0,
    operations: [
      { kind: "prep", offset: -20, stage: "آماده‌سازی", title: "خاک‌ورزی حفاظتی", detail: "حفظ بقایای سال قبل برای نگه‌داشتن رطوبت؛ شخم سنگین نزن." },
      { kind: "fertilizer", offset: -7, stage: "قبل از کاشت", title: "کود پایه", detail: "فسفر کامل + اورهٔ کم؛ در دیم مصرف زیاد اوره ریسک است.", dosePerHa: N(150), unit: "کیلوگرم" },
      { kind: "planting", offset: 0, stage: "کاشت", title: "کاشت دیم", detail: "انتظار بارش مؤثر (حداقل ۱۵ میلی‌متر) پیش از کاشت.", dosePerHa: N(160), unit: "کیلوگرم بذر" },
      { kind: "fertilizer", offset: 45, stage: "پنجه‌زنی", title: "سرک اوره (اگر بارش بود)", detail: "فقط وقتی رطوبت خاک کافی است؛ در خشکی سال مصرف نکن.", dosePerHa: N(60), unit: "کیلوگرم" },
      { kind: "spray", offset: 35, stage: "علف‌های هرز", title: "علف‌کش", detail: "قبل از خشکی هوا و در مرحلهٔ رشدی زودتر از پنجه‌زنی." },
      { kind: "harvest", offset: 215, stage: "برداشت", title: "برداشت", detail: "در دیم، برداشت زودتر از ریزش جلوگیری می‌کند." },
    ],
  },
  barley: {
    plantingWindowDays: [-20, 20],
    irrigationIntervalDays: 14,
    operations: [
      { kind: "fertilizer", offset: -7, stage: "قبل از کاشت", title: "کود پایه", detail: "فسفر کامل؛ جو به اورهٔ زیاد حساس است.", dosePerHa: N(200), unit: "کیلوگرم" },
      { kind: "planting", offset: 0, stage: "کاشت", title: "کاشت جو", detail: "تراکم ۱۸۰ کیلوگرم در هکتار، عمق ۴ تا ۵ سانتی‌متر.", dosePerHa: N(180), unit: "کیلوگرم بذر" },
      { kind: "fertilizer", offset: 35, stage: "پنجه‌زنی", title: "سرک اوره", detail: "کمتر از گندم؛ مصرف زیاد موجب خواب‌افتادگی می‌شود.", dosePerHa: N(70), unit: "کیلوگرم" },
      { kind: "spray", offset: 30, stage: "علف‌ها", title: "علف‌کش", detail: "در هوای آرام و خاک مرطوب." },
      { kind: "spray", offset: 80, stage: "ساقه‌روی", title: "قارچ‌کش", detail: "در مناطق با رطوبت بالا و سابقهٔ بیماری." },
      { kind: "harvest", offset: 200, stage: "برداشت", title: "برداشت", detail: "نسبت به گندم زودتر می‌رسد؛ ریزش را کنترل کن." },
    ],
  },
  canola: {
    plantingWindowDays: [-15, 15],
    irrigationIntervalDays: 10,
    operations: [
      { kind: "prep", offset: -15, stage: "آماده‌سازی", title: "خاک‌ورزی نرم", detail: "بستر ریز و یکنواخت؛ کلزا بذر ریز دارد." },
      { kind: "fertilizer", offset: -7, stage: "قبل از کاشت", title: "کود پایه", detail: "فسفر و گوگرد؛ کلزا به گوگرد پاسخ خوبی می‌دهد.", dosePerHa: N(250), unit: "کیلوگرم" },
      { kind: "planting", offset: 0, stage: "کاشت", title: "کاشت کلزا", detail: "تراکم ۵ تا ۷ کیلوگرم در هکتار، عمق ۱ تا ۲ سانتی‌متر.", dosePerHa: N(6), unit: "کیلوگرم بذر" },
      { kind: "spray", offset: 12, stage: "پیش‌رویشی", title: "علف‌کش خاک‌مصرف", detail: "تریفلورالین قبل از جوانه‌زنی و با خاک مرطوب." },
      { kind: "fertilizer", offset: 35, stage: "روزت", title: "سرک اوره", detail: "یک‌دوم اوره؛ بیش از این، رشد رویشی بی‌ثمر می‌سازد.", dosePerHa: N(90), unit: "کیلوگرم" },
      { kind: "spray", offset: 50, stage: "ساقه‌روی", title: "کک کلزا و شته", detail: "پایش هفتگی؛ سم فقط با رسیدن به آستانهٔ زیان." },
      { kind: "fertilizer", offset: 70, stage: "غنچه‌دهی", title: "بور و پتاسیم محلول‌پاشی", detail: "بور در گلدهی از ریزش گل جلوگیری می‌کند." },
      { kind: "spray", offset: 85, stage: "گلدهی", title: "قارچ‌کش اسکلروتینیا", detail: "در گلدهی و هوای مرطوب؛ زنبور عسل را از سم‌پاشی دور نگه دار." },
      { kind: "harvest", offset: 190, stage: "برداشت", title: "برداشت", detail: "برداشت زودتر از ریزش غلاف." },
    ],
  },
  "corn-forage": {
    plantingWindowDays: [-10, 10],
    irrigationIntervalDays: 7,
    operations: [
      { kind: "prep", offset: -10, stage: "آماده‌سازی", title: "شخم و بستر", detail: "ذرت خاک عمیق و زهکشی خوب می‌خواهد." },
      { kind: "fertilizer", offset: -5, stage: "قبل از کاشت", title: "کود پایه", detail: "فسفر کامل + یک‌سوم ازت.", dosePerHa: N(300), unit: "کیلوگرم" },
      { kind: "planting", offset: 0, stage: "کاشت", title: "کاشت ذرت", detail: "تراکم ۲۵ تا ۳۵ کیلوگرم؛ خاک بالای ۱۲ درجه باشد.", dosePerHa: N(30), unit: "کیلوگرم بذر" },
      { kind: "spray", offset: 3, stage: "پیش‌رویشی", title: "علف‌کش آترازین", detail: "قبل از سبز شدن و با رطوبت کافی؛ ذرت حساس را در نظر بگیر." },
      { kind: "fertilizer", offset: 30, stage: "۶ برگی", title: "سرک ازت (مرحلهٔ ۱)", detail: "همراه آبیاری؛ ازت زیاد در این مرحله ساقهٔ قوی می‌سازد.", dosePerHa: N(120), unit: "کیلوگرم" },
      { kind: "spray", offset: 35, stage: "۸ تا ۱۰ برگی", title: "ساقه‌خوار ذرت", detail: "پایش تله و تخم؛ فقط در آستانهٔ زیان." },
      { kind: "fertilizer", offset: 50, stage: "۱۰ تا ۱۲ برگی", title: "سرک ازت (مرحلهٔ ۲)", detail: "قبل از گل‌دهی تمام شود تا برگ بمیرد؟ نه — تا گلدهی ادامهٔ مصرف اشکال ندارد.", dosePerHa: N(60), unit: "کیلوگرم" },
      { kind: "irrigation", offset: 60, stage: "گلدهی", title: "آبیاری بحرانی", detail: "تنش آبی در گلدهی، دانه‌بندی را شدید کم می‌کند." },
      { kind: "harvest", offset: 110, stage: "برداشت علوفه", title: "برداشت", detail: "برای سیلو، در مرحلهٔ شیری تا خمیری برداشت کن." },
    ],
  },
  alfalfa: {
    plantingWindowDays: [-30, 30],
    irrigationIntervalDays: 10,
    operations: [
      { kind: "prep", offset: -30, stage: "آماده‌سازی", title: "تسطیح و حذف علف هرز", detail: "یونجه چندساله است؛ قبل از کاشت زمین پاک شود." },
      { kind: "fertilizer", offset: -10, stage: "قبل از کاشت", title: "کود پایه", detail: "فسفر و پتاسیم بالا؛ یونجه ازت کمتری می‌خواهد.", dosePerHa: N(300), unit: "کیلوگرم" },
      { kind: "planting", offset: 0, stage: "کاشت", title: "کاشت یونجه", detail: "تراکم ۲۰ تا ۲۵ کیلوگرم؛ بستر کم‌عمق و مرطوب.", dosePerHa: N(22), unit: "کیلوگرم بذر" },
      { kind: "spray", offset: 20, stage: "علف هرز", title: "علف‌کش", detail: "یونجه جوان حساس است؛ دوز پایین و کارشناس محلی." },
      { kind: "fertilizer", offset: 45, stage: "پس از چین اول", title: "پتاسیم و گوگرد", detail: "بعد از هر چین، پتاسیم برای رشد مجدد.", dosePerHa: N(80), unit: "کیلوگرم" },
      { kind: "spray", offset: 55, stage: "رشد مجدد", title: "سرخرطومی و شته", detail: "پایش؛ زنبور و دشمنان طبیعی را حفظ کن." },
      { kind: "harvest", offset: 75, stage: "چین اول", title: "چین اول", detail: "قبل از گلدهی کامل بزن تا کیفیت پروتئین بالا بماند." },
      { kind: "harvest", offset: 115, stage: "چین دوم", title: "چین دوم", detail: "بعد از هر چین، آبیاری و تغذیهٔ سبک." },
      { kind: "harvest", offset: 155, stage: "چین سوم", title: "چین سوم", detail: "چین آخر را زودتر بزن تا زمستان‌گذرانی خوب باشد." },
    ],
  },
  cotton: {
    plantingWindowDays: [-10, 10],
    irrigationIntervalDays: 9,
    operations: [
      { kind: "prep", offset: -15, stage: "آماده‌سازی", title: "شخم عمیق", detail: "پنبه خاک گرم و زهکشی خوب می‌خواهد؛ خاک سرد جوانه‌زنی را می‌کشد." },
      { kind: "fertilizer", offset: -5, stage: "قبل از کاشت", title: "کود پایه", detail: "فسفر کامل + پتاسیم؛ ازت کم.", dosePerHa: N(250), unit: "کیلوگرم" },
      { kind: "planting", offset: 0, stage: "کاشت", title: "کاشت پنبه", detail: "دمای خاک بالای ۱۵ درجه؛ تراکم ۲۰ تا ۳۰ کیلوگرم.", dosePerHa: N(25), unit: "کیلوگرم بذر" },
      { kind: "spray", offset: 20, stage: "علف هرز", title: "علف‌کش", detail: "پنبه جوان خیلی حساس است؛ دوز کم." },
      { kind: "fertilizer", offset: 45, stage: "غنچه‌دهی", title: "سرک ازت و پتاسیم", detail: "ازت زیاد در این مرحله رشد رویشی می‌دهد و قوزه نمی‌دهد.", dosePerHa: N(80), unit: "کیلوگرم" },
      { kind: "spray", offset: 60, stage: "قوزه‌دهی", title: "کرم قوزه", detail: "پایش تله فرمونی؛ سم فقط در آستانهٔ زیان." },
      { kind: "irrigation", offset: 75, stage: "گلدهی", title: "آبیاری بحرانی", detail: "کم‌آبی در گلدهی ریزش شدید می‌دهد." },
      { kind: "harvest", offset: 160, stage: "برداشت", title: "چین اول", detail: "چین دستی یا ماشینی؛ الیاف خیس را نچین." },
    ],
  },
  sugarbeet: {
    plantingWindowDays: [-15, 15],
    irrigationIntervalDays: 12,
    operations: [
      { kind: "prep", offset: -20, stage: "آماده‌سازی", title: "شخم عمیق", detail: "چغندر ریشهٔ عمیق دارد؛ سنگ و کلوخه حذف شود." },
      { kind: "fertilizer", offset: -7, stage: "قبل از کاشت", title: "کود پایه", detail: "فسفر کامل + پتاسیم؛ ازت کم.", dosePerHa: N(350), unit: "کیلوگرم" },
      { kind: "planting", offset: 0, stage: "کاشت", title: "کاشت چغندر", detail: "تراکم ۸۰ تا ۱۰۰ هزار بوته؛ عمق ۲ تا ۳ سانتی‌متر.", dosePerHa: N(12), unit: "کیلوگرم بذر" },
      { kind: "spray", offset: 15, stage: "۴ برگی", title: "علف‌کش", detail: "دوز پایین و مرحله‌ای؛ چغندر به علف‌کش حساس است." },
      { kind: "fertilizer", offset: 40, stage: "۶ تا ۸ برگی", title: "سرک ازت", detail: "تا اوایل مرداد تمام شود؛ ازت دیر، قند را کم می‌کند.", dosePerHa: N(90), unit: "کیلوگرم" },
      { kind: "spray", offset: 70, stage: "برگ‌دهی", title: "لکه‌برگی (سرکوسپورا)", detail: "مدیریت تناوب و قارچ‌کش در هوای مرطوب." },
      { kind: "irrigation", offset: 90, stage: "ریشه‌دهی", title: "آبیاری منظم", detail: "تنش آب، ریشه را چوبی و قند را کم می‌کند." },
      { kind: "harvest", offset: 190, stage: "برداشت", title: "برداشت", detail: "برداشت در هوای خنک تا افت قند کم شود." },
    ],
  },
};

export interface SeasonTask {
  date: JDate;
  offset: number;
  kind: TaskKind;
  stage: string;
  title: string;
  detail: string;
  dosePerHa?: number;
  unit?: string;
  /** مقدار کل برای کل زمین. */
  total?: number;
}

export interface SeasonPlan {
  cropId: CropId;
  cropName: string;
  planting: JDate;
  harvest: JDate;
  tasks: SeasonTask[];
  /** مجموع نهاده (کیلوگرم) برای کل زمین. */
  fertilizerTotalKg: number;
  sprayLiters: number;
  /** آب کل فصل (متر مکعب). */
  waterM3: number;
  irrigationIntervalDays: number;
  windowWarning: string | null;
  /** فاصلهٔ روز کاشت تا برداشت. */
  durationDays: number;
}

function addDays(date: JDate, days: number): JDate {
  const base = jalaliToDate(date);
  base.setDate(base.getDate() + days);
  return dateToJalali(base);
}

export function buildSeasonPlan(
  cropId: CropId,
  cropName: string,
  planting: JDate,
  areaHa: number,
  waterMm: number,
  options: { plantingWindowDays?: [number, number]; daysToHarvest?: number } = {}
): SeasonPlan {
  const schedule = CROP_SCHEDULES[cropId];
  const [early, late] = options.plantingWindowDays ?? schedule.plantingWindowDays;
  const tasks: SeasonTask[] = schedule.operations.map((operation) => {
    const perHa = operation.dosePerHa ?? 0;
    return {
      ...operation,
      date: addDays(planting, operation.offset),
      total: perHa > 0 ? Math.round(perHa * areaHa * 10) / 10 : undefined,
    };
  });

  const harvestOffset = options.daysToHarvest ?? (tasks.filter((task) => task.kind === "harvest").pop()?.offset ?? 210);
  const fertilizerTotalKg = tasks.filter((task) => task.kind === "fertilizer").reduce((sum, task) => sum + (task.total ?? 0), 0);
  const sprayLiters = tasks.filter((task) => task.kind === "spray").reduce((sum, task) => sum + (task.total ?? 0), 0);

  const today = dateToJalali(new Date());
  const diffDays = Math.round((jalaliToDate(planting).getTime() - jalaliToDate(today).getTime()) / 86_400_000);
  const windowWarning =
    diffDays < early
      ? `کاشت ${Math.abs(diffDays - early)} روز جلوتر از پنجرهٔ امن است؛ خطر سرما/دیررس‌شدن.`
      : diffDays > late
        ? `کاشت ${diffDays - late} روز دیرتر از پنجرهٔ امن است؛ کاهش عملکرد محتمل است.`
        : null;

  return {
    cropId,
    cropName,
    planting,
    harvest: addDays(planting, harvestOffset),
    tasks: tasks.sort((a, b) => a.offset - b.offset),
    fertilizerTotalKg,
    sprayLiters,
    waterM3: Math.round(waterMm * 10 * areaHa),
    irrigationIntervalDays: schedule.irrigationIntervalDays,
    windowWarning,
    durationDays: harvestOffset,
  };
}

export const TASK_LABELS: Record<TaskKind, string> = {
  prep: "آماده‌سازی",
  planting: "کاشت",
  fertilizer: "کود",
  spray: "سم‌پاشی",
  irrigation: "آبیاری",
  harvest: "برداشت",
};

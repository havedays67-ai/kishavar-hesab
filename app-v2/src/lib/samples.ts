import { addJalaliMonths, todayJalali } from "./format";
import {
  calculateTrade,
  emptyCosts,
  makeTradeSerial,
  type CropTrade,
  type TradeCalculationInput,
} from "./trade";

export interface CropPlot {
  id: string;
  title: string;
  location: string;
  areaHa: number;
  crop: string;
  season: string;
  ownership: "owned" | "leased" | "shared";
  rent: number;
  seed: number;
  fertilizer: number;
  water: number;
  labor: number;
  machinery: number;
  other: number;
  yieldKgPerHa: number;
  pricePerKg: number;
}

const today = todayJalali();

export const initialPlots: CropPlot[] = [
  {
    id: "plot-north",
    title: "قطعه شمالی — چشمه",
    location: "پارس‌آباد، روستای اروج",
    areaHa: 12.5,
    crop: "گندم",
    season: "۱۴۰۵–۱۴۰۶",
    ownership: "leased",
    rent: 360_000_000,
    seed: 84_000_000,
    fertilizer: 178_000_000,
    water: 96_000_000,
    labor: 132_000_000,
    machinery: 118_000_000,
    other: 54_000_000,
    yieldKgPerHa: 5_460,
    pricePerKg: 49_500,
  },
  {
    id: "plot-south",
    title: "زمین جنوبی — کانال ۴",
    location: "پارس‌آباد، کانال چهار",
    areaHa: 8,
    crop: "کلزا",
    season: "۱۴۰۵–۱۴۰۶",
    ownership: "leased",
    rent: 180_000_000,
    seed: 32_000_000,
    fertilizer: 96_000_000,
    water: 48_000_000,
    labor: 74_000_000,
    machinery: 62_000_000,
    other: 31_000_000,
    yieldKgPerHa: 2_840,
    pricePerKg: 55_000,
  },
  {
    id: "plot-orchard",
    title: "باغ زردآلو — شرقی",
    location: "اصلاندوز، باغ شرقی",
    areaHa: 4,
    crop: "زردآلو",
    season: "۱۴۰۵–۱۴۰۶",
    ownership: "owned",
    rent: 0,
    seed: 12_000_000,
    fertilizer: 58_000_000,
    water: 44_000_000,
    labor: 168_000_000,
    machinery: 46_000_000,
    other: 38_000_000,
    yieldKgPerHa: 13_500,
    pricePerKg: 68_000,
  },
  {
    id: "plot-pistachio",
    title: "باغ پسته — قطعه غربی",
    location: "خداآفرین، قطعه غربی",
    areaHa: 6,
    crop: "پسته",
    season: "۱۴۰۵–۱۴۰۶",
    ownership: "shared",
    rent: 0,
    seed: 0,
    fertilizer: 142_000_000,
    water: 96_000_000,
    labor: 210_000_000,
    machinery: 74_000_000,
    other: 61_000_000,
    yieldKgPerHa: 1_180,
    pricePerKg: 780_000,
  },
];

export function plotCost(plot: CropPlot): number {
  return plot.rent + plot.seed + plot.fertilizer + plot.water + plot.labor + plot.machinery + plot.other;
}

export function plotMetrics(plot: CropPlot) {
  const cost = plotCost(plot);
  const yieldKg = plot.areaHa * plot.yieldKgPerHa;
  const revenue = yieldKg * plot.pricePerKg;
  const profit = revenue - cost;
  const costPerKg = yieldKg > 0 ? cost / yieldKg : 0;
  const breakEven = yieldKg > 0 ? cost / yieldKg : 0;
  const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
  return { cost, yieldKg, revenue, profit, costPerKg, breakEven, margin };
}

interface SampleTradeInput {
  serialSeq: number;
  day: number;
  productId: CropTrade["productId"];
  buyerName: string;
  buyerType: string;
  farmTitle: string;
  vehiclePlate: string;
  driverName: string;
  quality: TradeCalculationInput["quality"];
  unitPrice: number;
  costs: TradeCalculationInput["costs"];
  status: CropTrade["status"];
  paidRatio: number;
  paymentMethod: CropTrade["paymentMethod"];
  chequeNo?: string;
  notes: string;
}

function buildSampleTrade(input: SampleTradeInput): CropTrade {
  const date = { jy: today.jy, jm: today.jm, jd: Math.max(1, today.jd - input.day) };
  const result = calculateTrade({
    productId: input.productId,
    quality: input.quality,
    unitPrice: input.unitPrice,
    costs: input.costs,
    taxExempt: true,
    taxRate: 0,
  });
  return {
    id: `trade-${input.serialSeq}`,
    serial: makeTradeSerial(date, input.productId, input.serialSeq),
    productId: input.productId,
    date,
    createdAt: date,
    sellerName: "محمدرضا کریمی — مزرعه سبز دشت مغان",
    sellerNationalId: "۰۴۵-۹۸۷۶۵۴۳-۲",
    sellerPhone: "۰۹۱۴ ۲۲۲ ۸۸۷۷",
    buyerName: input.buyerName,
    buyerNationalId: "۱۴۰۰۳۲۵۶۷۸۹",
    buyerAddress: "پارس‌آباد، شهرک صنعتی، جاده سیلو",
    buyerType: input.buyerType,
    farmTitle: input.farmTitle,
    vehiclePlate: input.vehiclePlate,
    driverName: input.driverName,
    driverPhone: "۰۹۱۲ ۵۵۵ ۴۴۳۳",
    weighbridgeNo: `B-${1400 + input.serialSeq}`,
    quality: input.quality,
    unitPrice: input.unitPrice,
    costs: input.costs,
    taxExempt: true,
    taxRate: 0,
    paymentMethod: input.paymentMethod,
    chequeNo: input.chequeNo ?? "",
    dueDate: addJalaliMonths(date, 1),
    paid: Math.round(result.netReceipt * input.paidRatio),
    notes: input.notes,
    status: input.status,
    result,
  };
}

export const initialTrades: CropTrade[] = [
  buildSampleTrade({
    serialSeq: 3,
    day: 0,
    productId: "wheat",
    buyerName: "کارخانه آرد آذربایجان",
    buyerType: "کارخانه آرد",
    farmTitle: "قطعه شمالی — گندم چمران",
    vehiclePlate: "۱۴ ع ۲۵۷ / ایران ۲۱",
    driverName: "رحیم علیزاده",
    quality: {
      grossKg: 30_420,
      tareKg: 11_980,
      moisture: 15.2,
      usefulLossPercent: 3,
      nonUsefulLossPercent: 1.2,
      impurity: 1.1,
      sprouted: 0.6,
      broken: 2.2,
      hectoliter: 77,
      protein: 12.1,
    },
    unitPrice: 49_500,
    costs: { transport: 12_000_000, loading: 4_500_000, commissionRate: 0.5, insurance: 0, delayPenalty: 0, other: 1_500_000 },
    status: "confirmed",
    paidRatio: 0.45,
    paymentMethod: "cheque",
    chequeNo: "۴۵۲۱۹۸۷",
    notes: "تحویل به سیلوی کارخانه شماره ۲؛ نمونه‌برداری با حضور نماینده فروشنده انجام شد.",
  }),
  buildSampleTrade({
    serialSeq: 2,
    day: 8,
    productId: "barley",
    buyerName: "دامداری بهاران",
    buyerType: "دامداری",
    farmTitle: "زمین جنوبی — جو",
    vehiclePlate: "۲۱ ع ۴۴۸ / ایران ۲۱",
    driverName: "قادر محمدی",
    quality: {
      grossKg: 22_870,
      tareKg: 9_670,
      moisture: 11.8,
      usefulLossPercent: 3,
      nonUsefulLossPercent: 1.5,
      impurity: 1.5,
      sprouted: 0.2,
      broken: 1.8,
      hectoliter: 64,
      protein: 10.2,
    },
    unitPrice: 17_000,
    costs: { transport: 7_500_000, loading: 2_800_000, commissionRate: 0.4, insurance: 0, delayPenalty: 0, other: 900_000 },
    status: "settled",
    paidRatio: 1,
    paymentMethod: "bank",
    notes: "تسویه کامل با حواله بانکی پایا؛ قبض باسکول و فاکتور در بایگانی است.",
  }),
  buildSampleTrade({
    serialSeq: 1,
    day: 22,
    productId: "wheat",
    buyerName: "سیلوی تعاونی پارس‌آباد",
    buyerType: "سیلو",
    farmTitle: "قطعه شمالی — پاییزه",
    vehiclePlate: "۱۴ ع ۹۰۱ / ایران ۲۱",
    driverName: "اسماعیل رستمی",
    quality: {
      grossKg: 18_640,
      tareKg: 6_140,
      moisture: 13.4,
      usefulLossPercent: 3,
      nonUsefulLossPercent: 1,
      impurity: 0.8,
      sprouted: 0.1,
      broken: 1.1,
      hectoliter: 78.4,
      protein: 12.7,
    },
    unitPrice: 49_500,
    costs: { transport: 6_200_000, loading: 2_400_000, commissionRate: 0.5, insurance: 0, delayPenalty: 0, other: 600_000 },
    status: "draft",
    paidRatio: 0,
    paymentMethod: "cash",
    notes: "پیش‌نویس محاسبه برای تطبیق نرخ روز؛ هنوز تحویل نهایی انجام نشده است.",
  }),
];

export function nextTradeSerial(trades: CropTrade[], productId: CropTrade["productId"]): string {
  const today = todayJalali();
  const count = trades.filter((trade) => trade.date.jy === today.jy && trade.date.jm === today.jm && trade.date.jd === today.jd).length + 1;
  return makeTradeSerial(today, productId, count);
}

export const CROP_COST_LABELS: { key: keyof Pick<CropPlot, "rent" | "seed" | "fertilizer" | "water" | "labor" | "machinery" | "other">; label: string }[] = [
  { key: "rent", label: "اجاره / حق بهره‌برداری" },
  { key: "seed", label: "بذر و نهال" },
  { key: "fertilizer", label: "کود و سم" },
  { key: "water", label: "آب و انرژی" },
  { key: "labor", label: "کارگر" },
  { key: "machinery", label: "ماشین‌آلات" },
  { key: "other", label: "سایر" },
];

export { emptyCosts };

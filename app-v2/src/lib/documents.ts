import type { SavedContract } from "./data";
import { formatJalali, todayJalali, type JDate } from "./format";
import {
  PAYMENT_METHOD_LABELS,
  PRODUCT_PROFILES,
  tradeBalance,
  type CropTrade,
} from "./trade";

export type DocumentKind =
  | "sale-contract"
  | "weigh-ticket"
  | "quality-minutes"
  | "sale-invoice"
  | "settlement"
  | "lease-contract"
  | "lease-receipt"
  | "lease-handover"
  | "trades-report"
  | "cost-report";

export type DocumentFamily = "trade" | "lease" | "report";

export interface DocumentMeta {
  kind: DocumentKind;
  family: DocumentFamily;
  title: string;
  description: string;
  legalBasis: string;
  copies: string;
  signatureRoles: string[];
  needsStamp: boolean;
}

export const DOCUMENT_TYPES: DocumentMeta[] = [
  {
    kind: "sale-contract",
    family: "trade",
    title: "قرارداد فروش محصول کشاورزی",
    description: "مشخصات طرفین، مقدار، کیفیت، نرخ، تحویل، پرداخت و شرایط فسخ.",
    legalBasis: "مواد ۱۰، ۱۹۰، ۲۱۹، ۲۲۰، ۳۳۸، ۳۴۸، ۳۶۷ و ۴۲۲ قانون مدنی",
    copies: "سه نسخه: فروشنده، خریدار، بایگانی",
    signatureRoles: ["فروشنده", "خریدار", "شاهد"],
    needsStamp: true,
  },
  {
    kind: "weigh-ticket",
    family: "trade",
    title: "قبض باسکول و رسید تحویل",
    description: "وزن پر/خالی/خالص، شماره باسکول، خودرو، راننده و تاریخ ورود و خروج.",
    legalBasis: "ماده ۳۶۷ قانون مدنی (تسلیم) و رویه تشریفات باسکول مراکز خرید",
    copies: "دو نسخه: فروشنده و انبار خریدار",
    signatureRoles: ["مسئول باسکول", "تحویل‌گیرنده", "فروشنده"],
    needsStamp: true,
  },
  {
    kind: "quality-minutes",
    family: "trade",
    title: "صورتجلسه نمونه‌برداری و تعیین کیفیت",
    description: "رطوبت، ناخالصی، هکتولیتر، پروتئین، سن‌زدگی، دانه شکسته و افت‌ها.",
    legalBasis: "استاندارد ملی ایران ۱۰۴۳ (گندم – ویژگی‌ها) و دستورالعمل کنترل کیفیت مرکز خرید",
    copies: "سه نسخه: آزمایشگاه، فروشنده، خریدار",
    signatureRoles: ["نمونه‌بردار", "مسئول آزمایشگاه", "فروشنده"],
    needsStamp: true,
  },
  {
    kind: "sale-invoice",
    family: "trade",
    title: "صورتحساب فروش محصول",
    description: "مقدار قابل پرداخت، نرخ، کسورات، معافیت مالیاتی، مبلغ کل و مبلغ به حروف.",
    legalBasis: "ماده ۱۶۹ قانون مالیات‌های مستقیم، بند ۱ بند الف ماده ۹ قانون مالیات بر ارزش افزوده ۱۴۰۰",
    copies: "دو نسخه: فروشنده و خریدار",
    signatureRoles: ["فروشنده", "خریدار"],
    needsStamp: true,
  },
  {
    kind: "settlement",
    family: "trade",
    title: "صورتجلسه تسویه حساب",
    description: "مبلغ قابل پرداخت، پرداخت‌شده، مانده، شماره چک/حواله و وضعیت تسویه.",
    legalBasis: "مواد ۲۹۵ و ۳۰۱ قانون مدنی (وفای به عهد) و ماده ۱۹ قانون تجارت",
    copies: "دو نسخه: طرفین",
    signatureRoles: ["فروشنده", "خریدار"],
    needsStamp: true,
  },
  {
    kind: "lease-contract",
    family: "lease",
    title: "قرارداد زمین کشاورزی",
    description: "طرفین، نوع قرارداد، زمین، مدت، مال‌الاجاره، ودیعه، حقابه و تعهدات.",
    legalBasis: "مواد ۴۶۶، ۴۶۸، ۴۹۰، ۴۹۳، ۵۰۲، ۵۰۶، ۵۱۹ و ۵۲۰ قانون مدنی",
    copies: "سه نسخه: موجر، مستاجر، بایگانی",
    signatureRoles: ["موجر / مالک", "مستاجر / بهره‌بردار", "شاهد"],
    needsStamp: true,
  },
  {
    kind: "lease-receipt",
    family: "lease",
    title: "رسید پرداخت مال‌الاجاره",
    description: "شماره قرارداد، دوره پرداخت، مبلغ، روش پرداخت و مانده اجاره.",
    legalBasis: "مواد ۴۶۶ و ۴۹۰ قانون مدنی و ماده ۲۹۵ قانون مدنی",
    copies: "دو نسخه: موجر و مستاجر",
    signatureRoles: ["دریافت‌کننده", "پرداخت‌کننده"],
    needsStamp: false,
  },
  {
    kind: "lease-handover",
    family: "lease",
    title: "صورتجلسه تحویل زمین",
    description: "وضعیت زمین، حقابه، تأسیسات، تاریخ تحویل و یادداشت‌های بازرسی.",
    legalBasis: "ماده ۴۷۰ و مواد ۴۸۶ تا ۴۹۳ قانون مدنی",
    copies: "دو نسخه: طرفین",
    signatureRoles: ["تحویل‌دهنده", "تحویل‌گیرنده"],
    needsStamp: false,
  },
  {
    kind: "trades-report",
    family: "report",
    title: "گزارش مدیریتی معاملات محصول",
    description: "فهرست محموله‌ها، وزن قابل پرداخت، نرخ مؤثر، خالص دریافتی و مانده.",
    legalBasis: "گزارش داخلی مدیریتی — سند مالی رسمی نیست",
    copies: "یک نسخه برای بایگانی مدیریت",
    signatureRoles: ["مدیر مزرعه"],
    needsStamp: false,
  },
  {
    kind: "cost-report",
    family: "report",
    title: "گزارش بهای تمام‌شده هر کیلو",
    description: "هزینه زمین، نهاده، کارگر، ماشین و سرباز؛ سود و نقطه سربه‌سر.",
    legalBasis: "گزارش داخلی مدیریتی — مبنای حسابداری مدیریت",
    copies: "یک نسخه برای بایگانی مدیریت",
    signatureRoles: ["مدیر مزرعه"],
    needsStamp: false,
  },
];

export function documentMeta(kind: DocumentKind): DocumentMeta {
  return DOCUMENT_TYPES.find((item) => item.kind === kind) ?? DOCUMENT_TYPES[0];
}

export interface DocumentPayload {
  trade?: CropTrade;
  contract?: SavedContract;
  trades?: CropTrade[];
  costRows?: {
    title: string;
    areaHa: number;
    crop: string;
    totalCost: number;
    yieldKg: number;
    revenue: number;
    profit: number;
  }[];
}

export interface DocumentSpec {
  kind: DocumentKind;
  meta: DocumentMeta;
  serial: string;
  date: JDate;
  verificationCode: string;
  payload: DocumentPayload;
}

function fnvHash(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).toUpperCase().padStart(7, "0");
}

export function makeDocument(kind: DocumentKind, payload: DocumentPayload, serialOverride?: string): DocumentSpec {
  const meta = documentMeta(kind);
  const today = todayJalali();
  const prefix = { trade: "TRD", lease: "LSE", report: "RPT" }[meta.family];
  const source = payload.trade?.serial ?? payload.contract?.code ?? `${today.jy}${today.jm}${today.jd}`;
  const suffix = {
    "sale-contract": "CTR",
    "weigh-ticket": "WGH",
    "quality-minutes": "QLT",
    "sale-invoice": "INV",
    settlement: "STL",
    "lease-contract": "LCT",
    "lease-receipt": "LRC",
    "lease-handover": "LHV",
    "trades-report": "RPT",
    "cost-report": "CST",
  }[kind];
  const serial = serialOverride ?? `KSH-${prefix}-${suffix}-${source}`;
  const verificationCode = fnvHash(
    `${serial}|${kind}|${payload.trade?.result.netReceipt ?? payload.contract?.rent ?? 0}|${formatJalali(today, "short")}`
  );
  return { kind, meta, serial, date: payload.trade?.date ?? today, verificationCode, payload };
}

export function verificationPayload(spec: DocumentSpec): string {
  return JSON.stringify({
    v: 1,
    org: "کسب‌وکار من",
    serial: spec.serial,
    kind: spec.kind,
    date: formatJalali(spec.date, "short"),
    code: spec.verificationCode,
    amount: spec.payload.trade?.result.netReceipt ?? spec.payload.contract?.rent ?? 0,
  });
}

export function contractDocumentKind(kind: DocumentKind): boolean {
  return kind === "lease-contract" || kind === "lease-receipt" || kind === "lease-handover";
}

export function tradeDocumentsAvailable(trade: CropTrade): number {
  const balance = tradeBalance(trade);
  return balance.status === "unpaid" ? 4 : 5;
}

export function productDisplayName(trade: CropTrade): string {
  return PRODUCT_PROFILES[trade.productId].name;
}

export function paymentDisplayName(trade: CropTrade): string {
  return PAYMENT_METHOD_LABELS[trade.paymentMethod];
}

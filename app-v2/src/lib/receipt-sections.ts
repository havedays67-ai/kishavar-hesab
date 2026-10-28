/**
 * بخش‌های رسید و قواعد آپلود — مشترک وب و اپ (بدون وابستگی)
 * رسیدها «یادداشت و مدرک حمایتی» هستند؛ جای سند رسمی را نمی‌گیرند.
 */

export type ReceiptSectionId =
  | "trade"
  | "quick-sale"
  | "contracts"
  | "rentals"
  | "finance"
  | "parties"
  | "inventory"
  | "crops"
  | "documents"
  | "other";

export interface ReceiptSectionMeta {
  id: ReceiptSectionId;
  label: string;
  hint: string;
  route: string;
}

export const RECEIPT_SECTIONS: ReceiptSectionMeta[] = [
  { id: "trade", label: "معامله محصول", hint: "قبض باسکول، فیش تسویه، تصویر چک", route: "/trade" },
  { id: "quick-sale", label: "فروش ساده", hint: "فیش واریز خریدار، رسید تحویل", route: "/trade" },
  { id: "contracts", label: "قرارداد زمین", hint: "رسید مال‌الاجاره، ودیعه، تحویل زمین", route: "/contracts" },
  { id: "rentals", label: "اجاره و اقساط", hint: "فیش اقساط و رسید پرداخت", route: "/contracts" },
  { id: "finance", label: "دفتر مالی", hint: "فیش هزینه، درآمد، کارت‌به‌کارت", route: "/finance" },
  { id: "parties", label: "بدهکار و بستانکار", hint: "رسید دریافت/پرداخت بدهی", route: "/finance" },
  { id: "inventory", label: "انبار و نهاده", hint: "فاکتور خرید کود و بذر", route: "/inventory" },
  { id: "crops", label: "زمین و کشت", hint: "فیش آب، کارگر، سم و کود", route: "/lands" },
  { id: "documents", label: "اسناد و امضا", hint: "اسکن سند امضاشده، گواهی برابر اصل", route: "/documents" },
  { id: "other", label: "سایر", hint: "هر یادداشت یا فیش دیگر", route: "/receipts" },
];

export const RECEIPT_ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf";
export const MAX_RECEIPT_BYTES = 6 * 1024 * 1024;

export function isReceiptSection(value: unknown): value is ReceiptSectionId {
  return typeof value === "string" && RECEIPT_SECTIONS.some((section) => section.id === value);
}

export function receiptSection(id: string): ReceiptSectionMeta {
  return RECEIPT_SECTIONS.find((section) => section.id === id) ?? RECEIPT_SECTIONS[RECEIPT_SECTIONS.length - 1];
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "۰";
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} کیلوبایت`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} مگابایت`;
}

export function validateReceiptFile(input: { name: string; type: string; size: number }): {
  ok: boolean;
  message: string;
} {
  const name = (input.name || "receipt").toLowerCase();
  const type = (input.type || "").toLowerCase();
  const isImage = type.startsWith("image/") || /\.(jpe?g|png|webp|heic|heif)$/.test(name);
  const isPdf = type === "application/pdf" || name.endsWith(".pdf");
  if (!isImage && !isPdf) {
    return { ok: false, message: "فقط عکس (JPG/PNG/WebP) یا PDF قبول است. اسکن یا عکس رسید را انتخاب کنید." };
  }
  if (input.size <= 0) return { ok: false, message: "فایل خالی است؛ دوباره انتخاب کنید." };
  if (input.size > MAX_RECEIPT_BYTES) {
    return { ok: false, message: `حجم فایل باید کمتر از ${formatBytes(MAX_RECEIPT_BYTES)} باشد.` };
  }
  return { ok: true, message: "فایل آمادهٔ آپلود است." };
}

export const RECEIPT_PRIVACY_NOTE =
  "این رسیدها روی فضای همین برنامه ذخیره می‌شوند و در بستهٔ پشتیبان شما قرار می‌گیرند. پیش از ارسال به دیگران، شمارهٔ حساب و کد ملی را بپوشانید.";

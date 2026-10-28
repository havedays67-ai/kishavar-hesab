import { formatJalali, todayJalali, type JDate } from "./format";
import {
  MAX_RECEIPT_BYTES,
  isReceiptSection,
  receiptSection,
  validateReceiptFile,
  type ReceiptSectionId,
} from "./receipt-sections";

/**
 * بایگانی رسید و فیش در حافظهٔ خود دستگاه (offline, localStorage).
 * رسیدها «یادداشت حمایتی» هستند و حذف نمی‌شوند مگر خود کاربر حذف کند.
 */
export interface StoredReceipt {
  id: string;
  section: ReceiptSectionId;
  /** نوع رکوردی که رسید به آن چسبیده است (بدهی، چک، معامله، قرارداد…). */
  refType?: string;
  /** شناسهٔ همان رکورد؛ رسیدها دقیقاً زیر همان رکورد برمی‌گردند. */
  refId?: string;
  title: string;
  amount: number | null;
  date: JDate;
  reference: string;
  note: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  /** نسخهٔ ۹۶ تا ۱۴۰ پیکسلی برای فهرست‌ها؛ تصویر اصلی فقط در پنجرهٔ مشاهده باز می‌شود. */
  thumbnailDataUrl?: string;
  createdAt: number;
}

const KEY = "kishavar.receipts.v1";
export const RECEIPTS_CHANGED_EVENT = "kishavar:receipts-changed";
/** سهمیهٔ امن حافظهٔ محلی؛ فایل بزرگ‌تر با پیام روشن رد می‌شود. */
export const LOCAL_RECEIPT_BUDGET = 4.4 * 1024 * 1024;

/**
 * رمزگشایی JSON چندمگابایتی رسیدها از localStorage برای هر کارتِ رکورد،
 * هزینهٔ سنگینی داشت (هر صفحه چند بار). این کش فقط با تغییر واقعی داده
 * باطل می‌شود؛ پس تصاویر base64 از نو parse یا decode نمی‌شوند.
 */
let cachedRows: StoredReceipt[] | null = null;

function sortRows(rows: StoredReceipt[]): StoredReceipt[] {
  return [...rows].sort((a, b) => b.createdAt - a.createdAt);
}

function notifyReceiptsChanged(): void {
  if (typeof window === "undefined") return;
  // یک تغییر محلی در همین تب رویداد storage مرورگر را اجرا نمی‌کند.
  window.dispatchEvent(new Event(RECEIPTS_CHANGED_EVENT));
}

if (typeof window !== "undefined") {
  // فقط تغییر تب دیگر کش را باطل می‌کند؛ تغییرهای همین تب در persist()
  // کش تازه را مستقیم می‌نویسند تا بایگانی چندمگابایتی دوباره parse نشود.
  window.addEventListener("storage", (event) => {
    if (!event.key || event.key === KEY) cachedRows = null;
  });
}

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadReceipts(): StoredReceipt[] {
  if (cachedRows) return cachedRows;
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) {
      cachedRows = [];
      return cachedRows;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    cachedRows = sortRows(
      parsed.filter(
        (item): item is StoredReceipt =>
          Boolean(item) &&
          typeof item.id === "string" &&
          typeof item.dataUrl === "string" &&
          typeof item.createdAt === "number"
      )
    );
    return cachedRows;
  } catch {
    return [];
  }
}

function persist(rows: StoredReceipt[]): { ok: boolean; error?: string } {
  const store = storage();
  if (!store) return { ok: false, error: "حافظهٔ دستگاه در دسترس نیست." };
  try {
    const ordered = sortRows(rows);
    const payload = JSON.stringify(ordered);
    if (payload.length > LOCAL_RECEIPT_BUDGET) {
      return { ok: false, error: "حافظهٔ رسیدها پر شده است؛ چند رسید قدیمی را پاک یا از فایل پشتیبان خارج کنید." };
    }
    store.setItem(KEY, payload);
    cachedRows = ordered;
    return { ok: true };
  } catch {
    cachedRows = null;
    return { ok: false, error: "ذخیره در حافظهٔ دستگاه ممکن نشد (احتمالاً فضا کم است)." };
  }
}

export function addReceipt(input: Omit<StoredReceipt, "id" | "createdAt">): { ok: boolean; error?: string; receipt?: StoredReceipt } {
  const rows = loadReceipts();
  const receipt: StoredReceipt = {
    ...input,
    section: isReceiptSection(input.section) ? input.section : "other",
    id: `rc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  const result = persist([receipt, ...rows]);
  return result.ok ? { ok: true, receipt } : { ok: false, error: result.error };
}

export function removeReceipt(id: string): { ok: boolean; error?: string } {
  return persist(loadReceipts().filter((row) => row.id !== id));
}

/** جایگزینی کامل بایگانی برای بازیابی از پشتیبان؛ خروجی خطا قابل نمایش است. */
export function replaceReceipts(rows: unknown): { ok: boolean; error?: string; count: number } {
  if (!Array.isArray(rows)) return { ok: true, count: 0 };
  const safe = rows.filter(
    (row): row is StoredReceipt =>
      Boolean(row) &&
      typeof row.id === "string" &&
      typeof row.dataUrl === "string" &&
      typeof row.createdAt === "number" &&
      isReceiptSection((row as StoredReceipt).section)
  );
  const result = persist(safe);
  if (result.ok) notifyReceiptsChanged();
  return { ok: result.ok, error: result.error, count: safe.length };
}

/** رسیدهای یک رکورد مشخص؛ یک رکورد می‌تواند هر تعداد رسید داشته باشد. */
export function loadRecordReceipts(refType: string, refId: string): StoredReceipt[] {
  return loadReceipts().filter((row) => row.refType === refType && row.refId === refId);
}

export function recordReceiptCount(refType: string, refId: string): number {
  return loadRecordReceipts(refType, refId).length;
}

/** با حذف رکورد، رسیدهای همان رکورد هم پاک می‌شوند تا فایل بی‌صاحب نماند. */
export function removeReceiptsForRecord(refType: string, refId: string): { ok: boolean; removed: number } {
  const rows = loadReceipts();
  const kept = rows.filter((row) => !(row.refType === refType && row.refId === refId));
  if (kept.length === rows.length) return { ok: true, removed: 0 };
  const result = persist(kept);
  if (result.ok) notifyReceiptsChanged();
  return { ok: result.ok, removed: rows.length - kept.length };
}



export function receiptsFor(section: ReceiptSectionId | "all"): StoredReceipt[] {
  const rows = loadReceipts();
  return section === "all" ? rows : rows.filter((row) => row.section === section);
}

export function receiptsStats(rows = loadReceipts()) {
  const total = rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const bytes = rows.reduce((sum, row) => sum + row.sizeBytes, 0);
  const sections = new Set(rows.map((row) => row.section));
  return { count: rows.length, total, bytes, sections: sections.size, lastAt: rows[0]?.createdAt ?? null };
}

/** نوع فایل را حتی وقتی مرورگر/وب‌ویو MIME را خالی می‌دهد، از پسوند تشخیص می‌دهد. */
function inferReceiptMime(file: File): string {
  const declared = (file.type || "").toLowerCase();
  if (declared) return declared;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (/\.(jpe?g)$/.test(name)) return "image/jpeg";
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (/\.(heic|heif)$/.test(name)) return "image/heic";
  return "application/octet-stream";
}

const estimateDataUrlBytes = (dataUrl: string) => Math.max(0, Math.round(((dataUrl.length - (dataUrl.indexOf(",") + 1)) * 3) / 4));

/**
 * فشرده‌سازی عکس روی دستگاه، پیش از ذخیره. PDF بدون تغییر (data URL) خوانده می‌شود.
 * برای هر تصویر یک thumbnail کوچک هم ساخته می‌شود تا فهرست رسیدها، عکس ۱۴۰۰
 * پیکسلی را برای یک کادر ۴۰ پیکسلی decode نکند (منشأ اصلی لگ فهرست).
 */
export async function readReceiptFile(file: File): Promise<{
  ok: boolean;
  error?: string;
  dataUrl?: string;
  thumbnailDataUrl?: string;
  mimeType?: string;
  sizeBytes?: number;
  fileName?: string;
}> {
  const mime = inferReceiptMime(file);
  const check = validateReceiptFile({ name: file.name, type: mime, size: file.size });
  if (!check.ok) return { ok: false, error: check.message };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, error: "حجم فایل بیش از حد مجاز است." };

  const readAsDataUrl = (blob: File | Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("خواندن فایل ممکن نشد"));
      reader.readAsDataURL(blob);
    });

  const ensureFitsArchive = (dataUrl: string): string | null => {
    // هر کاراکتر base64 در localStorage یک واحد حافظه است؛ فایل بزرگ‌تر از
    // سهمیهٔ امن را قبل از خطای مبهم «حافظه پر است» روشن رد می‌کنیم.
    if (dataUrl.length > LOCAL_RECEIPT_BUDGET - 2048) {
      return "این فایل پس از آماده‌سازی از ظرفیت آفلاین بایگانی بزرگ‌تر است؛ عکس رسید بگیرید یا PDF کم‌حجم‌تر انتخاب کنید.";
    }
    return null;
  };

  try {
    if (!mime.startsWith("image/") || typeof createImageBitmap !== "function") {
      const dataUrl = await readAsDataUrl(file);
      const tooBig = ensureFitsArchive(dataUrl);
      if (tooBig) return { ok: false, error: tooBig };
      return {
        ok: true,
        dataUrl,
        mimeType: mime.startsWith("image/") ? mime : "application/pdf",
        sizeBytes: file.size || estimateDataUrlBytes(dataUrl),
        fileName: file.name,
      };
    }
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" }).catch(() => null);
    if (!bitmap) {
      const dataUrl = await readAsDataUrl(file);
      const tooBig = ensureFitsArchive(dataUrl);
      if (tooBig) return { ok: false, error: tooBig };
      return { ok: true, dataUrl, mimeType: mime, sizeBytes: file.size || estimateDataUrlBytes(dataUrl), fileName: file.name };
    }
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("پردازش عکس ممکن نشد");
    context.imageSmoothingQuality = "medium";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const thumbScale = Math.min(1, 144 / Math.max(bitmap.width, bitmap.height));
    const thumbCanvas = document.createElement("canvas");
    thumbCanvas.width = Math.max(1, Math.round(bitmap.width * thumbScale));
    thumbCanvas.height = Math.max(1, Math.round(bitmap.height * thumbScale));
    const thumbContext = thumbCanvas.getContext("2d");
    if (thumbContext) {
      thumbContext.imageSmoothingQuality = "medium";
      thumbContext.drawImage(bitmap, 0, 0, thumbCanvas.width, thumbCanvas.height);
    }
    bitmap.close?.();

    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    const tooBig = ensureFitsArchive(dataUrl);
    if (tooBig) return { ok: false, error: tooBig };
    const thumbnailDataUrl = thumbContext ? thumbCanvas.toDataURL("image/jpeg", 0.6) : undefined;
    return {
      ok: true,
      dataUrl,
      thumbnailDataUrl,
      mimeType: "image/jpeg",
      sizeBytes: estimateDataUrlBytes(dataUrl),
      fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "خواندن فایل ممکن نشد" };
  }
}

export function receiptMetaLabel(section: string): string {
  return receiptSection(section).label;
}

export function receiptDateLabel(date: JDate): string {
  return formatJalali(date, "long");
}

export function newReceiptDate(): JDate {
  return todayJalali();
}

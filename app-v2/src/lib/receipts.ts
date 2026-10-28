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
  createdAt: number;
}

const KEY = "kishavar.receipts.v1";
/** سهمیهٔ امن حافظهٔ محلی؛ فایل بزرگ‌تر با پیام روشن رد می‌شود. */
export const LOCAL_RECEIPT_BUDGET = 4.4 * 1024 * 1024;

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

export function loadReceipts(): StoredReceipt[] {
  const store = storage();
  if (!store) return [];
  try {
    const raw = store.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is StoredReceipt => Boolean(item) && typeof item.id === "string" && typeof item.dataUrl === "string")
      .sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

function persist(rows: StoredReceipt[]): { ok: boolean; error?: string } {
  const store = storage();
  if (!store) return { ok: false, error: "حافظهٔ دستگاه در دسترس نیست." };
  try {
    const payload = JSON.stringify(rows);
    if (payload.length > LOCAL_RECEIPT_BUDGET) {
      return { ok: false, error: "حافظهٔ رسیدها پر شده است؛ چند رسید قدیمی را پاک یا از فایل پشتیبان خارج کنید." };
    }
    store.setItem(KEY, payload);
    return { ok: true };
  } catch {
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

/** فشرده‌سازی عکس روی دستگاه، پیش از ذخیره. PDF بدون تغییر (data URL) خوانده می‌شود. */
export async function readReceiptFile(file: File): Promise<{ ok: boolean; error?: string; dataUrl?: string; mimeType?: string; sizeBytes?: number; fileName?: string }> {
  const check = validateReceiptFile({ name: file.name, type: file.type, size: file.size });
  if (!check.ok) return { ok: false, error: check.message };
  if (file.size > MAX_RECEIPT_BYTES) return { ok: false, error: "حجم فایل بیش از حد مجاز است." };

  const readAsDataUrl = (blob: File | Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("خواندن فایل ممکن نشد"));
      reader.readAsDataURL(blob);
    });

  try {
    if (!file.type.startsWith("image/")) {
      const dataUrl = await readAsDataUrl(file);
      return { ok: true, dataUrl, mimeType: file.type || "application/pdf", sizeBytes: dataUrl.length, fileName: file.name };
    }
    const bitmap = await createImageBitmap(file).catch(() => null);
    if (!bitmap) {
      const dataUrl = await readAsDataUrl(file);
      return { ok: true, dataUrl, mimeType: file.type, sizeBytes: dataUrl.length, fileName: file.name };
    }
    const scale = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("پردازش عکس ممکن نشد");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    return { ok: true, dataUrl, mimeType: "image/jpeg", sizeBytes: dataUrl.length, fileName: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
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

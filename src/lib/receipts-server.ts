/**
 * ذخیره و خواندن رسیدها — لایهٔ مشترک سرور (API و Server Actions)
 * ------------------------------------------------------------
 * رسیدها به یک «رکورد واقعی» پیوند می‌خورند (بدهی، چک، تراکنش، معامله،
 * قرارداد، زمین، کشت، انبار، کارگر، ماشین، سند). این کار دو مزیت دارد:
 *  ۱) کاربر همان‌جا که اطلاعات را می‌نویسد، عکس رسید را هم ضمیمه می‌کند.
 *  ۲) هر رکورد می‌تواند چند رسید داشته باشد و فهرستش کنار همان رکورد می‌آید.
 * رسید «مدرک حمایتی/یادداشت» است و جای سند رسمی را نمی‌گیرد.
 */

import { db } from "@/db";
import { receipts } from "@/db/schema";
import { MAX_RECEIPT_BYTES, formatBytes, isReceiptSection, validateReceiptFile, type ReceiptSectionId } from "@/lib/receipt-sections";
import { and, eq, inArray } from "drizzle-orm";

/** نوع رکوردهایی که رسید به آن‌ها وصل می‌شود. */
export const RECEIPT_REF_TYPES = [
  "debt",
  "cheque",
  "transaction",
  "trade",
  "trade-payment",
  "contract",
  "contract-payment",
  "land",
  "crop",
  "inventory-item",
  "inventory-move",
  "worker",
  "labor",
  "equipment",
  "task",
  "document",
] as const;

export type ReceiptRefType = (typeof RECEIPT_REF_TYPES)[number];

const REF_SECTION: Record<ReceiptRefType, ReceiptSectionId> = {
  debt: "finance",
  cheque: "finance",
  transaction: "finance",
  trade: "trade",
  "trade-payment": "trade",
  contract: "contracts",
  "contract-payment": "contracts",
  land: "crops",
  crop: "crops",
  "inventory-item": "inventory",
  "inventory-move": "inventory",
  worker: "other",
  labor: "other",
  equipment: "other",
  task: "other",
  document: "documents",
};

export function isReceiptRefType(value: unknown): value is ReceiptRefType {
  return typeof value === "string" && (RECEIPT_REF_TYPES as readonly string[]).includes(value);
}

export function sectionForRef(refType: ReceiptRefType): ReceiptSectionId {
  return REF_SECTION[refType] ?? "other";
}

/** شمارش رسیدهای هر رکورد برای نشان‌دادن تعداد کنار همان رکورد. */
export async function receiptCounts(refType: ReceiptRefType, ids: number[]): Promise<Record<number, number>> {
  const clean = ids.filter((id) => Number.isInteger(id) && id > 0);
  if (!clean.length) return {};
  const rows = await db
    .select({ refId: receipts.refId })
    .from(receipts)
    .where(and(eq(receipts.refType, refType), inArray(receipts.refId, clean)));
  const counts: Record<number, number> = {};
  rows.forEach((row) => {
    if (typeof row.refId !== "number") return;
    counts[row.refId] = (counts[row.refId] ?? 0) + 1;
  });
  return counts;
}

/** پاک‌سازی رسیدهای وابسته هنگام حذف رکورد (جلوگیری از رسیدهای بی‌صاحب). */
export async function detachReceipts(refType: ReceiptRefType, refId: number): Promise<void> {
  if (!Number.isInteger(refId) || refId <= 0) return;
  try {
    await db.delete(receipts).where(and(eq(receipts.refType, refType), eq(receipts.refId, refId)));
  } catch (error) {
    console.error("detach receipts failed", error);
  }
}

/** یک فایل را به ردیف رسید تبدیل می‌کند (بدون تماس با دیتابیس). */
export async function toReceiptRow(input: {
  file: File;
  section: ReceiptSectionId;
  refType?: string;
  refId?: number | null;
  title: string;
  amount?: number | null;
  receiptDate?: string | null;
  reference?: string;
  note?: string;
}) {
  const check = validateReceiptFile({ name: input.file.name, type: input.file.type, size: input.file.size });
  if (!check.ok) return { ok: false as const, error: check.message };
  if (input.file.size > MAX_RECEIPT_BYTES) {
    return { ok: false as const, error: `حجم هر فایل باید کمتر از ${formatBytes(MAX_RECEIPT_BYTES)} باشد.` };
  }
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const refType = isReceiptRefType(input.refType) ? input.refType : "";
  const refId = Number.isInteger(input.refId) && (input.refId ?? 0) > 0 ? Number(input.refId) : null;
  return {
    ok: true as const,
    value: {
      section: isReceiptSection(input.section) ? input.section : "other",
      refType,
      refId,
      title: (input.title || input.file.name || "رسید").slice(0, 180),
      amount:
        input.amount !== null && input.amount !== undefined && Number.isFinite(input.amount) && input.amount >= 0
          ? Math.round(input.amount)
          : null,
      receiptDate: input.receiptDate ?? null,
      reference: (input.reference ?? "").slice(0, 120),
      note: (input.note ?? "").slice(0, 1200),
      fileName: (input.file.name || "receipt").slice(0, 180),
      mimeType: input.file.type || "application/octet-stream",
      sizeBytes: input.file.size,
      data: buffer.toString("base64"),
    },
  };
}

/**
 * رسیدهای ضمیمه‌شده در فرم‌های ثبت رکورد (input با name="receipts").
 * خروجی: تعداد ذخیره‌شده. خطاها بی‌صدا رد می‌شوند تا ثبت رکورد اصلی
 * به‌خاطر یک فایل نامعتبر شکست نخورد؛ فایل‌های نامعتبر در UI گزارش می‌شوند.
 */
export async function attachReceiptsFromForm(
  formData: FormData,
  refType: ReceiptRefType,
  refId: number,
  meta: { title?: string; amount?: number | null } = {},
): Promise<number> {
  if (!Number.isInteger(refId) || refId <= 0) return 0;
  const files = formData.getAll("receipts").filter((item): item is File => item instanceof File && item.size > 0);
  if (!files.length) return 0;
  const rows = [];
  for (const file of files.slice(0, 12)) {
    const prepared = await toReceiptRow({
      file,
      section: sectionForRef(refType),
      refType,
      refId,
      title: meta.title?.trim() || file.name || "رسید",
      amount: meta.amount ?? null,
    });
    if (prepared.ok) rows.push(prepared.value);
  }
  if (!rows.length) return 0;
  await db.insert(receipts).values(rows);
  return rows.length;
}

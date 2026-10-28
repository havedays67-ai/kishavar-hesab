import { db } from "@/db";
import { receipts } from "@/db/schema";
import { formatBytes, isReceiptSection, validateReceiptFile } from "@/lib/receipt-sections";
import { isReceiptRefType, sectionForRef } from "@/lib/receipts-server";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024;

/** فیلتر مشترک: بخش، یا رکورد مشخص (بدهی/چک/معامله/…). */
function receiptFilter(input: { section: string | null; refType: string; refId: number | null }): SQL | undefined {
  if (isReceiptRefType(input.refType) && input.refId) {
    return and(eq(receipts.refType, input.refType), eq(receipts.refId, input.refId));
  }
  return isReceiptSection(input.section) ? eq(receipts.section, input.section) : undefined;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const section = url.searchParams.get("section");
  const refType = url.searchParams.get("refType") ?? "";
  const refIdRaw = Number(url.searchParams.get("refId") ?? "");
  const refId = Number.isInteger(refIdRaw) && refIdRaw > 0 ? refIdRaw : null;
  try {
    const rows = await db
      .select({
        id: receipts.id,
        section: receipts.section,
        refType: receipts.refType,
        refId: receipts.refId,
        title: receipts.title,
        amount: receipts.amount,
        receiptDate: receipts.receiptDate,
        reference: receipts.reference,
        note: receipts.note,
        fileName: receipts.fileName,
        mimeType: receipts.mimeType,
        sizeBytes: receipts.sizeBytes,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .where(receiptFilter({ section, refType, refId }))
      .orderBy(desc(receipts.id))
      .limit(200);
    return Response.json({ ok: true, receipts: rows });
  } catch {
    return Response.json({ ok: false, receipts: [], error: "خواندن رسیدها ناموفق بود" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ ok: false, error: "بدنهٔ درخواست معتبر نیست" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ ok: false, error: "فایل رسید را انتخاب کنید" }, { status: 400 });
  }
  const check = validateReceiptFile({ name: file.name, type: file.type, size: file.size });
  if (!check.ok) return Response.json({ ok: false, error: check.message }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return Response.json({ ok: false, error: `حجم فایل باید کمتر از ${formatBytes(MAX_BYTES)} باشد` }, { status: 413 });
  }

  const refTypeRaw = String(form.get("refType") ?? "");
  const refType = isReceiptRefType(refTypeRaw) ? refTypeRaw : "";
  const refIdRaw = Number(String(form.get("refId") ?? "").trim());
  const refId = Number.isInteger(refIdRaw) && refIdRaw > 0 ? refIdRaw : null;
  if (refId && !refType) return Response.json({ ok: false, error: "نوع رکورد رسید مشخص نیست" }, { status: 400 });

  const rawTitle = String(form.get("title") ?? "").trim();
  const title = rawTitle || file.name.replace(/\.[^.]+$/, "") || "رسید";
  if (title.length < 2) return Response.json({ ok: false, error: "عنوان رسید را بنویسید" }, { status: 400 });

  const sectionRaw = String(form.get("section") ?? "");
  const section = isReceiptSection(sectionRaw) ? sectionRaw : refType ? sectionForRef(refType) : "other";
  const amountRaw = String(form.get("amount") ?? "").replace(/[,٬\s]/g, "").replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  const amount = amountRaw ? Number(amountRaw) : null;
  const dateRaw = String(form.get("receiptDate") ?? "").trim();
  const receiptDate = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const [row] = await db
      .insert(receipts)
      .values({
        section,
        refType,
        refId,
        title: title.slice(0, 180),
        amount: amount !== null && Number.isFinite(amount) && amount >= 0 ? amount : null,
        receiptDate,
        reference: String(form.get("reference") ?? "").trim().slice(0, 120),
        note: String(form.get("note") ?? "").trim().slice(0, 1200),
        fileName: file.name.slice(0, 180) || "receipt",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        data: buffer.toString("base64"),
      })
      .returning({ id: receipts.id });
    revalidatePath("/receipts");
    return Response.json({ ok: true, id: row?.id, message: "رسید ذخیره شد." });
  } catch {
    return Response.json({ ok: false, error: "ذخیرهٔ رسید انجام نشد؛ دوباره تلاش کنید." }, { status: 500 });
  }
}

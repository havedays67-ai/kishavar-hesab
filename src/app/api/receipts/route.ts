import { db } from "@/db";
import { receipts } from "@/db/schema";
import { formatBytes, isReceiptSection, validateReceiptFile } from "@/lib/receipt-sections";
import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const MAX_BYTES = 6 * 1024 * 1024;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const section = url.searchParams.get("section");
  try {
    const rows = await db
      .select({
        id: receipts.id,
        section: receipts.section,
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
      .where(isReceiptSection(section) ? eq(receipts.section, section) : undefined)
      .orderBy(desc(receipts.id))
      .limit(60);
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

  const title = String(form.get("title") ?? "").trim();
  if (title.length < 2) return Response.json({ ok: false, error: "عنوان رسید را بنویسید" }, { status: 400 });

  const sectionRaw = form.get("section");
  const section = isReceiptSection(sectionRaw) ? sectionRaw : "other";
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

import { db } from "@/db";
import { receipts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};

function safeName(name: string, mime: string, id: number): string {
  const base = (name || `receipt-${id}`).replace(/[\\/:*?"<>|\r\n]/g, "-").trim() || `receipt-${id}`;
  const ext = EXTENSION[mime] ?? "bin";
  return /\.(jpe?g|png|webp|heic|heif|pdf)$/i.test(base) ? base : `${base}.${ext}`;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return Response.json({ ok: false, error: "شناسهٔ رسید معتبر نیست" }, { status: 400 });
  }
  const rows = await db.select().from(receipts).where(eq(receipts.id, numericId)).limit(1);
  const row = rows[0];
  if (!row) return Response.json({ ok: false, error: "رسید پیدا نشد" }, { status: 404 });

  const mime = row.mimeType || "application/octet-stream";
  const name = safeName(row.fileName, mime, row.id);
  const bytes = Buffer.from(row.data, "base64");
  // ?download=1 → فایل با نام و پسوند درست ذخیره می‌شود؛ پیش‌فرض نمایش داخل مرورگر.
  const asAttachment = new URL(request.url).searchParams.get("download") === "1";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": mime,
      "content-length": String(bytes.length),
      "content-disposition": `${asAttachment ? "attachment" : "inline"}; filename="${encodeURIComponent(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`,
      "cache-control": "private, max-age=60",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return Response.json({ ok: false, error: "شناسهٔ رسید معتبر نیست" }, { status: 400 });
  }
  try {
    await db.delete(receipts).where(eq(receipts.id, numericId));
    revalidatePath("/receipts");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false, error: "حذف رسید انجام نشد" }, { status: 500 });
  }
}

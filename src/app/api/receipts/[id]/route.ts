import { db } from "@/db";
import { receipts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    return Response.json({ ok: false, error: "شناسهٔ رسید معتبر نیست" }, { status: 400 });
  }
  const rows = await db.select().from(receipts).where(eq(receipts.id, numericId)).limit(1);
  const row = rows[0];
  if (!row) return Response.json({ ok: false, error: "رسید پیدا نشد" }, { status: 404 });
  const bytes = Buffer.from(row.data, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": row.mimeType || "application/octet-stream",
      "content-length": String(bytes.length),
      "content-disposition": `inline; filename="receipt-${row.id}${row.mimeType === "application/pdf" ? ".pdf" : ".jpg"}"`,
      "cache-control": "private, max-age=60",
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

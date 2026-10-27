import { ensureSeeded } from "@/lib/seed";
import { getSeedFlag } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const seeded = await getSeedFlag();
  return Response.json({ seeded });
}

export async function POST() {
  await ensureSeeded();
  const seeded = await getSeedFlag();
  return Response.json({ ok: seeded });
}

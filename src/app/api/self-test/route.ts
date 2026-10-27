import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { runSelfTests, selfTestSummary } from "@/lib/trade/selftest";
import { TRADE_ENGINE_VERSION } from "@/lib/trade/engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const tests = runSelfTests();
  const summary = selfTestSummary(tests);
  let database: { ok: boolean; tables: string[]; error?: string } = { ok: false, tables: [] };
  try {
    const rows = await db.execute<{ table_name: string }>(
      sql`select table_name from information_schema.tables where table_schema = 'public' and table_name in ('crop_trades','trade_payments','trade_documents','transactions','settings')`,
    );
    const tables = rows.rows.map((row) => row.table_name);
    database = { ok: tables.includes("crop_trades") && tables.includes("trade_payments"), tables };
  } catch (error) {
    database = { ok: false, tables: [], error: error instanceof Error ? error.message : "db error" };
  }

  return NextResponse.json(
    {
      ok: summary.ok && database.ok,
      version: TRADE_ENGINE_VERSION,
      checkedAt: new Date().toISOString(),
      summary,
      database,
      failed: tests.filter((test) => !test.passed),
    },
    { status: summary.ok && database.ok ? 200 : 500 },
  );
}

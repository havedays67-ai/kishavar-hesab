import { db } from "@/db";
import { cropTrades, lands, tradeDocuments, tradePayments } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { currentJalaliYear } from "@/lib/format";
import { DOC_TYPES, documentSerial, tradeCode, type DocType, type TradeCalc, type TradeStatus } from "./engine";

export type TradeRow = typeof cropTrades.$inferSelect;
export type PaymentRow = typeof tradePayments.$inferSelect;
export type TradeDocRow = typeof tradeDocuments.$inferSelect;

export function calcOf(row: TradeRow): TradeCalc {
  return row.calc as unknown as TradeCalc;
}

export function paidOf(row: TradeRow): number {
  return Number(row.paidToman ?? 0) || 0;
}

export function balanceOf(row: TradeRow): number {
  return Math.max(0, Number(row.totalToman ?? 0) - paidOf(row));
}

export function progressOf(row: TradeRow): number {
  const total = Number(row.totalToman ?? 0);
  if (!total) return 0;
  return Math.min(100, Math.round((paidOf(row) / total) * 100));
}

export async function listTrades(): Promise<TradeRow[]> {
  return db.select().from(cropTrades).orderBy(desc(cropTrades.contractDate), desc(cropTrades.id));
}

export async function getTrade(id: number): Promise<TradeRow | null> {
  const [row] = await db.select().from(cropTrades).where(eq(cropTrades.id, id)).limit(1);
  return row ?? null;
}

export async function getPayments(tradeId: number): Promise<PaymentRow[]> {
  return db.select().from(tradePayments).where(eq(tradePayments.tradeId, tradeId)).orderBy(desc(tradePayments.paidAt), desc(tradePayments.id));
}

export async function getDocuments(tradeId: number): Promise<TradeDocRow[]> {
  return db.select().from(tradeDocuments).where(eq(tradeDocuments.tradeId, tradeId)).orderBy(desc(tradeDocuments.issuedAt));
}

export async function listLands() {
  return db.select({ id: lands.id, name: lands.name }).from(lands).orderBy(lands.name);
}

export interface TradeStats {
  count: number;
  openCount: number;
  totalToman: number;
  paidToman: number;
  balanceToman: number;
  netKg: number;
  adjustedKg: number;
  avgScore: number;
  rejected: number;
}

export async function getTradeStats(): Promise<TradeStats> {
  const rows = await db
    .select({
      count: sql<number>`count(*)::int`,
      totalToman: sql<number>`coalesce(sum(${cropTrades.totalToman}), 0)::bigint`,
      paidToman: sql<number>`coalesce(sum(${cropTrades.paidToman}), 0)::bigint`,
      netKg: sql<number>`coalesce(sum(${cropTrades.netKg}), 0)::float8`,
      adjustedKg: sql<number>`coalesce(sum(${cropTrades.adjustedKg}), 0)::float8`,
      openCount: sql<number>`count(*) filter (where ${cropTrades.status} <> 'settled' and ${cropTrades.status} <> 'canceled')::int`,
      rejected: sql<number>`count(*) filter (where ${cropTrades.grade} = 0)::int`,
    })
    .from(cropTrades);
  const row = rows[0];
  const quality = await db
    .select({ score: sql<number>`coalesce(avg(((${cropTrades.calc} -> 'quality') ->> 'score')::float8), 0)` })
    .from(cropTrades);
  const total = Number(row?.totalToman ?? 0);
  const paid = Number(row?.paidToman ?? 0);
  return {
    count: Number(row?.count ?? 0),
    openCount: Number(row?.openCount ?? 0),
    totalToman: total,
    paidToman: paid,
    balanceToman: Math.max(0, total - paid),
    netKg: Number(row?.netKg ?? 0),
    adjustedKg: Number(row?.adjustedKg ?? 0),
    avgScore: Math.round(Number(quality[0]?.score ?? 0)),
    rejected: Number(row?.rejected ?? 0),
  };
}

/** شماره سریال بعدی معامله؛ بر پایه سال جاری شمسی و بیشترین شماره ثبت‌شده. */
export async function nextTradeCode(): Promise<string> {
  const year = currentJalaliYear();
  const rows = await db
    .select({ code: cropTrades.code })
    .from(cropTrades)
    .where(sql`${cropTrades.code} like ${`KH-${year}-%`}`);
  let max = 0;
  for (const row of rows) {
    const parts = row.code.split("-");
    const seq = Number(parts[2]);
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return tradeCode(year, max + 1);
}

export interface NewTradeValues {
  code: string;
  input: Record<string, unknown>;
  calc: TradeCalc;
  row: Omit<typeof cropTrades.$inferInsert, "code" | "input" | "calc">;
}

export async function insertTrade(values: NewTradeValues): Promise<number> {
  const [inserted] = await db
    .insert(cropTrades)
    .values({
      ...values.row,
      code: values.code,
      input: values.input,
      calc: values.calc as unknown as Record<string, unknown>,
      engineVersion: values.calc.engineVersion,
    })
    .returning({ id: cropTrades.id });
  return inserted.id;
}

export async function recalcPaid(tradeId: number): Promise<{ paid: number; total: number }> {
  const [agg] = await db
    .select({ paid: sql<number>`coalesce(sum(${tradePayments.amountToman}), 0)::bigint` })
    .from(tradePayments)
    .where(eq(tradePayments.tradeId, tradeId));
  const paid = Number(agg?.paid ?? 0);
  const [trade] = await db
    .select({ total: cropTrades.totalToman, status: cropTrades.status })
    .from(cropTrades)
    .where(eq(cropTrades.id, tradeId))
    .limit(1);
  const total = Number(trade?.total ?? 0);
  let status: TradeStatus = (trade?.status as TradeStatus) ?? "draft";
  if (status !== "canceled") {
    status = total > 0 && paid >= total ? "settled" : status === "draft" ? "draft" : "confirmed";
  }
  await db.update(cropTrades).set({ paidToman: paid, status }).where(eq(cropTrades.id, tradeId));
  return { paid, total };
}

/**
 * صدور (یا بازیابی) سند رسمی. هر سند فقط یک بار شماره سریال می‌گیرد
 * تا چاپ مجدد همان شماره و همان تصویر لحظه صدور را نشان دهد.
 */
export async function ensureDocument(
  trade: TradeRow,
  docType: DocType,
): Promise<{ serial: string; issuedAt: Date }> {
  const serial = documentSerial(trade.code, docType);
  const [existing] = await db
    .select({ serial: tradeDocuments.serial, issuedAt: tradeDocuments.issuedAt })
    .from(tradeDocuments)
    .where(eq(tradeDocuments.serial, serial))
    .limit(1);
  if (existing) return { serial: existing.serial, issuedAt: existing.issuedAt };
  const snapshot = {
    code: trade.code,
    title: DOC_TYPES[docType].title,
    totalToman: trade.totalToman,
    netKg: trade.netKg,
    adjustedKg: trade.adjustedKg,
    grade: trade.grade,
    cropName: trade.cropName,
    sellerName: trade.sellerName,
    buyerName: trade.buyerName,
    contractDate: trade.contractDate,
    engineVersion: trade.engineVersion,
  };
  try {
    const [created] = await db
      .insert(tradeDocuments)
      .values({ tradeId: trade.id, docType, serial, snapshot })
      .returning({ serial: tradeDocuments.serial, issuedAt: tradeDocuments.issuedAt });
    return { serial: created.serial, issuedAt: created.issuedAt };
  } catch {
    const [fallback] = await db
      .select({ serial: tradeDocuments.serial, issuedAt: tradeDocuments.issuedAt })
      .from(tradeDocuments)
      .where(eq(tradeDocuments.serial, serial))
      .limit(1);
    if (fallback) return { serial: fallback.serial, issuedAt: fallback.issuedAt };
    throw new Error("صدور سند ناموفق بود");
  }
}

export async function findDocumentBySerial(serial: string) {
  const [doc] = await db.select().from(tradeDocuments).where(eq(tradeDocuments.serial, serial)).limit(1);
  if (!doc) return null;
  const [trade] = await db.select().from(cropTrades).where(eq(cropTrades.id, doc.tradeId)).limit(1);
  return trade ? { doc, trade } : null;
}

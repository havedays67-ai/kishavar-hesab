import { db } from "@/db";
import {
  assistantNotes,
  categories,
  cheques,
  crops,
  debts,
  equipment,
  inventoryItems,
  inventoryMoves,
  knowledge,
  laborLogs,
  lands,
  tasks,
  transactions,
  workers,
} from "@/db/schema";
import { and, asc, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { monthKey, monthLabel, daysUntil, todayISO } from "@/lib/format";

export type Land = typeof lands.$inferSelect;
export type Crop = typeof crops.$inferSelect;
export type Txn = typeof transactions.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type InventoryItem = typeof inventoryItems.$inferSelect;
export type Worker = typeof workers.$inferSelect;
export type LaborLog = typeof laborLogs.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Debt = typeof debts.$inferSelect;
export type Cheque = typeof cheques.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Knowledge = typeof knowledge.$inferSelect;
export type Note = typeof assistantNotes.$inferSelect;

export type TxnRow = Txn & {
  categoryName: string | null;
  categoryIcon: string | null;
  landName: string | null;
  cropName: string | null;
};

export type CropRow = Crop & { landName: string | null; landAreaHa: number | null };
export type MoveRow = (typeof inventoryMoves.$inferSelect) & { itemName: string | null; unit: string | null };
export type LaborRow = LaborLog & { landName: string | null; cropName: string | null };

export const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const sumBy = <T>(rows: T[], pick: (row: T) => number) => rows.reduce((a, r) => a + (pick(r) || 0), 0);

/* ----------------------------- reads ----------------------------- */

export async function getCategories(): Promise<Category[]> {
  return db.select().from(categories).orderBy(asc(categories.kind), asc(categories.name));
}

export async function listTransactions(filters?: {
  kind?: string;
  landId?: number;
  categoryId?: number;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
}): Promise<TxnRow[]> {
  const where: SQL[] = [];
  if (filters?.kind === "income" || filters?.kind === "expense") where.push(eq(transactions.kind, filters.kind));
  if (filters?.landId) where.push(eq(transactions.landId, filters.landId));
  if (filters?.categoryId) where.push(eq(transactions.categoryId, filters.categoryId));
  if (filters?.from) where.push(gte(transactions.date, filters.from));
  if (filters?.to) where.push(lte(transactions.date, filters.to));
  if (filters?.q) {
    const needle = `%${filters.q}%`;
    const cond = or(
      ilike(transactions.description, needle),
      ilike(transactions.party, needle),
    );
    if (cond) where.push(cond);
  }
  const rows = await db
    .select({
      t: transactions,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      landName: lands.name,
      cropName: crops.name,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(lands, eq(transactions.landId, lands.id))
    .leftJoin(crops, eq(transactions.cropId, crops.id))
    .where(where.length ? and(...where) : undefined)
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(filters?.limit ?? 500);

  return rows.map((r) => ({
    ...r.t,
    categoryName: r.categoryName,
    categoryIcon: r.categoryIcon,
    landName: r.landName,
    cropName: r.cropName,
  }));
}

export async function getLands(): Promise<Land[]> {
  return db.select().from(lands).orderBy(asc(lands.name));
}

export async function getCrops(landId?: number): Promise<CropRow[]> {
  const rows = await db
    .select({ c: crops, landName: lands.name, landAreaHa: lands.areaHa })
    .from(crops)
    .leftJoin(lands, eq(crops.landId, lands.id))
    .where(landId ? eq(crops.landId, landId) : undefined)
    .orderBy(desc(crops.plantingDate));
  return rows.map((r) => ({ ...r.c, landName: r.landName, landAreaHa: r.landAreaHa }));
}

export async function getInventory(): Promise<InventoryItem[]> {
  return db.select().from(inventoryItems).orderBy(asc(inventoryItems.name));
}

export async function getMoves(limit = 40): Promise<MoveRow[]> {
  const rows = await db
    .select({ m: inventoryMoves, itemName: inventoryItems.name, unit: inventoryItems.unit })
    .from(inventoryMoves)
    .leftJoin(inventoryItems, eq(inventoryMoves.itemId, inventoryItems.id))
    .orderBy(desc(inventoryMoves.date), desc(inventoryMoves.id))
    .limit(limit);
  return rows.map((r) => ({ ...r.m, itemName: r.itemName, unit: r.unit }));
}

export async function getWorkers(): Promise<Worker[]> {
  return db.select().from(workers).orderBy(asc(workers.name));
}

export async function getLabor(limit = 200): Promise<LaborRow[]> {
  const rows = await db
    .select({ l: laborLogs, landName: lands.name, cropName: crops.name })
    .from(laborLogs)
    .leftJoin(lands, eq(laborLogs.landId, lands.id))
    .leftJoin(crops, eq(laborLogs.cropId, crops.id))
    .orderBy(desc(laborLogs.date), desc(laborLogs.id))
    .limit(limit);
  return rows.map((r) => ({ ...r.l, landName: r.landName, cropName: r.cropName }));
}

export async function getEquipment(): Promise<Equipment[]> {
  return db.select().from(equipment).orderBy(asc(equipment.name));
}

export async function getDebts(): Promise<Debt[]> {
  return db.select().from(debts).orderBy(asc(debts.paid), asc(debts.dueDate));
}

export async function getCheques(): Promise<Cheque[]> {
  return db.select().from(cheques).orderBy(asc(cheques.status), asc(cheques.dueDate));
}

export async function getTasks(): Promise<Task[]> {
  return db.select().from(tasks).orderBy(asc(tasks.status), asc(tasks.dueDate));
}

export async function getKnowledge(): Promise<Knowledge[]> {
  return db.select().from(knowledge).orderBy(asc(knowledge.topic), asc(knowledge.id));
}

export async function getNotes(limit = 20): Promise<Note[]> {
  return db.select().from(assistantNotes).orderBy(desc(assistantNotes.id)).limit(limit);
}

/* --------------------------- aggregates --------------------------- */

export type LandStat = {
  land: Land;
  income: number;
  expense: number;
  profit: number;
  activeCrops: number;
  costPerHa: number;
  incomePerHa: number;
  share: number;
};

export type CropStat = {
  crop: Crop;
  landName: string;
  landAreaHa: number;
  income: number;
  expense: number;
  profit: number;
  costPerKg: number;
  revenuePerHa: number;
};

export type Alert = {
  kind: "stock" | "cheque" | "debt" | "labor" | "task";
  title: string;
  detail: string;
  href: string;
  severity: "high" | "medium" | "low";
};

export type Breakdown = { name: string; icon: string; amount: number; share: number };

export type FarmOverview = {
  totals: {
    income: number;
    expense: number;
    profit: number;
    margin: number;
    creditIncome: number;
    creditExpense: number;
    unpaidLabor: number;
    payable: number;
    receivable: number;
    chequeUpcoming: number;
    inventoryValue: number;
    landArea: number;
    activeCrops: number;
  };
  monthly: { key: string; label: string; income: number; expense: number; profit: number }[];
  expenseBreakdown: Breakdown[];
  incomeBreakdown: Breakdown[];
  landStats: LandStat[];
  cropStats: CropStat[];
  alerts: Alert[];
  recent: TxnRow[];
  lowStock: InventoryItem[];
};

export async function getFarmOverview(): Promise<FarmOverview> {
  const [landRows, cropRows, txnRows, invRows, laborRows, debtRows, chequeRows, taskRows] =
    await Promise.all([
      getLands(),
      getCrops(),
      listTransactions({ limit: 2000 }),
      getInventory(),
      getLabor(500),
      getDebts(),
      getCheques(),
      getTasks(),
    ]);

  const income = sumBy(txnRows.filter((t) => t.kind === "income"), (t) => t.amount);
  const expense = sumBy(txnRows.filter((t) => t.kind === "expense"), (t) => t.amount);
  const landArea = sumBy(landRows, (l) => l.areaHa);

  const monthMap = new Map<string, { income: number; expense: number }>();
  for (const t of txnRows) {
    const key = monthKey(t.date);
    const row = monthMap.get(key) ?? { income: 0, expense: 0 };
    if (t.kind === "income") row.income += t.amount;
    else row.expense += t.amount;
    monthMap.set(key, row);
  }
  const monthly = [...monthMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([key, v]) => ({ key, label: monthLabel(key), ...v, profit: v.income - v.expense }));

  const breakdown = (kind: "income" | "expense"): Breakdown[] => {
    const rows = txnRows.filter((t) => t.kind === kind);
    const total = sumBy(rows, (r) => r.amount) || 1;
    const map = new Map<string, { icon: string; amount: number }>();
    for (const r of rows) {
      const name = r.categoryName ?? "دسته‌بندی‌نشده";
      const cur = map.get(name) ?? { icon: r.categoryIcon ?? "•", amount: 0 };
      cur.amount += r.amount;
      map.set(name, cur);
    }
    return [...map.entries()]
      .map(([name, v]) => ({ name, icon: v.icon, amount: v.amount, share: v.amount / total }))
      .sort((a, b) => b.amount - a.amount);
  };

  const landStats: LandStat[] = landRows.map((land) => {
    const lTx = txnRows.filter((t) => t.landId === land.id);
    const lIncome = sumBy(lTx.filter((t) => t.kind === "income"), (t) => t.amount);
    const lExpense = sumBy(lTx.filter((t) => t.kind === "expense"), (t) => t.amount);
    return {
      land,
      income: lIncome,
      expense: lExpense,
      profit: lIncome - lExpense,
      activeCrops: cropRows.filter((c) => c.landId === land.id && c.status !== "harvested").length,
      costPerHa: land.areaHa > 0 ? lExpense / land.areaHa : 0,
      incomePerHa: land.areaHa > 0 ? lIncome / land.areaHa : 0,
      share: 0,
    };
  });

  const cropStats: CropStat[] = cropRows.map((crop) => {
    const cTx = txnRows.filter((t) => t.cropId === crop.id);
    const cIncome = sumBy(cTx.filter((t) => t.kind === "income"), (t) => t.amount);
    const cExpense = sumBy(cTx.filter((t) => t.kind === "expense"), (t) => t.amount);
    const yieldKg = crop.actualYieldKg || crop.expectedYieldKg;
    return {
      crop,
      landName: crop.landName ?? "—",
      landAreaHa: crop.landAreaHa ?? 0,
      income: cIncome,
      expense: cExpense,
      profit: cIncome - cExpense,
      costPerKg: yieldKg > 0 ? cExpense / yieldKg : 0,
      revenuePerHa: crop.landAreaHa ? cIncome / crop.landAreaHa : 0,
    };
  });

  const lowStock = invRows.filter((i) => i.quantity <= i.reorderLevel);
  const unpaidLabor = sumBy(laborRows.filter((l) => !l.paid), (l) => l.amount);
  const payable = sumBy(debtRows.filter((d) => d.direction === "payable" && !d.paid), (d) => d.amount);
  const receivable = sumBy(debtRows.filter((d) => d.direction === "receivable" && !d.paid), (d) => d.amount);
  const pendingCheques = chequeRows.filter((c) => c.status === "pending");
  const chequeUpcoming = sumBy(pendingCheques, (c) => c.amount);

  const alerts: Alert[] = [];
  for (const item of lowStock.slice(0, 3)) {
    alerts.push({
      kind: "stock",
      title: `کمبود موجودی: ${item.name}`,
      detail: `موجودی ${item.quantity} ${item.unit} — نقطه سفارش ${item.reorderLevel} ${item.unit}`,
      href: "/inventory",
      severity: item.quantity <= 0 ? "high" : "medium",
    });
  }
  for (const c of pendingCheques) {
    const d = daysUntil(c.dueDate);
    if (d !== null && d <= 14) {
      alerts.push({
        kind: "cheque",
        title: `چک ${c.direction === "issued" ? "صادره" : "دریافتی"} ${c.party}`,
        detail: d < 0 ? `${Math.abs(d)} روز گذشته از سررسید` : `${d} روز تا سررسید`,
        href: "/finance",
        severity: d <= 3 ? "high" : "medium",
      });
    }
  }
  for (const d of debtRows.filter((x) => !x.paid)) {
    const days = daysUntil(d.dueDate);
    if (days !== null && days <= 10) {
      alerts.push({
        kind: "debt",
        title: `${d.direction === "payable" ? "بدهی به" : "طلب از"} ${d.party}`,
        detail: days < 0 ? `${Math.abs(days)} روز تأخیر` : `${days} روز تا موعد`,
        href: "/finance",
        severity: days < 0 ? "high" : "low",
      });
    }
  }
  if (unpaidLabor > 0) {
    alerts.push({
      kind: "labor",
      title: "دستمزد پرداخت‌نشده",
      detail: "کارگران منتظر تسویه هستند",
      href: "/labor",
      severity: "medium",
    });
  }
  const openTasks = taskRows.filter((t) => t.status === "open");
  for (const t of openTasks.slice(0, 2)) {
    alerts.push({
      kind: "task",
      title: t.title,
      detail: t.dueDate ? `موعد: ${t.dueDate}` : "بدون موعد",
      href: "/",
      severity: t.priority === "high" ? "high" : "low",
    });
  }

  return {
    totals: {
      income,
      expense,
      profit: income - expense,
      margin: income > 0 ? (income - expense) / income : 0,
      creditIncome: sumBy(txnRows.filter((t) => t.kind === "income" && t.method === "credit"), (t) => t.amount),
      creditExpense: sumBy(txnRows.filter((t) => t.kind === "expense" && t.method === "credit"), (t) => t.amount),
      unpaidLabor,
      payable,
      receivable,
      chequeUpcoming,
      inventoryValue: sumBy(invRows, (i) => i.quantity * i.unitCost),
      landArea,
      activeCrops: cropRows.filter((c) => c.status !== "harvested").length,
    },
    monthly,
    expenseBreakdown: breakdown("expense"),
    incomeBreakdown: breakdown("income"),
    landStats,
    cropStats,
    alerts: alerts.slice(0, 6),
    recent: txnRows.slice(0, 6),
    lowStock,
  };
}

/** Compact natural-language snapshot handed to the assistant. Scoped to this app only. */
export async function buildFarmContext(): Promise<string> {
  const [o, landRows, cropRows, invRows, debtRows, chequeRows, laborRows, workerRows, catRows, taskRows] =
    await Promise.all([
      getFarmOverview(),
      getLands(),
      getCrops(),
      getInventory(),
      getDebts(),
      getCheques(),
      getLabor(60),
      getWorkers(),
      getCategories(),
      getTasks(),
    ]);

  const parts: string[] = [];
  parts.push(`امروز: ${todayISO()}`);
  parts.push(
    `خلاصه مالی کل: درآمد ${o.totals.income} تومان، هزینه ${o.totals.expense} تومان، سود ${o.totals.profit} تومان، حاشیه سود ${Math.round(
      o.totals.margin * 100,
    )} درصد. سطح زیرکشت ${o.totals.landArea} هکتار، ${o.totals.activeCrops} کشت فعال.`,
  );
  parts.push(
    `بدهی ما ${o.totals.payable}، طلب ما ${o.totals.receivable}، دستمزد پرداخت‌نشده ${o.totals.unpaidLabor}، ارزش انبار ${o.totals.inventoryValue} تومان.`,
  );
  parts.push(
    `زمین‌ها: ${landRows
      .map((l) => `${l.name} (${l.areaHa} هکتار، ${l.region}، آبیاری ${l.irrigation})`)
      .join(" | ")}`,
  );
  parts.push(
    `کشت‌ها: ${cropRows
      .map(
        (c) =>
          `${c.name}${c.variety ? ` رقم ${c.variety}` : ""} در ${c.landName}، وضعیت ${c.status}، برداشت ${c.actualYieldKg} کیلو`,
      )
      .join(" | ")}`,
  );
  parts.push(
    `تفکیک هزینه: ${o.expenseBreakdown
      .slice(0, 8)
      .map((b) => `${b.name} ${b.amount}`)
      .join("، ")}`,
  );
  parts.push(
    `تفکیک درآمد: ${o.incomeBreakdown
      .slice(0, 6)
      .map((b) => `${b.name} ${b.amount}`)
      .join("، ")}`,
  );
  parts.push(
    `انبار: ${invRows
      .map((i) => `${i.name} ${i.quantity} ${i.unit} (حد سفارش ${i.reorderLevel})`)
      .join("، ")}`,
  );
  parts.push(
    `بدهی/طلب: ${debtRows
      .map((d) => `${d.party} ${d.direction === "payable" ? "بدهی" : "طلب"} ${d.amount}${d.paid ? " تسویه" : ""}`)
      .join("، ")}`,
  );
  parts.push(
    `چک‌ها: ${chequeRows
      .map((c) => `${c.party} ${c.amount} ${c.status} سررسید ${c.dueDate ?? "-"}`)
      .join("، ")}`,
  );
  parts.push(
    `دستمزدها: ${laborRows
      .map((l) => `${l.workerName} ${l.task} ${l.amount} تومان ${l.paid ? "پرداخت‌شده" : "پرداخت‌نشده"}`)
      .join("، ")}`,
  );
  parts.push(`کارگران: ${workerRows.map((w) => `${w.name} (${w.role}، روزمزد ${w.dailyWage})`).join("، ")}`);
  parts.push(`دسته‌های مالی: ${catRows.map((c) => `${c.name}(${c.kind})`).join("، ")}`);
  parts.push(`کارها: ${taskRows.map((t) => `${t.title} ${t.status}`).join("، ")}`);
  parts.push(`هشدارها: ${o.alerts.map((a) => a.title).join("، ")}`);
  return parts.join("\n");
}

export async function getSeedFlag(): Promise<boolean> {
  const rows = await db.execute<{ value: string }>(sql`select value from settings where key = 'seeded' limit 1`);
  return rows.rows.length > 0;
}
